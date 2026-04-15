# Guia de Implementação: Captura de Votos de Enquetes do WhatsApp com Baileys, Docker e n8n

## 1. Introdução

Este guia detalha como implementar um serviço em contêiner Docker, utilizando a biblioteca Baileys, para capturar votos de enquetes do WhatsApp e enviá-los para um webhook do n8n. Esta solução contorna as limitações da Evolution API na obtenção de dados de enquetes, proporcionando uma forma robusta e escalável de integrar essas informações ao seu dashboard.

## 2. Pré-requisitos

Para seguir este guia, você precisará ter os seguintes itens instalados e configurados:

*   **Docker e Docker Compose:** Para construir e gerenciar o contêiner do serviço.
*   **Node.js e npm (opcional):** Para testar o código localmente antes de dockerizar, ou para gerenciar dependências.
*   **n8n:** Uma instância do n8n (local ou em nuvem) configurada para receber webhooks.
*   **Conta WhatsApp:** Uma conta WhatsApp para ser conectada ao serviço Baileys.

## 3. Estrutura do Projeto

Crie uma pasta para o projeto, por exemplo, `baileys-poll-listener`, e dentro dela, os seguintes arquivos:

```
baileys-poll-listener/
├── package.json
├── index.js
└── Dockerfile
```

## 4. Código-Fonte (`index.js`)

Este arquivo contém a lógica principal para conectar ao WhatsApp via Baileys, ouvir eventos de mensagens e processar votos de enquetes. Ele enviará os dados processados para um webhook do n8n.

```javascript
import { makeWASocket, useMultiFileAuthState, getAggregateVotesInPollMessage, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import axios from 'axios';
import fs from 'fs';

const logger = pino({ level: 'silent' });

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'YOUR_N8N_WEBHOOK_URL_HERE';

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada devido a', lastDisconnect.error, ', reconectando', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log('Logout detectado. Por favor, remova a pasta auth_info_baileys e reinicie para um novo QR.');
            }
        } else if (connection === 'open') {
            console.log('Conexão aberta com sucesso!');
        }

        if (qr) {
            console.log('Novo QR Code gerado. Escaneie com seu WhatsApp:', qr);
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];

        if (!msg.message) return;

        if (msg.message.pollUpdateMessage) {
            const pollUpdate = msg.message.pollUpdateMessage;
            const pollCreation = msg.message.pollCreationMessage;

            if (pollCreation && pollUpdate) {
                try {
                    const pollAggregated = getAggregateVotesInPollMessage({
                        message: pollCreation,
                        pollUpdates: [pollUpdate]
                    });

                    const pollData = {
                        timestamp: msg.messageTimestamp,
                        sender: msg.key.remoteJid,
                        pollId: pollCreation.pollCreationMessage.id,
                        pollName: pollCreation.pollCreationMessage.name,
                        votes: pollAggregated.votes,
                    };

                    console.log('Voto de Enquete Recebido:', JSON.stringify(pollData, null, 2));

                    if (N8N_WEBHOOK_URL && N8N_WEBHOOK_URL !== 'YOUR_N8N_WEBHOOK_URL_HERE') {
                        await axios.post(N8N_WEBHOOK_URL, pollData);
                        console.log('Dados da enquete enviados para o n8n com sucesso!');
                    } else {
                        console.warn('N8N_WEBHOOK_URL não configurado. Os dados da enquete não foram enviados.');
                    }

                } catch (error) {
                    console.error('Erro ao processar voto de enquete:', error);
                }
            }
        } else if (msg.message.pollCreationMessage) {
            console.log('Enquete criada:', msg.message.pollCreationMessage.name);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

if (process.argv.includes('--clear-auth')) {
    console.log('Limpando dados de autenticação...');
    fs.rmSync('auth_info_baileys', { recursive: true, force: true });
    console.log('Dados de autenticação limpos. Reinicie o serviço para gerar um novo QR Code.');
    process.exit(0);
}

connectToWhatsApp();
```

## 5. Configuração do Projeto (`package.json`)

Este arquivo define as dependências do projeto e scripts para execução. As dependências incluem `@whiskeysockets/baileys` para a API do WhatsApp, `axios` para fazer requisições HTTP (para o n8n) e `pino` para logging.

```json
{
  "name": "baileys-poll-listener",
  "version": "1.0.0",
  "description": "Serviço para capturar votos de enquetes do WhatsApp via Baileys e enviar para n8n.",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "start": "node index.js"
  },
  "keywords": [
    "whatsapp",
    "baileys",
    "poll",
    "n8n",
    "webhook"
  ],
  "author": "Manus AI",
  "license": "MIT",
  "dependencies": {
    "@whiskeysockets/baileys": "^6.5.0",
    "axios": "^1.6.8",
    "pino": "^8.20.0"
  }
}
```

## 6. Dockerfile

O Dockerfile define como construir a imagem Docker para o seu serviço. Ele usa uma imagem base do Node.js, instala as dependências e copia o código-fonte.

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

ENV N8N_WEBHOOK_URL="YOUR_N8N_WEBHOOK_URL_HERE"

