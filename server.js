const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

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
// ROTAS DO BACKEND / INTEGRAÇÃO N8N
// ==========================================

/**
 * ROTA 1: Setup do Leilão
 * Recebe o JSON com os dados das cartas e dispara o n8n para iniciar o leilão.
 */
app.post('/api/start-leilao', async (req, res) => {
    try {
        const payload = req.body;
        const webhookUrl = process.env.WEBHOOK_START_LEILAO;
        
        console.log('[POST /api/start-leilao] Início do leilão solicitado.');
        console.log('Payload:', JSON.stringify(payload, null, 2));

        // Dispara o Webhook se a URL estiver configurada corretamente
        if (webhookUrl && webhookUrl.startsWith('http')) {
            console.log(`Enviando dados ao n8n: ${webhookUrl}`);
            await axios.post(webhookUrl, payload);
        } else {
            console.warn('Variável WEBHOOK_START_LEILAO não encontrada ou inválida. Simulando sucesso do servidor.');
        }

        return res.status(200).json({ success: true, message: 'Leilão iniciado! Dados enviados ao n8n.' });
    } catch (error) {
        console.error('Erro na rota /api/start-leilao:', error.message);
        return res.status(500).json({ success: false, message: 'Erro de comunicação ao iniciar o leilão no servidor.' });
    }
});

/**
 * ROTA 2: Cobrança dos Lances Vencedores
 * Recebe o JSON agrupado do cliente (telefone, cartas e total) e dispara a cobrança.
 */
app.post('/api/send-cobranca', async (req, res) => {
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
 * ROTA 3: Upload de Imagens Direto no Servidor
 */
app.post('/api/upload', upload.single('imagem'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
        }
        // Gera a URL pública para o frontend
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        
        res.status(200).json({ success: true, url: fileUrl });
    } catch (error) {
        console.error('Erro no upload:', error.message);
        res.status(500).json({ success: false, message: 'Falha no upload.' });
    }
});

// ==========================================
// INICIA O SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log(`===========================================`);
    console.log(`🚀 Servidor Dashboard TCG rodando`);
    console.log(`📍 URL Local: http://localhost:${PORT}`);
    console.log(`📝 Webhooks N8N configurados:`);
    console.log(`   Start: ${process.env.WEBHOOK_START_LEILAO || 'NÃO CONFIGURADO'}`);
    console.log(`   Cobranca: ${process.env.WEBHOOK_COBRANCA || 'NÃO CONFIGURADO'}`);
    console.log(`===========================================`);
});
