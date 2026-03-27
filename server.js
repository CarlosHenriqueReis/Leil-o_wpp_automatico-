const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cron = require('node-cron');
require('dotenv').config();

// Inicializa a base de usuários (cria o primeiro admin se não existir)
const USERS_FILE = path.join(__dirname, 'users.json');
if (!fs.existsSync(USERS_FILE)) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);
    const initialUsers = [
        { username: 'admin', passwordHash: hash, role: 'admin' },
        { username: 'operador', passwordHash: bcrypt.hashSync('operador123', salt), role: 'operador' }
    ];
    fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2));
}

// Inicializa a base temporária de Lances (mini banco de dados)
const LANCES_FILE = path.join(__dirname, 'lances.json');
if (!fs.existsSync(LANCES_FILE)) {
    fs.writeFileSync(LANCES_FILE, JSON.stringify({}, null, 2));
}

// Inicializa a base de Rascunhos de Leilão
const RASCUNHOS_FILE = path.join(__dirname, 'rascunhos.json');
if (!fs.existsSync(RASCUNHOS_FILE)) {
    fs.writeFileSync(RASCUNHOS_FILE, JSON.stringify([], null, 2));
}

// Inicializa a base de Histórico de Cobranças
const COBRANCAS_FILE = path.join(__dirname, 'cobrancas.json');
if (!fs.existsSync(COBRANCAS_FILE)) {
    fs.writeFileSync(COBRANCAS_FILE, JSON.stringify([], null, 2));
}

// Inicializa o registro de enquetes ativas (pollId → cartaInfo)
const ENQUETES_FILE = path.join(__dirname, 'enquetes.json');
if (!fs.existsSync(ENQUETES_FILE)) {
    fs.writeFileSync(ENQUETES_FILE, JSON.stringify([], null, 2));
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-key-pokemon-leilao-secret';

// Middleware de Autenticação
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ success: false, message: 'Acesso negado: Token não fornecido.' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Sessão expirada ou token inválido.' });
        req.user = user;
        next();
    });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Garante que a pasta uploads existe
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configura o Multer (para receber arquivos locais)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'))
  }
});
const upload = multer({ storage: storage });

// ==========================================
// MIDDLEWARES DE CONFIGURAÇÃO
// ==========================================
// Habilita recebimento de JSON (corpo da requisição)
app.use(express.json());
// Habilita CORS
app.use(cors());
// Serve os arquivos do front-end contidos na pasta "public"
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// ROTAS DO BACKEND / INTEGRAÇÃO N8N E LOGIN
// ==========================================

/**
 * ROTA: Login de Usuários
 */
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Usuário e senha obrigatórios.' });
    
    try {
        const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        
        if (!user) return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
        
        const validPassword = bcrypt.compareSync(password, user.passwordHash);
        if (!validPassword) return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
        
        const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
        
        res.json({ success: true, token, username: user.username, role: user.role });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});

/**
 * ROTA 1: Setup do Leilão
 * Recebe o JSON com os dados das cartas e dispara o n8n para iniciar o leilão.
 */
app.post('/api/start-leilao', authenticateToken, async (req, res) => {
    try {
        const payload = req.body;
        const webhookUrl = process.env.WEBHOOK_START_LEILAO;
        
        console.log('[POST /api/start-leilao] Início do leilão solicitado.');

        // Converter imagens para base64 para o N8N não precisar fazer download
        if (payload.arrayLotes && Array.isArray(payload.arrayLotes)) {
            for (const lote of payload.arrayLotes) {
                if (lote.imagem && lote.imagem.includes('/uploads/')) {
                    try {
                        const filename = lote.imagem.split('/uploads/').pop().split('?')[0];
                        const filePath = path.join(uploadDir, filename);
                        
                        if (fs.existsSync(filePath)) {
                            const imgBuffer = fs.readFileSync(filePath);
                            lote.imagem = imgBuffer.toString('base64');
                        }
                    } catch (imgErr) {
                        console.error(`[start-leilao] ❌ Erro ao converter imagem: ${imgErr.message}`);
                    }
                }
            }
        }

        // Dispara o Webhook se a URL estiver configurada
        if (webhookUrl && webhookUrl.startsWith('http')) {
            console.log(`Enviando dados ao n8n: ${webhookUrl}`);
            // Fire and forget so we don't timeout the frontend
            axios.post(webhookUrl, payload, { timeout: 30000 }).catch(e => console.error('Erro no N8N webhook:', e.message));
        }

        return res.status(200).json({ success: true, message: 'Leilão enviado ao N8N para processamento em loop!' });
    } catch (error) {
        console.error('Erro na rota /api/start-leilao:', error.message);
        return res.status(500).json({ success: false, message: 'Erro de comunicação ao iniciar o leilão no servidor.' });
    }
});



