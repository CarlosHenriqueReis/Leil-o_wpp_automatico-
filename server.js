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
        const user = users.find(u => u.username === username);
        
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
 * ROTA 3: Upload de Imagens Direto no Servidor
 */
app.post('/api/upload', authenticateToken, upload.single('imagem'), (req, res) => {
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
// LIMPEZA AUTOMÁTICA DE IMAGENS (TODO DOMINGO 00:00)
// ==========================================
cron.schedule('0 0 * * 0', () => {
    console.log('[CRON] 🗑️  Iniciando limpeza semanal de imagens...');
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
        console.log(`[CRON] ✅ Limpeza concluída: ${count} imagem(ns) removida(s).`);
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