CMD ["npm", "start"]
```

**Observação:** Substitua `YOUR_N8N_WEBHOOK_URL_HERE` pela URL real do seu webhook do n8n. Você pode definir essa variável de ambiente ao executar o contêiner.

## 7. Construindo e Executando o Contêiner Docker

Siga os passos abaixo para construir a imagem Docker e executar o serviço:

1.  **Navegue até a pasta do projeto:**
    ```bash
    cd baileys-poll-listener
    ```

2.  **Construa a imagem Docker:**
    ```bash
    docker build -t baileys-poll-listener .
    ```

3.  **Execute o contêiner Docker:**
    ```bash
    docker run -it --name whatsapp-poll-service -v ./auth_info_baileys:/app/auth_info_baileys -e N8N_WEBHOOK_URL="SUA_URL_DO_WEBHOOK_N8N" baileys-poll-listener
    ```
    *   `--name whatsapp-poll-service`: Define um nome para o seu contêiner.
    *   `-v ./auth_info_baileys:/app/auth_info_baileys`: Mapeia um volume para persistir os dados de autenticação do WhatsApp. Isso é crucial para que você não precise escanear o QR Code toda vez que o contêiner for reiniciado.
    *   `-e N8N_WEBHOOK_URL="SUA_URL_DO_WEBHOOK_N8N"`: Define a variável de ambiente com a URL do seu webhook do n8n. **Lembre-se de substituir `SUA_URL_DO_WEBHOOK_N8N` pela URL real do seu webhook do n8n.**

4.  **Escaneie o QR Code:** Na primeira execução, o serviço irá gerar um QR Code no terminal. Escaneie-o com o seu aplicativo WhatsApp para autenticar a sessão.

    Se precisar gerar um novo QR Code (por exemplo, se a sessão expirar ou você quiser conectar outra conta), você pode parar o contêiner, remover a pasta `auth_info_baileys` e executá-lo novamente com o comando `--clear-auth`:
    ```bash
    docker stop whatsapp-poll-service
    docker rm whatsapp-poll-service
    rm -rf auth_info_baileys
    docker run -it --name whatsapp-poll-service -v ./auth_info_baileys:/app/auth_info_baileys -e N8N_WEBHOOK_URL="SUA_URL_DO_WEBHOOK_N8N" baileys-poll-listener npm run start -- --clear-auth
    ```

## 8. Configuração do n8n

No n8n, você precisará configurar um nó de `Webhook` para receber os dados enviados pelo serviço Baileys.

1.  **Crie um novo Workflow no n8n.**
2.  **Adicione um nó `Webhook`:** Configure-o para o método `POST` e copie a URL do webhook gerada. Esta é a URL que você usará na variável de ambiente `N8N_WEBHOOK_URL` do seu contêiner Docker.
3.  **Adicione nós de processamento:** Após o nó `Webhook`, você pode adicionar nós para processar os dados recebidos. Por exemplo:
    *   **`Function` ou `Code`:** Para transformar os dados da enquete para o formato desejado.
    *   **`Postgres`, `MySQL`, `MongoDB`:** Para armazenar os votos em um banco de dados.
    *   **`Google Sheets`, `Airtable`:** Para registrar os votos em planilhas.
    *   **`HTTP Request`:** Para enviar os dados para a API do seu dashboard.

    O payload recebido pelo n8n será similar a:
    ```json
    {
      "timestamp": 1678886400, // Exemplo de timestamp
      "sender": "5511999999999@s.whatsapp.net",
      "pollId": "ABCDEF1234567890",
      "pollName": "Qual sua opção favorita?",
      "votes": {
        "Opção A": 5,
        "Opção B": 3
      }
    }
    ```

## 9. Uso e Teste

1.  Certifique-se de que o contêiner Docker esteja em execução e autenticado com o WhatsApp.
2.  Crie uma enquete no WhatsApp a partir do número conectado ao serviço.
3.  Peça para algumas pessoas votarem na enquete.
4.  Observe o terminal do contêiner Docker e os logs do seu workflow no n8n. Você deverá ver os votos sendo capturados e processados.

## 10. Considerações Finais

*   **Persistência:** O uso do volume (`-v ./auth_info_baileys:/app/auth_info_baileys`) é fundamental para manter a sessão do WhatsApp ativa entre as reinicializações do contêiner. Certifique-se de que a pasta `auth_info_baileys` exista no mesmo diretório onde você executa o comando `docker run`.
*   **Segurança:** Mantenha a URL do seu webhook do n8n segura e evite expô-la publicamente sem necessidade.
*   **Monitoramento:** Implemente monitoramento para o seu contêiner Docker e para o workflow do n8n para garantir que o serviço esteja sempre ativo e funcionando corretamente.
*   **Escalabilidade:** Para ambientes de produção, considere soluções de orquestração de contêineres como Kubernetes ou Docker Swarm para gerenciar a escalabilidade e a alta disponibilidade do serviço.

Com este guia, você terá uma solução funcional para capturar dados de votos de enquetes do WhatsApp e integrá-los ao seu dashboard através do n8n, superando as limitações da Evolution API.

## 11. Referências

[1] Poll results not received – only message_update event is triggered · Issue #1644 · EvolutionAPI/evolution-api. Disponível em: [https://github.com/EvolutionAPI/evolution-api/issues/1644](https://github.com/EvolutionAPI/evolution-api/issues/1644)

[2] Reactions & Polls - Baileys - Mintlify. Disponível em: [https://www.mintlify.com/whiskeysockets/baileys/messages/reactions-polls](https://www.mintlify.com/whiskeysockets/baileys/messages/reactions-polls)

[3] Function: getAggregateVotesInPollMessage() - baileys.wiki. Disponível em: [https://baileys.wiki/docs/api/functions/getAggregateVotesInPollMessage/](https://baileys.wiki/docs/api/functions/getAggregateVotesInPollMessage/)