/**
 * ROTA 2: Cobrança dos Lances Vencedores
 * Recebe o JSON agrupado do cliente (telefone, cartas e total) e dispara a cobrança.
 */
app.post('/api/send-cobranca', authenticateToken, async (req, res) => {
    try {
        const payload = req.body;
        const webhookUrl = process.env.WEBHOOK_COBRANCA;

        console.log('[POST /api/send-cobranca] Envio de cobrança solicitado.');
        console.log('Payload:', JSON.stringify(payload, null, 2));

        // Dispara o Webhook se a URL estiver configurada corretamente
        if (webhookUrl && webhookUrl.startsWith('http')) {
            console.log(`Enviando cobrança ao n8n: ${webhookUrl}`);
            await axios.post(webhookUrl, payload);
        } else {
            console.warn('Variável WEBHOOK_COBRANCA não encontrada ou inválida. Simulando sucesso do servidor.');
        }

        return res.status(200).json({ success: true, message: 'Cobrança encaminhada com sucesso via n8n!' });
    } catch (error) {
        console.error('Erro na rota /api/send-cobranca:', error.message);
        return res.status(500).json({ success: false, message: 'Erro de comunicação ao enviar a cobrança.' });
    }
});

/**
 * ROTA WEBHOOK: Registrar Enquete (chamada pelo N8N após enviar cada poll)
 * Salva a associação pollId -> carta no enquetes.json
 * Não requer autenticação pois é chamada pela rede interna do Docker
 */
app.post('/api/webhook/registra-enquete', async (req, res) => {
    try {
        const { pollId, nomeDaCarta, valorBase } = req.body;
        if (!pollId || !nomeDaCarta) {
            return res.status(400).json({ success: false, message: 'pollId e nomeDaCarta são obrigatórios.' });
        }
        const enquetes = JSON.parse(fs.readFileSync(ENQUETES_FILE, 'utf8'));
        // Remove duplicata caso reenvie
        const idx = enquetes.findIndex(e => e.pollId === pollId);
        const entry = { pollId, nomeDaCarta, valorBase: valorBase || 0, criadoEm: new Date().toISOString() };
        if (idx >= 0) enquetes[idx] = entry; else enquetes.push(entry);
        fs.writeFileSync(ENQUETES_FILE, JSON.stringify(enquetes, null, 2));
        console.log(`[ENQUETE REGISTRADA] ${nomeDaCarta} — pollId: ${pollId}`);
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Erro ao registrar enquete:', error.message);
        return res.status(500).json({ success: false });
    }
});

/**
 * ROTA WEBHOOK: Registrar Voto (chamada pelo N8N ao receber MESSAGES_UPDATE)
/**
 * ROTA DEBUG: Capturar payload bruto dos webhooks para inspeção
 */
app.post('/api/webhook/debug-payload', (req, res) => {
    const entry = { ts: new Date().toISOString(), ...req.body };
    const debugFile = path.join(__dirname, 'debug_payloads.json');
    let payloads = [];
    try { payloads = JSON.parse(fs.readFileSync(debugFile, 'utf8')); } catch(e) {}
    payloads.unshift(entry);
    if (payloads.length > 100) payloads = payloads.slice(0, 100); // Guarda últimos 100
    fs.writeFileSync(debugFile, JSON.stringify(payloads, null, 2));
    console.log(`[DEBUG PAYLOAD] evento=${entry.evento} salvo em debug_payloads.json`);
    res.status(200).json({ ok: true });
});

/**
 * ROTA DEBUG: Consultar payloads capturados
 */
app.get('/api/webhook/debug-payload', authenticateToken, (req, res) => {
    const debugFile = path.join(__dirname, 'debug_payloads.json');
    try {
        const payloads = JSON.parse(fs.readFileSync(debugFile, 'utf8'));
        res.status(200).json({ payloads });
    } catch(e) {
        res.status(200).json({ payloads: [] });
    }
});

