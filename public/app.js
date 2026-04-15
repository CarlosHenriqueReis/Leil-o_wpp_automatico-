/* =======================================================
   AUTENTICAÇÃO E SEGURANÇA
   ======================================================= */
function checkAuth() {
    const token = localStorage.getItem('poke_token');
    const username = localStorage.getItem('poke_user');
    const loginScreen = document.getElementById('login-screen');
    const appContent = document.getElementById('app-content');
    const userDisplay = document.getElementById('user-display');
    const body = document.body;

    if (token) {
        loginScreen.classList.add('hidden');
        appContent.classList.remove('hidden');
        appContent.classList.add('flex');
        body.classList.remove('overflow-hidden');
        if (userDisplay && username) userDisplay.textContent = `User: ${username}`;
    } else {
        loginScreen.classList.remove('hidden');
        appContent.classList.add('hidden');
        appContent.classList.remove('flex');
        body.classList.add('overflow-hidden');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-login');
    const originalContent = btn.innerHTML;
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    btn.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline block" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Validando...`;
    btn.disabled = true;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            localStorage.setItem('poke_token', data.token);
            localStorage.setItem('poke_user', data.username);
            showToast('Login efetuado com sucesso!', 'success');
            checkAuth();
        } else {
            showToast(data.message || 'Credenciais inválidas.', 'error');
        }
    } catch (err) {
        showToast('Erro ao conectar com o servidor.', 'error');
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

function handleLogout() {
    localStorage.removeItem('poke_token');
    localStorage.removeItem('poke_user');
    checkAuth();
    showToast('Sessão encerrada.', 'info');
}

/* =======================================================
   PROTEÇÃO DE CÓDIGO BÁSICA (Evitar cópia)
   ======================================================= */
document.addEventListener('contextmenu', event => event.preventDefault());

document.addEventListener('keydown', function(e) {
    // Bloqueia F12
    if(e.key === 'F12') {
        e.preventDefault();
    }
    // Bloqueia Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+U
    if(e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) {
        e.preventDefault();
    }
    if(e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
    }
});

/* =======================================================
   GERENCIAMENTO DE CONFIGURAÇÕES E DADOS
   ======================================================= */
let G_PERCS = [80, 105, 120, 140, 160];
let G_NUM_OPTIONS = 5;

function initSettings() {
    const saved = localStorage.getItem('poke_percs');
    const savedNum = localStorage.getItem('poke_num_options');
    if (saved) {
        G_PERCS = JSON.parse(saved);
    }
    if (savedNum) {
        G_NUM_OPTIONS = parseInt(savedNum) || 5;
    }
}

function loadSettingsToForm() {
    document.getElementById('cfg-num-options').value = G_NUM_OPTIONS;
    document.getElementById('cfg-opt1').value = G_PERCS[0];
    document.getElementById('cfg-opt2').value = G_PERCS[1];
    document.getElementById('cfg-opt3').value = G_PERCS[2];
    document.getElementById('cfg-opt4').value = G_PERCS[3];
    document.getElementById('cfg-opt5').value = G_PERCS[4];
    toggleConfigOptions();
}

function toggleConfigOptions() {
    const num = parseInt(document.getElementById('cfg-num-options').value) || 5;
    for (let i = 1; i <= 5; i++) {
        const wrap = document.getElementById('cfg-wrap-' + i);
        if (wrap) {
            wrap.style.display = i <= num ? 'flex' : 'none';
        }
    }
}

function saveSettings(e) {
    if(e) e.preventDefault();
    const num = parseInt(document.getElementById('cfg-num-options').value) || 5;
    const p1 = parseFloat(document.getElementById('cfg-opt1').value) || 0;
    const p2 = parseFloat(document.getElementById('cfg-opt2').value) || 0;
    const p3 = parseFloat(document.getElementById('cfg-opt3').value) || 0;
    const p4 = parseFloat(document.getElementById('cfg-opt4').value) || 0;
    const p5 = parseFloat(document.getElementById('cfg-opt5').value) || 0;
    
    G_PERCS = [p1, p2, p3, p4, p5];
    G_NUM_OPTIONS = num;
    localStorage.setItem('poke_percs', JSON.stringify(G_PERCS));
    localStorage.setItem('poke_num_options', G_NUM_OPTIONS.toString());
    
    showToast('Configurações salvas! Aplicando...', 'success');
    
    // Força o reload após salvar para atualizar a tela automaticamente
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

/* =======================================================
   GERENCIAMENTO DE ABAS (TABS)
   ======================================================= */
function switchTab(tab) {
    const btnSetup = document.getElementById('tab-setup');
    const btnResults = document.getElementById('tab-results');
    const btnEnvios = document.getElementById('tab-envios');
    const btnConfig = document.getElementById('tab-config');
    const secSetup = document.getElementById('section-setup');
    const secResults = document.getElementById('section-results');
    const secEnvios = document.getElementById('section-envios');
    const secConfig = document.getElementById('section-config');

    // Reseta todas
    [btnSetup, btnResults, btnEnvios, btnConfig].forEach(btn => btn && (btn.className = 'h-full px-2 tab-inactive flex items-center transition-colors'));
    [secSetup, secResults, secEnvios, secConfig].forEach(sec => sec && sec.classList.add('hidden'));

    if (tab === 'setup') {
        if(btnSetup) btnSetup.className = 'h-full px-2 tab-active flex items-center transition-colors';
        if(secSetup) secSetup.classList.remove('hidden');
    } else if (tab === 'results') {
        if(btnResults) btnResults.className = 'h-full px-2 tab-active flex items-center transition-colors';
        if(secResults) secResults.classList.remove('hidden');
        loadWinners();
    } else if (tab === 'envios') {
        if(btnEnvios) btnEnvios.className = 'h-full px-2 tab-active flex items-center transition-colors';
        if(secEnvios) secEnvios.classList.remove('hidden');
        loadEnvios();
    } else if (tab === 'config') {
        if(btnConfig) btnConfig.className = 'h-full px-2 tab-active flex items-center transition-colors';
        if(secConfig) secConfig.classList.remove('hidden');
        loadSettingsToForm();
    }
}

/* =======================================================
   SEÇÃO 1: SETUP DO LEILÃO
   ======================================================= */
// Adiciona um card em branco ao container
function addCardForm() {
    const container = document.getElementById('cards-container');
    const template = document.getElementById('card-template');
    const clone = template.content.cloneNode(true);
    
    // Atualiza as labels no clone
    const labels1 = clone.querySelector('.label-opt1'); if(labels1) labels1.textContent = G_PERCS[0] + '%';
    const labels2 = clone.querySelector('.label-opt2'); if(labels2) labels2.textContent = G_PERCS[1] + '%';
    const labels3 = clone.querySelector('.label-opt3'); if(labels3) labels3.textContent = G_PERCS[2] + '%';
    const labels4 = clone.querySelector('.label-opt4'); if(labels4) labels4.textContent = G_PERCS[3] + '%';
    const labels5 = clone.querySelector('.label-opt5'); if(labels5) labels5.textContent = G_PERCS[4] + '%';
    
    // Mostra/Oculta de acordo com o numOptions e ajusta os textos de "E minha por"
    for (let i = 1; i <= 5; i++) {
        const wrap = clone.querySelector('.wrap-opt' + i);
        const hint = clone.querySelector('.hint-opt' + i);
        if (wrap) {
            if (i <= G_NUM_OPTIONS) {
                wrap.classList.remove('hidden');
                wrap.classList.add('flex');
                if (hint) {
                    // Se for a última ativa, recebe o texto "É minha por R$"
                    hint.textContent = (i === G_NUM_OPTIONS) ? 'É minha por R$' : 'R$';
                }
            } else {
                wrap.classList.remove('flex');
                wrap.classList.add('hidden');
            }
        }
    }
    
    // Animação entrada opcional, se precisar adicionar classes depois
    container.appendChild(clone);
}

// Remove card específico
function removeCard(btn) {
    const card = btn.closest('.bg-white');
    // Animação de saída simples antes de remover
    card.style.opacity = '0';
    card.style.transform = 'scale(0.98)';
    setTimeout(() => card.remove(), 200);
}

// Atualiza preview da imagem
function updatePreview(input) {
    const card = input.closest('.bg-white');
    const preview = card.querySelector('.card-img-preview');
    const placeholder = card.querySelector('.img-placeholder');
    
    if (input.value && input.value.startsWith('http')) {
        preview.src = input.value;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
    } else {
        preview.classList.add('hidden');
        placeholder.classList.remove('hidden');
    }
}

// Adiciona multiplas cartas
function addMultiCards() {
    for (let i = 0; i < 10; i++) {
        addCardForm();
    }
    showToast('10 cartas adicionadas com sucesso!', 'success');
}

// Upload local do arquivo via API do servidor Node
async function uploadImage(input) {
    const file = input.files[0];
    if (!file) return;

    const card = input.closest('.bg-white');
    const urlInput = card.querySelector('.card-img-url');
    const placeholder = card.querySelector('.img-placeholder');
    const originalText = placeholder.innerHTML;

    // Loading indicativo no lugar da imagem
    placeholder.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-400 mb-1"></div> Subindo...`;
    
    const formData = new FormData();
    formData.append('imagem', file);

    try {
        const token = localStorage.getItem('poke_token');
        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const result = await response.json();
        if (response.ok && result.url) {
            urlInput.value = result.url; // URL local para preview no browser
            urlInput.dataset.urlDocker = result.urlDocker || result.url; // URL para o Docker/n8n
            updatePreview(urlInput);
            showToast('Imagem processada pelo servidor!', 'success');
        } else {
            showToast('Falha: ' + (result.message || response.statusText), 'error');
            console.error(result);
            placeholder.innerHTML = originalText;
        }
    } catch(e) {
        console.error(e);
        showToast('Servidor offline ou sem resposta.', 'error');
        placeholder.innerHTML = originalText;
    }
    
    // Limpa o input escondido
    input.value = '';
}

// Formata valor financeiro pt-BR sem centavos
function formatString(v) {
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Lógica de cálculo customizável com garantias
function calculateOptions(input) {
    const card = input.closest('.bg-white');
    const optionsContainer = card.querySelector('.card-options');
    const val = parseFloat(input.value);
    
    if (!isNaN(val) && val > 0) {
        optionsContainer.classList.remove('opacity-50', 'grayscale');
        
        let v1 = Math.round(val * (G_PERCS[0] / 100));
        let v2 = Math.round(val * (G_PERCS[1] / 100));
        let v3 = Math.round(val * (G_PERCS[2] / 100));
        let v4 = Math.round(val * (G_PERCS[3] / 100));
        let v5 = Math.round(val * (G_PERCS[4] / 100));
        
        // Garante que o lance sempre suba pelo menos R$ 1 para não repetir lances (ex: R$ 2)
        v2 = Math.max(v2, v1 + 1);
        v3 = Math.max(v3, v2 + 1);
        v4 = Math.max(v4, v3 + 1);
        v5 = Math.max(v5, v4 + 1);
        
        card.querySelector('.opt-1').value = v1;
        card.querySelector('.opt-2').value = v2;
        card.querySelector('.opt-3').value = v3;
        card.querySelector('.opt-4').value = v4;
        card.querySelector('.opt-5').value = v5;
    } else {
        optionsContainer.classList.add('opacity-50', 'grayscale');
        card.querySelector('.opt-1').value = '';
        card.querySelector('.opt-2').value = '';
        card.querySelector('.opt-3').value = '';
        card.querySelector('.opt-4').value = '';
        card.querySelector('.opt-5').value = '';
    }
}

// Função Principal: Iniciar e disparar pro Backend -> N8N
async function startLeilao() {
    const container = document.getElementById('cards-container');
    // Usa :scope > .bg-white para pegar APENAS os cards diretos, ignorando as divs internas do preview
    const cardElements = container.querySelectorAll(':scope > .bg-white');
    
    if (cardElements.length === 0) {
        showToast('Adicione pelo menos uma carta antes de iniciar.', 'error');
        return;
    }

    const payload = [];
    let hasError = false;

    // Coleta dados dos cards
    cardElements.forEach((el, index) => {
        const imageUrl = el.querySelector('.card-img-url').value.trim();
        const nome = el.querySelector('.card-name').value.trim();
        const valorRaw = el.querySelector('.card-value').value;
        const valor = parseFloat(valorRaw);

        // Validação mínima
        if (!nome || isNaN(valor) || valor <= 0) {
            hasError = true;
            // Destaca o card com erro visualmente
            el.classList.add('border-red-300', 'ring-2', 'ring-red-100');
            setTimeout(() => el.classList.remove('border-red-300', 'ring-2', 'ring-red-100'), 3000);
            return;
        }

        // Recupera valores calculados dinamicamente ou inseridos
        const v1Str = el.querySelector('.opt-1').value;
        const v2Str = el.querySelector('.opt-2').value;
        const v3Str = el.querySelector('.opt-3').value;
        const v4Str = el.querySelector('.opt-4').value;
        const v5Str = el.querySelector('.opt-5').value;

        // Se o usuario deixar vazio, previne erro no envio (adotando 0 como fallback estético)
        const v1 = formatString(parseFloat(v1Str) || 0);
        const v2 = formatString(parseFloat(v2Str) || 0);
        const v3 = formatString(parseFloat(v3Str) || 0);
        const v4 = formatString(parseFloat(v4Str) || 0);
        const v5 = formatString(parseFloat(v5Str) || 0);

        const options = [];
        
        // Push options dynamcally according to config
        if (G_NUM_OPTIONS >= 1) options.push(`R$ ${v1}`);
        if (G_NUM_OPTIONS >= 2) options.push(`R$ ${v2}`);
        if (G_NUM_OPTIONS >= 3) options.push(`R$ ${v3}`);
        if (G_NUM_OPTIONS >= 4) options.push(`R$ ${v4}`);
        if (G_NUM_OPTIONS >= 5) options.push(`R$ ${v5}`);

        // Alterar prefixo da última
        if (options.length > 0) {
            options[options.length - 1] = "É minha por " + options[options.length - 1];
        }

        payload.push({
            id_lote: index + 1,
            imagem: el.querySelector('.card-img-url').dataset.urlDocker || imageUrl || null,
            nome: nome,
            valorBase: valor,
            opcoes_enquete: options
        });
    });

    if (hasError) {
        showToast('Preencha o Nome e Valor Base (> 0) em todos os itens de lote.', 'error');
        return;
    }

    // Feedback visual (Loading)
    const btn = document.getElementById('btn-start');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Acionando n8n...`;
    btn.disabled = true;

    // Fetch API Node do servidor que fará repasse
    try {
        const token = localStorage.getItem('poke_token');
        const targetNumber = document.getElementById('target-number') ? document.getElementById('target-number').value.trim() : '553183693473';

        const response = await fetch('/api/start-leilao', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ arrayLotes: payload, timestamp: new Date().toISOString(), targetNumber: targetNumber })
        });

        const result = await response.json();
        
        if (response.ok) {
            showToast('✅ Payload despachado para n8n via webhook.', 'success');
            // Opcional: Limpar a tela? (Apenas comentário pra n frustrar o usuário q pode querer editar depois)
            // container.innerHTML = ''; addCardForm();
        } else {
            showToast(result.message || 'Falha ao acionar n8n.', 'error');
        }
    } catch (error) {
        showToast('Erro Crítico: Servidor Offline!', 'error');
        console.error(error);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}


/* =======================================================
   GERENCIAMENTO DE RASCUNHOS DE LEILÃO
   ======================================================= */
async function saveDraft() {
    const container = document.getElementById('cards-container');
    const cardElements = container.querySelectorAll(':scope > .bg-white');
    if (cardElements.length === 0) {
        showToast('Adicione pelo menos uma carta para salvar o leilão.', 'error');
        return;
    }

    const payload = [];
    cardElements.forEach((el) => {
        payload.push({
            img_url: el.querySelector('.card-img-url').value.trim(),
            nome: el.querySelector('.card-name').value.trim(),
            valor: el.querySelector('.card-value').value
        });
    });

    const draftName = prompt("De um nome para este Leilão (para carregar depois):", "Leilão " + new Date().toLocaleDateString('pt-BR'));
    if (!draftName) return;

    const draft = {
        id: Date.now().toString(),
        nome: draftName,
        data: new Date().toISOString(),
        cartas: payload
    };

    try {
        const token = localStorage.getItem('poke_token');
        const res = await fetch('/api/rascunhos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(draft)
        });
        if(res.ok) showToast('Lotes do leilão salvos com sucesso!', 'success');
        else showToast('Erro ao salvar leilão.', 'error');
    } catch(e) {
        console.error(e);
        showToast('Erro de conexão ao salvar leilão.', 'error');
    }
}

let LOCAL_DRAFTS_CACHE = {};

async function loadDraftModal() {
    const modal = document.getElementById('draft-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    const list = document.getElementById('draft-list');
    const loader = document.getElementById('draft-loading');
    
    list.innerHTML = '';
    loader.classList.remove('hidden');

    try {
        const token = localStorage.getItem('poke_token');
        const res = await fetch('/api/rascunhos', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        loader.classList.add('hidden');
        if(data.success && data.rascunhos.length > 0) {
            LOCAL_DRAFTS_CACHE = {};
            data.rascunhos.forEach(draft => {
                LOCAL_DRAFTS_CACHE[draft.id] = draft;
                const dateStr = new Date(draft.data).toLocaleString('pt-BR');
                list.innerHTML += `
                    <div class="flex flex-col sm:flex-row justify-between sm:items-center p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors gap-3">
                        <div>
                            <h4 class="font-bold text-slate-800 text-sm">${draft.nome}</h4>
                            <p class="text-xs text-slate-500">${draft.cartas.length} cartas • Salvo em: ${dateStr}</p>
                        </div>
                        <button onclick='applyDraft("${draft.id}")' class="bg-white border border-slate-300 hover:border-wapp hover:text-wapp text-slate-600 text-xs font-bold py-2 px-4 rounded-lg transition-colors shrink-0">
                            Carregar
                        </button>
                    </div>
                `;
            });
        } else {
            list.innerHTML = '<p class="text-sm text-slate-500 text-center py-4">Nenhum leilão salvo ainda.</p>';
        }
    } catch(e) {
        loader.classList.add('hidden');
        list.innerHTML = '<p class="text-sm text-red-500 text-center py-4">Erro ao buscar lotes salvos.</p>';
    }
}

function closeDraftModal() {
    const modal = document.getElementById('draft-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function applyDraft(draftId) {
    const draft = LOCAL_DRAFTS_CACHE[draftId];
    if(!draft) return;
    
    closeDraftModal();
    const container = document.getElementById('cards-container');
    container.innerHTML = ''; // Limpa as atuais
    
    if(!draft.cartas || draft.cartas.length === 0) return;
    
    draft.cartas.forEach(carta => {
        addCardForm(); // Cria um card vazio na interface
        const lastCard = container.lastElementChild;
        
        const imgInput = lastCard.querySelector('.card-img-url');
        const nameInput = lastCard.querySelector('.card-name');
        const valInput = lastCard.querySelector('.card-value');
        
        if (carta.img_url) {
            imgInput.value = carta.img_url;
            updatePreview(imgInput);
        }
        if (carta.nome) nameInput.value = carta.nome;
        if (carta.valor) {
            valInput.value = carta.valor;
            calculateOptions(valInput);
        }
    });
    
    showToast(`Leilão "${draft.nome}" carregado com sucesso!`, 'success');
}

/* =======================================================
   SEÇÃO 2: RESULTADOS E APURAÇÃO (API NÓS MESMOS)
   ======================================================= */

function formatCurrency(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPhoneDisplay(phone) {
    // Formato base se for BR: 5511999991111 -> +55 (11) 99999-1111
    if (phone && phone.length >= 12 && phone.startsWith('55')) {
        return `+55 (${phone.substring(2, 4)}) ${phone.substring(4, 9)}-${phone.substring(9)}`;
    }
    return phone || 'Desconhecido';
}

async function finalizarLeilao() {
    const nome_leilao = prompt("Dê um nome para identificar este leilão no histórico:", "Leilão " + new Date().toLocaleDateString('pt-BR'));
    if (!nome_leilao) return; // Cancelado pelo usuario

    const btn = document.getElementById('btn-finalizar');
    const loading = document.getElementById('results-loading');
    const container = document.getElementById('winners-container');
    const tagsContainer = document.getElementById('nao-vendidas-tags');
    const secNaoVendidas = document.getElementById('nao-vendidas-container');

    const originalText = btn.innerHTML;
    btn.innerHTML = `<svg class="animate-spin h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Calculando...`;
    btn.disabled = true;

    loading.classList.remove('hidden');
    container.innerHTML = '';
    tagsContainer.innerHTML = '';
    secNaoVendidas.classList.add('hidden');

    try {
        const token = localStorage.getItem('poke_token');
        const response = await fetch('/api/resultados-leilao', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ nome_leilao })
        });

        const result = await response.json();
        
        if (response.ok && result.success) {
            const data = result.data; // data é o objeto cobranca agora
            
            // Renderiza ganhadores passando clientes formatados e ID
            renderWinners(data.clientes, data.id);

            // Renderiza não vendidas
            if (data.nao_vendidas && data.nao_vendidas.length > 0) {
                secNaoVendidas.classList.remove('hidden');
                data.nao_vendidas.forEach(nome => {
                    const tag = `<span class="bg-white text-slate-600 border border-slate-200 shadow-sm px-3 py-1.5 rounded-md text-sm font-medium">${nome} <span class="text-slate-400 font-normal ml-1">sem lances</span></span>`;
                    tagsContainer.insertAdjacentHTML('beforeend', tag);
                });
            }

            showToast('Resultados calculados e leilão encerrado com sucesso!', 'success');
        } else {
            showToast(result.message || 'Erro ao puxar resultados.', 'error');
            container.innerHTML = `<p class="col-span-full py-10 text-center text-slate-500 font-medium">Não foi possível carregar os ganhadores.</p>`;
        }
    } catch (error) {
        showToast('Erro Crítico: Servidor Offline!', 'error');
        console.error(error);
    } finally {
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            loading.classList.add('hidden');
        }, 300);
    }
}

