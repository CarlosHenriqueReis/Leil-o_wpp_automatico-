const { makeWASocket, useMultiFileAuthState, getAggregateVotesInPollMessage, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const qrcode = require('qrcode-terminal');

// Correção para alguns ambientes onde o Baileys procura crypto globalmente:
global.crypto = crypto;

const logger = pino({ level: 'silent' });

// Configuração: Para onde o baileys vai mandar os resultados?
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhook/baileys';

const pollCacheFile = 'poll_cache.json';
let pollCache = {};
if (fs.existsSync(pollCacheFile)) {
    try { pollCache = JSON.parse(fs.readFileSync(pollCacheFile, 'utf8')); } catch(e){}
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Usando WhatsApp Web v${version.join('.')} (latest: ${isLatest})`);

    const sock = makeWASocket({
        version,
        auth: state,
        logger,
        browser: ['Dashboard Leilao', 'Chrome', '1.0.0'],
        syncFullHistory: false
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada devido a', lastDisconnect.error, ', reconectando:', shouldReconnect);
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 3000);
            } else {
                console.log('Logout detectado. Apague a pasta auth_info_baileys e reinicie para novo QR Code.');
            }
        } else if (connection === 'open') {
            console.log('✅ Conexão Baileys aberta com sucesso e escutando Votos!');
            console.log(`🔗 Webhook de destino configurado para: ${WEBHOOK_URL}`);
        }

        if (qr) {
            console.log('📱 NOVO QR CODE GERADO. Escaneie-o acessando o WhatsApp > Aparelhos Conectados.');
            qrcode.generate(qr, { small: true });
        }
    });

function log(msg) {
    console.log(msg);
    fs.appendFileSync('debug.log', `[${new Date().toISOString()}] ${msg}\n`);
}

    // Registra atualizações de votos diretamente (Baileys v6 lida com msgs no array messages)
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        // Se a mensagem for a CRIAÇÃO de uma enquete (por nós ou outros), salva no cache
        const pollCreationMsg = msg.message.pollCreationMessage || msg.message.pollCreationMessageV2 || msg.message.pollCreationMessageV3;
        if (pollCreationMsg) {
            pollCache[msg.key.id] = msg;
            fs.writeFileSync(pollCacheFile, JSON.stringify(pollCache));
            log(`[+] Enquete Registrada na Memória: ${pollCreationMsg.name} (ID: ${msg.key.id})`);
            return;
        }

        // Se for um VOTO, ele é do tipo pollUpdateMessage
        if (msg.message.pollUpdateMessage) {
            const pollUpdate = msg.message.pollUpdateMessage;
            const pollId = pollUpdate.pollCreationMessageKey.id;
            
            log(`[INFO] Recebido update de enquete. Procurando ID ${pollId}`);
            
            // Busca a mensagem original que foi salva no nosso cache
            const pollCreation = pollCache[pollId];
            
            if (pollCreation) {
                try {
                    // Importa o decifrador nativo
                    const { decryptPollVote, jidNormalizedUser } = require('@whiskeysockets/baileys');
                    let pollCreatorJid = pollCreation.key.fromMe ? sock.user.id : (pollCreation.key.participant || pollCreation.key.remoteJid);
                    pollCreatorJid = jidNormalizedUser ? jidNormalizedUser(pollCreatorJid) : pollCreatorJid.replace(/:\d+/, '');
                    const voterKey = msg.key.participant || msg.key.remoteJid;

                    const decryptedVote = decryptPollVote(
                        pollUpdate.vote,
                        {
                            pollCreatorJid: pollCreatorJid,
                            pollMsgId: pollId,
                            pollEncKey: pollCreation.message?.messageContextInfo?.messageSecret,
                            voterJid: voterKey
                        }
                    );

                    // Inicializa o histórico de votos para esta enquete, se não existir
                    if (!pollCache[pollId].updates) pollCache[pollId].updates = {};
                    
                    // Adiciona/Atualiza o voto DESTE eleitor na nossa memória
                    pollCache[pollId].updates[voterKey] = {
                        pollUpdateMessageKey: msg.key,
                        vote: decryptedVote,
                        pushName: msg.pushName || ''
                    };

                    // Pega TODOS os votos registrados até agora para computar a enquete inteira
                    const allUpdates = Object.values(pollCache[pollId].updates);

                    // A mágica: Baileys descriptografa e conta os votos TOTAIS
                    const pollAggregated = getAggregateVotesInPollMessage({
                        message: pollCreation.message,
                        pollUpdates: allUpdates
                    });
                    
                    // Constrói um dicionário com os nomes reais das pessoas (para burlar identidades ocultas)
                    const voterNames = {};
                    for (const upd of allUpdates) {
                        const jid = upd.pollUpdateMessageKey.participant || upd.pollUpdateMessageKey.remoteJid;
                        voterNames[jid] = upd.pushName || jid.split('@')[0];
                    }
                    let remetenteRaw = msg.key.remoteJid || msg.key.participant || "";
                    if (msg.key.fromMe) remetenteRaw = sock.user.id;
                    const remetente = remetenteRaw.split('@')[0];
                    
                    const pcmData = pollCreation.message.pollCreationMessage || pollCreation.message.pollCreationMessageV2 || pollCreation.message.pollCreationMessageV3;

                    log(`[DEBUG] pollAggregated: ${JSON.stringify(pollAggregated)}`);

                    const pollData = {
                        evento: "voto_computado_baileys",
                        timestamp: new Date().toISOString(),
                        telefone: remetente,
                        voterNames: voterNames,
                        pollId: pollId,
                        pollNome: pcmData.name,
                        votos: pollAggregated // Array acumulada calculada pelo baileys
                    };

                    log(`[BAILEYS] Decifrou Voto (Poll: ${pollData.pollNome} | Eleitor: ${pollData.telefone})`);
                    
                    const axiosRes = await axios.post(WEBHOOK_URL, pollData, { timeout: 10000 });
                    log(`[WEBHOOK] Status HTTP do nosso servidor local: ${axiosRes.status}`);

                } catch (error) {
                    log(`[ERRO] Falha ao processar voto:\n${error.stack || error}`);
                }
            } else {
                log(`[-] Voto ignorado: Tentou votar em uma enquete (${pollId}) que não está na nossa memória.`);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

if (process.argv.includes('--clear-auth')) {
    console.log('Limpando dados de autenticação...');
    fs.rmSync('auth_info_baileys', { recursive: true, force: true });
    console.log('Finalizado. Reinicie sem a flag --clear-auth.');
    process.exit(0);
}

connectToWhatsApp();