/**
 * ROTA WEBHOOK: Registrar Voto — valida o pollId, identifica a carta e salva o lance.
 */
app.post('/api/webhook/voto', async (req, res) => {
    try {
        const { pollId, votante, opcaoEscolhida } = req.body;
        if (!pollId || !votante || !opcaoEscolhida) {
            return res.status(400).json({ success: false, message: 'Campos obrigatórios faltando.' });
        }
        // Verifica se o pollId pertence a uma enquete do nosso leilão
        const enquetes = JSON.parse(fs.readFileSync(ENQUETES_FILE, 'utf8'));
        const enquete = enquetes.find(e => e.pollId === pollId);
        if (!enquete) {
            console.log(`[VOTO IGNORADO] pollId desconhecido: ${pollId}`);
            return res.status(200).json({ success: true, ignorado: true });
        }
        // Extrai o valor numérico da opção escolhida (ex: "R$ 150" -> 150)
        const valorStr = opcaoEscolhida.replace(/[^0-9,\.]/g, '').replace(',', '.');
        const valor = parseFloat(valorStr) || 0;
        // Salva/atualiza o lance no lances.json
        let lances = JSON.parse(fs.readFileSync(LANCES_FILE, 'utf8'));
        if (!Array.isArray(lances)) lances = [];
        // Remove lance anterior do mesmo votante na mesma carta (último voto vence)
        const filtrado = lances.filter(l => !(l.votante === votante && l.nomeDaCarta === enquete.nomeDaCarta));
        filtrado.push({
            pollId,
            nomeDaCarta: enquete.nomeDaCarta,
            votante: votante.replace(/\D/g, ''),
            opcaoEscolhida,
            valor,
            ts: new Date().toISOString()
        });
        fs.writeFileSync(LANCES_FILE, JSON.stringify(filtrado, null, 2));
        console.log(`[LANCE REGISTRADO] ${enquete.nomeDaCarta} — ${votante} → ${opcaoEscolhida} (R$ ${valor})`);
        return res.status(200).json({ success: true, carta: enquete.nomeDaCarta, valor });
    } catch (error) {
        console.error('Erro ao registrar voto:', error.message);
        return res.status(500).json({ success: false });
    }
});

/**
 * ROTA: Retornar lances atuais (para o dashboard consultar)
 */