// Apenas chamada inicial para zerar a tela caso a pessoa navegue para cá
function loadWinners() {
    const container = document.getElementById('winners-container');
    if (container.innerHTML.trim() === '') {
        container.innerHTML = `
            <div class="col-span-full py-14 flex flex-col items-center bg-white rounded-xl border border-dashed border-slate-300">
                <svg class="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                <h3 class="text-lg font-bold text-slate-700">O Leilão ainda está rolando?</h3>
                <p class="text-slate-500 mt-1 max-w-sm text-center">Clique no botão "Finalizar e Apurar Resultados" acima quando o prazo terminar para ver quem ganhou cada lote.</p>
            </div>`;
    }
}

function renderWinners(clientes, leilaoId) {
    const container = document.getElementById('winners-container');

    if (clientes.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-10 flex flex-col items-center bg-white rounded-xl border border-dashed border-slate-300">
                <svg class="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                <p class="text-slate-500 font-medium">Nenhum ganhador importado ainda.</p>
            </div>
        `;
        return;
    }

    clientes.forEach(cliente => {
        const isPago = cliente.status_pagamento === 'pago';
        const tagHTML = isPago ? 
            `<button id="status-btn-${cliente.telefone}" onclick="togglePagamento('${leilaoId}', '${cliente.telefone}', 'pago')" class="text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded shadow-sm hover:bg-emerald-100 transition-colors">🟢 Pago</button>` : 
            `<button id="status-btn-${cliente.telefone}" onclick="togglePagamento('${leilaoId}', '${cliente.telefone}', 'pendente')" class="text-[10px] font-extrabold uppercase bg-rose-50 text-rose-600 border border-rose-200 px-2.5 py-1 rounded shadow-sm hover:bg-rose-100 transition-colors">🔴 Pendente</button>`;
            
        const clientStr = JSON.stringify(cliente).replace(/'/g, "&#39;");
        const cobrarHTML = `<button id="cobrar-btn-${cliente.telefone}" class="${isPago ? 'hidden' : 'flex'} w-full bg-wapp hover:bg-wapp-hover text-white font-semibold py-3 px-4 rounded-xl shadow-sm transition-all items-center justify-center gap-2 transform active:scale-95" onclick='handleSendCobranca(event, ${clientStr})'>
             <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.183-.573c.978.58 1.711.927 3.15.927 3.199 0 5.765-2.586 5.765-5.766s-2.566-5.769-5.767-5.769zM12.031 16.5c-1.025 0-1.782-.284-2.559-.72l-.183-.102-1.282.336.342-1.251-.112-.178c-.461-.734-.73-1.545-.73-2.418 0-2.486 2.023-4.51 4.51-4.51 2.486 0 4.512 2.024 4.512 4.51s-2.026 4.51-4.51 4.51zm2.463-3.15c-.135-.068-.8-.396-.924-.442-.124-.045-.215-.068-.305.068-.09.135-.35.442-.429.532-.079.09-.158.102-.293.033-.135-.068-.572-.211-1.09-.675-.403-.361-.675-.807-.754-.942-.079-.135-.008-.208.06-.276.061-.061.135-.158.203-.238.068-.079.09-.135.135-.226.045-.09.023-.17-.011-.238-.034-.068-.305-.735-.418-1.006-.111-.264-.223-.228-.305-.232-.079-.004-.17-.005-.26-.005s-.238.034-.362.17c-.124.135-.474.463-.474 1.131 0 .667.485 1.312.553 1.402.068.09 1.005 1.54 2.433 2.152.34.146.605.233.813.298.342.108.653.093.899.056.273-.041.8-.396.912-.78.113-.384.113-.712.079-.78-.033-.068-.124-.102-.259-.17z"/></svg>
             Enviar Mensagem (WhatsApp)
         </button>`;

        const cardHTML = `
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
                
                <!-- Cabeçalho (Cliente) -->
                <div class="bg-slate-50 border-b border-slate-200 px-6 py-5 flex items-center justify-between relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 w-16 h-16 bg-slate-100 rounded-full opacity-50"></div>
                    <div class="flex items-center gap-4 z-10 w-full">
                        <div class="bg-gradient-to-br from-indigo-100 to-indigo-200 text-indigo-700 w-11 h-11 rounded-full flex items-center justify-center font-bold shadow-sm z-10 shrink-0">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z M4 2a2 2 0 100 4 2 2 0 000-4z"></path></svg>
                        </div>
                        <div class="z-10 truncate flex-grow">
                            <p class="font-bold text-slate-800 text-lg truncate" title="${cliente.telefone}">${formatPhoneDisplay(cliente.telefone)}</p>
                        </div>
                        <div class="z-10 shrink-0 text-right">
                            ${tagHTML}
                        </div>
                    </div>
                </div>
                
                <!-- Corpo (Itens) -->
                <div class="px-6 py-5 flex-grow">
                    <div class="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                        <p class="text-xs font-semibold uppercase text-slate-400 tracking-wide">Itens Arrematados</p>
                        <span class="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">${cliente.cartas.length}</span>
                    </div>
                    
                    <ul class="space-y-2.5 mt-2 overflow-y-auto no-scrollbar max-h-[160px]">
                        ${cliente.cartas.map(c => `
                            <li class="flex justify-between text-sm items-center gap-3">
                                <span class="text-slate-600 truncate flex-grow" title="${c.nome}">
                                    <span class="text-indigo-400 font-bold mr-1">•</span> ${c.nome}
                                </span>
                                <span class="font-medium text-slate-900 whitespace-nowrap">${formatCurrency(c.valor)}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>

                <!-- Footer (Total e Action) -->
                <div class="bg-slate-50 border-t border-slate-200 mt-auto">
                    <div class="px-6 py-4 flex items-center justify-between border-b border-white/50">
                        <span class="text-slate-500 text-sm font-medium">Total devido</span>
                        <span class="text-2xl font-black text-slate-900 tracking-tight">${formatCurrency(cliente.subtotal)}</span>
                    </div>

                    <div class="p-4" id="cobrar-wrapper-${cliente.telefone}">
                        ${cobrarHTML}
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });
}

async function handleSendCobranca(e, clientData) {
    let msg = `Olá! Passando para atualizar sobre o PokéLeilão. Você arrematou as seguintes cartas:\n\n`;
    clientData.cartas.forEach(c => {
        msg += `- ${c.nome} (R$ ${c.valor})\n`;
    });
    msg += `\nTotal devido: R$ ${clientData.subtotal}\n`;
    
    const phone = clientData.telefone.replace(/\D/g, '');
    let url = '';
    // if phone resembles a valid number (e.g. 553183693473), attach it, else just general whatsapp link
    if (phone.length >= 10) {
        url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
    } else {
        url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    }
    window.open(url, '_blank');
}

/* =======================================================
   GERENCIAMENTO DE HISTÓRICO DE COBRANÇAS
   ======================================================= */
let LOCAL_COBRANCAS_CACHE = {};

async function loadCobrancasModal() {
    const modal = document.getElementById('cobrancas-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    const list = document.getElementById('cobrancas-list');
    const loader = document.getElementById('cobrancas-loading');
    
    list.innerHTML = '';
    loader.classList.remove('hidden');

    try {
        const token = localStorage.getItem('poke_token');
        const res = await fetch('/api/cobrancas', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        loader.classList.add('hidden');
        if(data.success && data.cobrancas.length > 0) {
            LOCAL_COBRANCAS_CACHE = {};
            data.cobrancas.forEach(cob => {
                LOCAL_COBRANCAS_CACHE[cob.id] = cob;
                const totalReceber = cob.clientes.reduce((acc, c) => acc + c.subtotal, 0);
                const pagos = cob.clientes.filter(c => c.status_pagamento === 'pago').length;
                const dateStr = new Date(cob.data).toLocaleString('pt-BR');
                
                list.innerHTML += `
                    <div class="flex flex-col p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors gap-3">
                        <div class="flex justify-between items-start">
                            <h4 class="font-bold text-slate-800 text-sm">${cob.nome_leilao}</h4>
                            <div class="flex gap-2 items-center">
                                <span class="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded">R$ ${totalReceber.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                <button onclick="deleteCobranca('${cob.id}')" class="text-xs bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 font-bold px-2 py-1 rounded transition-colors" title="Excluir Histórico">✖</button>
                            </div>
                        </div>
                        <p class="text-xs text-slate-500">${cob.clientes.length} ganhadores (${pagos} pagos) • Finalizado em: ${dateStr}</p>
                        <button onclick='applyCobranca(\"${cob.id}\")' class="w-full bg-white border border-slate-300 hover:border-wapp hover:text-wapp text-slate-600 text-xs font-bold py-2 px-4 rounded-lg transition-colors mt-1">
                            Ver Faturas
                        </button>
                    </div>
                `;
            });
        } else {
            list.innerHTML = '<p class="text-sm text-slate-500 text-center py-4">Nenhum histórico encontrado.</p>';
        }
    } catch(e) {
        loader.classList.add('hidden');
        list.innerHTML = '<p class="text-sm text-red-500 text-center py-4">Erro ao buscar histórico.</p>';
    }
}

function closeCobrancasModal() {
    const modal = document.getElementById('cobrancas-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function deleteCobranca(id) {
    if (!confirm('Tem certeza que deseja excluir esse leilão do histórico? Isso não pode ser desfeito.')) return;
    try {
        const token = localStorage.getItem('poke_token');
        const res = await fetch('/api/cobrancas/' + id, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            showToast('Leilão removido!', 'success');
            loadCobrancasModal();
            // check if the currently opened results correspond to this one, maybe clear it?
        } else {
            const data = await res.json();
            showToast(data.message || 'Erro ao remover', 'error');
        }
    } catch(e) {
        showToast('Erro ao deletar', 'error');
    }
}

function applyCobranca(id) {
    const cob = LOCAL_COBRANCAS_CACHE[id];
    if(!cob) return;
    
    closeCobrancasModal();
    
    // Limpa a tela para garantir que mostrará apenas esse leilão
    document.getElementById('winners-container').innerHTML = '';
    
    // Atualiza a tela de resultados com os clientes desse histórico
    renderWinners(cob.clientes, cob.id);
    
    // Mostra as nãovendidas se existirem
    const tagsContainer = document.getElementById('nao-vendidas-tags');
    const secNaoVendidas = document.getElementById('nao-vendidas-container');
    tagsContainer.innerHTML = '';
    
    if (cob.nao_vendidas && cob.nao_vendidas.length > 0) {
        secNaoVendidas.classList.remove('hidden');
        cob.nao_vendidas.forEach(nome => {
            const tag = `<span class="bg-white text-slate-600 border border-slate-200 shadow-sm px-3 py-1.5 rounded-md text-sm font-medium">${nome} <span class="text-slate-400 font-normal ml-1">sem lances</span></span>`;
            tagsContainer.insertAdjacentHTML('beforeend', tag);
        });
    } else {
        secNaoVendidas.classList.add('hidden');
    }
    
    showToast(`Visualizando faturas de "${cob.nome_leilao}"`, 'info');
}

async function togglePagamento(leilaoId, telefone, currentStatus) {
    const newStatus = currentStatus === 'pago' ? 'pendente' : 'pago';
    
    try {
        const token = localStorage.getItem('poke_token');
        const res = await fetch(`/api/cobrancas/${leilaoId}/pago`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ telefone, status: newStatus })
        });
        
        if (res.ok) {
            showToast('Status de pagamento atualizado!', 'success');
            const btnTag = document.getElementById(`status-btn-${telefone}`);
            const btnCobrar = document.getElementById(`cobrar-btn-${telefone}`);
            
            if (newStatus === 'pago') {
                btnTag.innerHTML = `🟢 Pago`;
                btnTag.classList.remove('bg-rose-50', 'text-rose-600', 'border-rose-200');
                btnTag.classList.add('bg-emerald-50', 'text-emerald-600', 'border-emerald-200');
                btnTag.setAttribute('onclick', `togglePagamento('${leilaoId}', '${telefone}', 'pago')`);
                if (btnCobrar) {
                    btnCobrar.classList.remove('flex');
                    btnCobrar.classList.add('hidden');
                }
            } else {
                btnTag.innerHTML = `🔴 Pendente`;
                btnTag.classList.remove('bg-emerald-50', 'text-emerald-600', 'border-emerald-200');
                btnTag.classList.add('bg-rose-50', 'text-rose-600', 'border-rose-200');
                btnTag.setAttribute('onclick', `togglePagamento('${leilaoId}', '${telefone}', 'pendente')`);
                if (btnCobrar) {
                    btnCobrar.classList.remove('hidden');
                    btnCobrar.classList.add('flex');
                }
            }
        } else {
            // Revert on error
            showToast('Falha ao atualizar no servidor.', 'error');
        }
    } catch(e) {
        showToast('Erro ao atualizar status.', 'error');
    }
}

/* =======================================================
   ALERTAS E FEEDBACK (Toastify)

   ======================================================= */
/* =======================================================
   GERENCIAMENTO DE ENVIOS
   ======================================================= */
async function loadEnvios() {
    const container = document.getElementById('envios-container');
    const loader = document.getElementById('envios-loading');
    
    container.innerHTML = '';
    loader.classList.remove('hidden');

    try {
        const token = localStorage.getItem('poke_token');
        const res = await fetch('/api/cobrancas', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        loader.classList.add('hidden');
        
        if(data.success && data.cobrancas.length > 0) {
            // Agrupar cartas por cliente que estejam pagas e NÃO enviadas
            const enviosAgrupados = {}; // { "553199...": { telefone, cartas: [], subtotal: 0, leilaoIds: new Set() } }
            
            data.cobrancas.forEach(cob => {
                cob.clientes.forEach(cliente => {
                    if (cliente.status_pagamento === 'pago' && cliente.status_envio !== 'enviado') {
                        if (!enviosAgrupados[cliente.telefone]) {
                            enviosAgrupados[cliente.telefone] = {
                                telefone: cliente.telefone,
                                cartas: [],
                                subtotal: 0,
                                leilaoIds: new Set()
                            };
                        }
                        
                        enviosAgrupados[cliente.telefone].cartas.push(...cliente.cartas);
                        enviosAgrupados[cliente.telefone].subtotal += cliente.subtotal;
                        enviosAgrupados[cliente.telefone].leilaoIds.add(cob.id);
                    }
                });
            });
            
            const clientesEnvio = Object.values(enviosAgrupados);
            
            if (clientesEnvio.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full py-10 flex flex-col items-center bg-white rounded-xl border border-dashed border-slate-300">
                        <svg class="w-12 h-12 text-emerald-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7"></path></svg>
                        <p class="text-slate-500 font-medium">Tudo zerado! Nenhuma carta pendente de envio.</p>
                    </div>`;
                return;
            }
            
            clientesEnvio.forEach(cliente => {
                const arrLeiloes = Array.from(cliente.leilaoIds);
                const leiloesStr = JSON.stringify(arrLeiloes).replace(/'/g, "&#39;");
                
                const cardHTML = `
                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
                        <div class="bg-indigo-50 border-b border-indigo-100 px-6 py-5 flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="bg-indigo-500 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold">
                                    📦
                                </div>
                                <p class="font-bold text-slate-800 text-lg">${formatPhoneDisplay(cliente.telefone)}</p>
                            </div>
                        </div>
                        
                        <div class="px-6 py-4 flex-grow">
                            <p class="text-xs font-semibold uppercase text-slate-400 mb-2">Cartas para Empacotar (${cliente.cartas.length})</p>
                            <ul class="space-y-1.5 overflow-y-auto no-scrollbar max-h-[160px]">
                                ${cliente.cartas.map(c => `
                                    <li class="flex justify-between text-sm items-center">
                                        <span class="text-slate-700 truncate" title="${c.nome}">• ${c.nome}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>

                        <div class="p-4 border-t border-slate-100 mt-auto">
                            <button class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2" onclick='marcarEnviado(event, "${cliente.telefone}", ${leiloesStr})'>
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                                Marcar como Enviado
                            </button>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', cardHTML);
            });
            
        } else {
            container.innerHTML = '<p class="text-sm text-slate-500 col-span-full text-center py-4">Nenhum histórico encontrado para envios.</p>';
        }
    } catch(e) {
        loader.classList.add('hidden');
        container.innerHTML = '<p class="text-sm text-red-500 col-span-full text-center py-4">Erro ao buscar envios.</p>';
    }
}

async function marcarEnviado(e, telefone, leilaoIds) {
    if (!confirm('Deseja marcar os pacotes desse cliente como entregues/enviados? Eles sairão desta lista.')) return;
    
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = 'Atualizando...';
    
    try {
        const token = localStorage.getItem('poke_token');
        const res = await fetch('/api/cobrancas/envio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ telefone, leilaoIds })
        });
        
        if (res.ok) {
            showToast('Pedido marcado como enviado sucesso!', 'success');
            loadEnvios(); // recarrega a lista
        } else {
            showToast('Falha ao atualizar', 'error');
            btn.disabled = false;
        }
    } catch(err) {
        showToast('Erro de rede', 'error');
        btn.disabled = false;
    }
}

function showToast(text, type = 'info') {
    let background = "linear-gradient(to right, #3b82f6, #2563eb)"; // Blue
    if (type === 'success') background = "linear-gradient(to right, #10b981, #059669)"; // Green
    if (type === 'error') background = "linear-gradient(to right, #ef4444, #dc2626)"; // Red

    Toastify({
        text: text,
        duration: 4000,
        close: true,
        gravity: "bottom", // better for mobile
        position: "right",
        stopOnFocus: true,
        style: {
            background: background,
            fontFamily: "'Inter', sans-serif",
            fontWeight: "500",
            fontSize: "14px",
            borderRadius: "8px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
        }
    }).showToast();
}

/* =======================================================
   INICIALIZAÇÃO (BOOTSTRAP)
   ======================================================= */
document.addEventListener('DOMContentLoaded', () => {
    // Carrega configurações globais de porcentagens primeiro
    initSettings();

    // Verifica logado
    checkAuth();
    
    // Proibe a seleção de texto pro corpo todo para evitar cópia simples
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    
    // Libera text selection e copy só nos inputs q são precisos
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(el => {
        el.style.userSelect = 'auto';
        el.style.webkitUserSelect = 'auto';
    });

    // Ao abrir a página, teremos pelo menos 1 slot vazio para carta
    addCardForm();
});