app.get('/api/lances', authenticateToken, (req, res) => {
    try {
        const lances = JSON.parse(fs.readFileSync(LANCES_FILE, 'utf8'));
        res.status(200).json({ success: true, lances: Array.isArray(lances) ? lances : [] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao ler lances.' });
    }
});

/**
 * ROTAS DE RASCUNHOS (SALVAR/CARREGAR)
 */
app.get('/api/rascunhos', authenticateToken, (req, res) => {
    try {
        const data = fs.readFileSync(RASCUNHOS_FILE, 'utf8');
        res.status(200).json({ success: true, rascunhos: JSON.parse(data) });
    } catch (error) {
        console.error('Erro ao ler rascunhos:', error);
        res.status(500).json({ success: false, message: 'Erro ao carregar rascunhos.' });
    }
});

app.post('/api/rascunhos', authenticateToken, (req, res) => {
    try {
        const novoRascunho = req.body; // { id: 123, nome: 'Nome', cartas: [...] }
        let rascunhos = JSON.parse(fs.readFileSync(RASCUNHOS_FILE, 'utf8'));
        
        // Verifica se já existe, se sim atualiza, se não cria novo
        const existingIndex = rascunhos.findIndex(r => r.id === novoRascunho.id);
        if (existingIndex >= 0) {
            rascunhos[existingIndex] = novoRascunho;
        } else {
            rascunhos.unshift(novoRascunho);
        }
        
        fs.writeFileSync(RASCUNHOS_FILE, JSON.stringify(rascunhos, null, 2));
        res.status(200).json({ success: true, message: 'Rascunho salvo com sucesso.' });
    } catch (error) {
        console.error('Erro ao salvar rascunho:', error);
        res.status(500).json({ success: false, message: 'Erro ao salvar rascunho.' });
    }
});

/**
 * ROTA 3: Finalizar Leilão e Trazer Resultados
 * Varre o lances.json e calcula quem ganhou cada carta, e salva no histórico.
 */
app.post('/api/resultados-leilao', authenticateToken, (req, res) => {
    try {
        const { nome_leilao } = req.body || {};
        const lancesDB = JSON.parse(fs.readFileSync(LANCES_FILE, 'utf8'));
        const resultados = {
            ganhadores: [],
            nao_vendidas: []
        };

        for (const [pollId, dadosCarta] of Object.entries(lancesDB)) {
            const nomeCarta = dadosCarta.nome_carta;
            const votos = dadosCarta.votos || [];

            if (votos.length === 0) {
                resultados.nao_vendidas.push(nomeCarta);
            } else {
                votos.sort((a, b) => {
                    if (b.valorParsed !== a.valorParsed) return b.valorParsed - a.valorParsed;
                    return new Date(a.timestamp) - new Date(b.timestamp);
                });
                const vencedor = votos[0];
                resultados.ganhadores.push({
                    id_carta: pollId,
                    nome_carta: nomeCarta,
                    valor_vencedor: vencedor.valorParsed,
                    telefone_ganhador: vencedor.telefone
                });
            }
        }

        // Agrupar cobrancas por cliente para salvar no historico
        const grouped = {};
        resultados.ganhadores.forEach(item => {
            const phone = item.telefone_ganhador;
            if (!grouped[phone]) {
                grouped[phone] = { telefone: phone, status_pagamento: 'pendente', cartas: [], subtotal: 0 };
            }
            grouped[phone].cartas.push({ nome: item.nome_carta, valor: item.valor_vencedor });
            grouped[phone].subtotal += item.valor_vencedor;
        });
        const clientesArray = Object.values(grouped);

        const cobrancaObj = {
            id: Date.now().toString(),
            nome_leilao: nome_leilao || `Leilão ${new Date().toLocaleDateString('pt-BR')}`,
            data: new Date().toISOString(),
            nao_vendidas: resultados.nao_vendidas,
            clientes: clientesArray
        };

        // Salvar no historico
        const cobrancasDB = JSON.parse(fs.readFileSync(COBRANCAS_FILE, 'utf8'));
        cobrancasDB.unshift(cobrancaObj);
        fs.writeFileSync(COBRANCAS_FILE, JSON.stringify(cobrancasDB, null, 2));

        // Limpa o banco de lances para o proximo leilao
        fs.writeFileSync(LANCES_FILE, JSON.stringify({}, null, 2));

        return res.status(200).json({ success: true, data: cobrancaObj });
    } catch (error) {
        console.error('Erro ao finalizar leilão:', error.message);
        return res.status(500).json({ success: false, message: 'Erro ao processar os resultados.' });
    }
});

/**
 * ROTAS DE HISTORICO DE COBRANÇAS
 */
app.get('/api/cobrancas', authenticateToken, (req, res) => {
    try {
        const data = fs.readFileSync(COBRANCAS_FILE, 'utf8');
        res.status(200).json({ success: true, cobrancas: JSON.parse(data) });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Erro ao ler cobranças.' });
    }
});

app.post('/api/cobrancas/:leilaoId/pago', authenticateToken, (req, res) => {
    try {
        const { telefone, status } = req.body; // status: 'pago' ou 'pendente'
        const leilaoId = req.params.leilaoId;
        
        let cobrancasDB = JSON.parse(fs.readFileSync(COBRANCAS_FILE, 'utf8'));
        const idx = cobrancasDB.findIndex(c => c.id === leilaoId);
        
        if (idx === -1) return res.status(404).json({ success: false, message: 'Leilão não encontrado.' });
        
        const clientIdx = cobrancasDB[idx].clientes.findIndex(c => c.telefone === telefone);
        if (clientIdx === -1) return res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
        
        cobrancasDB[idx].clientes[clientIdx].status_pagamento = status;
        fs.writeFileSync(COBRANCAS_FILE, JSON.stringify(cobrancasDB, null, 2));
        
        res.status(200).json({ success: true, message: 'Status atualizado com sucesso.' });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Erro ao atualizar pagamento.' });
    }
});

/**
 * ROTA 4: Upload de Imagens Direto no Servidor
 */
app.post('/api/upload', authenticateToken, upload.single('imagem'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
        }
        // URL base em produção
        const baseUrl = 'https://pokeleilao.com.br';
        const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;
        
        res.status(200).json({ success: true, url: fileUrl, urlDocker: fileUrl });
    } catch (error) {
        console.error('Erro no upload:', error.message);
        res.status(500).json({ success: false, message: 'Falha no upload.' });
    }
});

// ==========================================
// LIMPEZA AUTOMÁTICA DE IMAGENS (> 7 DIAS)
// ==========================================
// Roda todo dia às 03:00 da manhã
cron.schedule('0 3 * * *', () => {
    console.log('[CRON] 🗑️  Verificando imagens antigas (> 7 dias)...');
    try {
        const files = fs.readdirSync(uploadDir);
        let count = 0;
        const now = Date.now();
        const seteDiasEmMs = 7 * 24 * 60 * 60 * 1000;

        files.forEach(file => {
            const filePath = path.join(uploadDir, file);
            const stats = fs.statSync(filePath);
            
            if (stats.isFile()) {
                const age = now - stats.mtimeMs;
                if (age > seteDiasEmMs) {
                    fs.unlinkSync(filePath);
                    count++;
                }
            }
        });
        console.log(`[CRON] ✅ Verificação concluída: ${count} imagem(ns) antiga(s) removida(s).`);
    } catch (err) {
        console.error('[CRON] ❌ Erro na limpeza de imagens:', err.message);
    }
}, {
    timezone: 'America/Sao_Paulo'
});

// ==========================================
// ROTA MANUAL: Limpar imagens (só admin)
// ==========================================
app.delete('/api/clear-uploads', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Apenas administradores podem executar esta ação.' });
    }
    try {
        const files = fs.readdirSync(uploadDir);
        let count = 0;
        files.forEach(file => {
            const filePath = path.join(uploadDir, file);
            if (fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
                count++;
            }
        });
        res.json({ success: true, message: `${count} imagem(ns) removida(s) com sucesso.` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erro ao limpar imagens.' });
    }
});

/**
 * ==========================================
 * ROTAS DE WHATSAPP (CAPTAR VOTOS DA ENQUETE)
 * ==========================================
 */
app.post('/api/webhook/votos', (req, res) => {
    // Retorna 200 rápido para a Evolution API não travar a fila
    res.status(200).send('OK');

    try {
        const body = req.body;
        // Salvar payload para debug
        fs.appendFileSync('debug_webhook.log', JSON.stringify(body) + '\n');
        console.log("[WEBHOOK EVOLUTION] Recebeu evento: ", body.event || body.event_type || 'Desconhecido');

        // A Evolution dispara eventos 'messages.upsert' e dentro deles pode ter atualizações de enquete
        if (body.event === 'messages.update' || body.event === 'messages.upsert' || body.event === 'MESSAGES_UPDATE' || body.event === 'MESSAGES_UPSERT') {
            const msgData = body.data;
            if (!msgData) return;

            // Tratamento simplificado para capturar a estrutura da mensagem
            // A estrutura exata do JSON varia dependendo da versão da API, vamos verificar a mais comum de "pollUpdates"
            let pollUpdates = msgData.message?.pollUpdates;
            
            // Tratamento no formato Evolution API v1.x (onde vem como array no data ou dentro do message)
            if (Array.isArray(msgData) && msgData[0]?.update?.pollUpdates) {
                pollUpdates = msgData[0].update.pollUpdates;
            } else if (msgData.pollUpdates) {
                pollUpdates = msgData.pollUpdates;
            }

            if (pollUpdates && pollUpdates.length > 0) {
                // É um voto numa enquete!
                console.log(`[!] Voto de enquete detectado! Vamos registrá-lo.`);
                
                // Puxar banco de dados local
                const lancesDB = JSON.parse(fs.readFileSync(LANCES_FILE, 'utf8'));
                
                // O pollUpdates é um array, vamos iterar sobre ele
                for (const vote of pollUpdates) {
                    const voterGid = vote.pollUpdateMessageKey?.participant || msgData.key?.participant || msgData.key?.remoteJid || body.sender;
                    // Limpar numero do formato WhatsApp (ex: 5511999999999@s.whatsapp.net -> 5511999999999)
                    const voterNumber = voterGid ? voterGid.split('@')[0] : 'Desconhecido';
                    
                    // Identificador da enquete (para sabermos de qual grupo e carta pertence o voto)
                    const pollId = vote.pollUpdateMessageKey?.id || 'id_desconhecido';
                    
                    // Os nomes exatos das opções votadas
                    const selectedOptions = vote.vote?.selectedOptions || [];
                    
                    if (!lancesDB[pollId]) {
                        lancesDB[pollId] = {
                            nome_carta: "Carta Desconhecida", // Depois faremos o cruzamento reverso
                            votos: []
                        };
                    }

                    // Se a pessoa desmarcou todas as opções e o selectedOptions for vazio, removemos votos passados da pessoa
                    if (selectedOptions.length === 0) {
                        lancesDB[pollId].votos = lancesDB[pollId].votos.filter(v => v.telefone !== voterNumber);
                    } else {
                        // Filtramos o voto antigo dessa pessoa nesta mesma enquete (caso ela tenha mudado de ideia e votado de novo)
                        lancesDB[pollId].votos = lancesDB[pollId].votos.filter(v => v.telefone !== voterNumber);
                        
                        // Registramos o novo voto (assumindo a primeira opcao pra simplificar, ou percorrendo todas se houver votos multiplos)
                        for (const opt of selectedOptions) {
                            lancesDB[pollId].votos.push({
                                telefone: voterNumber,
                                opcaoStr: opt, // ex: "R$ 100" ou "É minha por R$ 140"
                                valorParsed: parseFloat(opt.replace(/[^0-9,.]/g, '').replace(',', '.')) || 0,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                }
                
                // Salva no pseudo-banco de dados
                fs.writeFileSync(LANCES_FILE, JSON.stringify(lancesDB, null, 2));
                console.log(`[!] Banco de lances temporário atualizado.`);
            }
        }

    } catch (e) {
        console.error('[ERRO WEBHOOK] Falha ao processar voto da Evolution: ', e);
    }
});

/**
 * ==========================================
 * ROTA N8N -> SALVAR ID E NOME DA ENQUETE
 * ==========================================
 * O n8n vai bater aqui para nos dizer qual o nome real do
 * lote cujo mensagem acabou de enviar para a Evolution API
 */
app.post('/api/webhook/registra-enquete', (req, res) => {
    try {
        const payload = req.body;
        // Esperamos um JSON no formato: {"pollId": "BA3F92X8", "nomeDaCarta": "Leafeon-V"}
        if (!payload || !payload.pollId || !payload.nomeDaCarta) {
            return res.status(400).json({ success: false, message: 'Dados insuficientes. Faltam pollId ou nomeDaCarta.' });
        }

        const lancesDB = JSON.parse(fs.readFileSync(LANCES_FILE, 'utf8'));

        // Se essa enquete já tinha votos fantasmas captados antes dessa rota ser chamada, não apaga. Só atualiza nome.
        if (!lancesDB[payload.pollId]) {
            lancesDB[payload.pollId] = { "nome_carta": payload.nomeDaCarta, "votos": [] };
        } else {
            lancesDB[payload.pollId].nome_carta = payload.nomeDaCarta;
        }

        fs.writeFileSync(LANCES_FILE, JSON.stringify(lancesDB, null, 2));

        console.log(`[!] Enquete registrada com nome. ID: ${payload.pollId} = ${payload.nomeDaCarta}`);
        return res.status(200).json({ success: true, message: 'Enquete mapeada internamente.' });

    } catch (e) {
        console.error('[ERRO REGISTRA] Falha ao parear nome e enquete via n8n:', e);
        return res.status(500).json({ success: false, message: 'Erro interno.' });
    }
});



// ==========================================
// INICIA O SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log(`===========================================`);
    console.log(`🚀 Servidor PokéLeilão rodando`);
    console.log(`📍 URL Local: http://localhost:${PORT}`);
    console.log(`📝 Webhooks N8N configurados:`);
    console.log(`   Start: ${process.env.WEBHOOK_START_LEILAO || 'NÃO CONFIGURADO'}`);
    console.log(`   Cobranca: ${process.env.WEBHOOK_COBRANCA || 'NÃO CONFIGURADO'}`);
    console.log(`🗑️  Limpeza de imagens: Todo Domingo 00:00 (São Paulo)`);
    console.log(`===========================================`);
});
