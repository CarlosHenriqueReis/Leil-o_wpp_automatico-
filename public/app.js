/* =======================================================
   GERENCIAMENTO DE ABAS (TABS)
   ======================================================= */
function switchTab(tab) {
    const btnSetup = document.getElementById('tab-setup');
    const btnResults = document.getElementById('tab-results');
    const secSetup = document.getElementById('section-setup');
    const secResults = document.getElementById('section-results');

    if (tab === 'setup') {
        btnSetup.className = 'h-full px-2 tab-active flex items-center transition-colors';
        btnResults.className = 'h-full px-2 tab-inactive flex items-center transition-colors';
        secSetup.classList.remove('hidden');
        secResults.classList.add('hidden');
    } else {
        btnSetup.className = 'h-full px-2 tab-inactive flex items-center transition-colors';
        btnResults.className = 'h-full px-2 tab-active flex items-center transition-colors';
        secSetup.classList.add('hidden');
        secResults.classList.remove('hidden');
        
        // Ao clicar em resultados, carrega mock database
        loadWinners();
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
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (response.ok && result.url) {
            urlInput.value = result.url;
            updatePreview(urlInput); // Usa a função acima para renderizar
            showToast('Imagem processada pelo servidor!', 'success');
        } else {
            showToast('Falha no upload da imagem.', 'error');
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

// Lógica de cálculo 85%, 100%, 120%, 140% com garantias
function calculateOptions(input) {
    const card = input.closest('.bg-white');
    const optionsContainer = card.querySelector('.card-options');
    const val = parseFloat(input.value);
    
    if (!isNaN(val) && val > 0) {
        optionsContainer.classList.remove('opacity-50', 'grayscale');
        
        let v85 = Math.round(val * 0.85);
        let v100 = Math.round(val * 1.00);
        let v120 = Math.round(val * 1.20);
        let v140 = Math.round(val * 1.40);
        
        // Garante que o lance sempre suba pelo menos R$ 1 para não repetir lances (ex: R$ 2)
        v100 = Math.max(v100, v85 + 1);
        v120 = Math.max(v120, v100 + 1);
        v140 = Math.max(v140, v120 + 1);
        
        // Salva os valores finais atrelados ao card
        card.dataset.v85 = formatString(v85);
        card.dataset.v100 = formatString(v100);
        card.dataset.v120 = formatString(v120);
        card.dataset.v140 = formatString(v140);

        card.querySelector('.opt-85').innerHTML = `É minha por R$ <b>${card.dataset.v85}</b>`;
        card.querySelector('.opt-100').innerHTML = `É minha por R$ <b>${card.dataset.v100}</b>`;
        card.querySelector('.opt-120').innerHTML = `É minha por R$ <b>${card.dataset.v120}</b>`;
        card.querySelector('.opt-140').innerHTML = `É minha por R$ <b>${card.dataset.v140}</b>`;
    } else {
        optionsContainer.classList.add('opacity-50', 'grayscale');
        card.querySelector('.opt-85').textContent = `É minha por R$ --`;
        card.querySelector('.opt-100').textContent = `É minha por R$ --`;
        card.querySelector('.opt-120').textContent = `É minha por R$ --`;
        card.querySelector('.opt-140').textContent = `É minha por R$ --`;
    }
}

// Função Principal: Iniciar e disparar pro Backend -> N8N
async function startLeilao() {
    const container = document.getElementById('cards-container');
    const cardElements = container.querySelectorAll('.bg-white');
    
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

        // Recupera valores calculados dinamicamente
        const v85 = el.dataset.v85 || "0";
        const v100 = el.dataset.v100 || "0";
        const v120 = el.dataset.v120 || "0";
        const v140 = el.dataset.v140 || "0";

        const options = [
            `É minha por R$ ${v85}`,
            `É minha por R$ ${v100}`,
            `É minha por R$ ${v120}`,
            `É minha por R$ ${v140}`
        ];

        payload.push({
            id_lote: index + 1,
            imagem: imageUrl || null,
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
        const response = await fetch('/api/start-leilao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ arrayLotes: payload, timestamp: new Date().toISOString() })
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
   SEÇÃO 2: RESULTADOS (Mock e Renderização)
   ======================================================= */
// Mock de dados - "Lances vencedores" retornados de algum bd / sheet via n8n
const mockDatabaseResultados = [
    { id_carta: 101, nome_carta: "Charizard VMAX [Secret]", valor_vencedor: 350.50, telefone_ganhador: "5511999991111" },
    { id_carta: 102, nome_carta: "Pikachu Illustrator (Proxy)", valor_vencedor: 120.00, telefone_ganhador: "5511999991111" },
    { id_carta: 103, nome_carta: "Lugia V (Alt Art)", valor_vencedor: 450.00, telefone_ganhador: "5521988882222" },
    { id_carta: 104, nome_carta: "Gengar VMAX [Alt Art]", valor_vencedor: 600.00, telefone_ganhador: "5511999991111" },
    { id_carta: 105, nome_carta: "Mewtwo ex [Ruby & Sapphire]", valor_vencedor: 85.00, telefone_ganhador: "5531977773333" }
];

function formatCurrency(valor) {
    return valStr = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPhoneDisplay(phone) {
    // Formato base: (11) 99999-1111 a partir de 5511...
    if (phone.length === 13 && phone.startsWith('55')) {
        return `+55 (${phone.substring(2, 4)}) ${phone.substring(4, 9)}-${phone.substring(9)}`;
    }
    return phone;
}

// Simulando um fetch para carregar
function loadWinners() {
    const loading = document.getElementById('results-loading');
    const container = document.getElementById('winners-container');
    
    // Mostra loading
    loading.classList.remove('hidden');
    container.innerHTML = '';

    setTimeout(() => {
        renderWinners(mockDatabaseResultados);
        loading.classList.add('hidden');
    }, 400); // 400ms delay falso
}

function renderWinners(data) {
    const container = document.getElementById('winners-container');

    // 1. Agrupar logicamente pelo Telefone do cliente
    const grouped = {};
    data.forEach(item => {
        const phone = item.telefone_ganhador;
        if (!grouped[phone]) {
            grouped[phone] = { telefone: phone, cartas: [], subtotal: 0 };
        }
        grouped[phone].cartas.push({ nome: item.nome_carta, valor: item.valor_vencedor });
        grouped[phone].subtotal += item.valor_vencedor;
    });

    const clientes = Object.values(grouped);

    if (clientes.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-10 flex flex-col items-center bg-white rounded-xl border border-dashed border-slate-300">
                <svg class="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                <p class="text-slate-500 font-medium">Nenhum ganhador importado ainda.</p>
            </div>
        `;
        return;
    }

    // 2. Renderizar cards HTML
    clientes.forEach(cliente => {
        const cardHTML = `
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
                
                <!-- Cabeçalho (Cliente) -->
                <div class="bg-slate-50 border-b border-slate-200 px-6 py-5 flex items-center gap-4 relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 w-16 h-16 bg-slate-100 rounded-full opacity-50"></div>
                    <div class="bg-gradient-to-br from-indigo-100 to-indigo-200 text-indigo-700 w-11 h-11 rounded-full flex items-center justify-center font-bold shadow-sm z-10 shrink-0">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z M4 2a2 2 0 100 4 2 2 0 000-4z"></path></svg>
                    </div>
                    <div class="z-10 truncate">
                        <p class="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Novo Ganhador</p>
                        <p class="font-bold text-slate-800 text-lg truncate" title="${cliente.telefone}">${formatPhoneDisplay(cliente.telefone)}</p>
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

                    <div class="p-4">
                        <button class="w-full bg-wapp hover:bg-wapp-hover text-white font-semibold py-3 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 transform active:scale-95" onclick='handleSendCobranca(event, ${JSON.stringify(cliente)})'>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                            Disparar Cobrança (n8n)
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });
}

async function handleSendCobranca(e, clientData) {
    const btn = e.currentTarget;
    const originalContent = btn.innerHTML;
    
    // Bloqueia e mostra loading
    btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Repassando...`;
    btn.disabled = true;

    try {
        const payload = {
            cliente: clientData.telefone,
            total_devido: clientData.subtotal,
            detalhes_fatura: clientData.cartas,
            timestamp: new Date().toISOString()
        };

        const response = await fetch('/api/send-cobranca', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (response.ok) {
            showToast(`Cobrança de ${formatCurrency(clientData.subtotal)} enviada para ${formatPhoneDisplay(clientData.telefone)}`, 'success');
            
            // Sucesso visual
            btn.innerHTML = `<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Enviado`;
            btn.classList.add('bg-slate-800', 'hover:bg-slate-700', 'cursor-default');
            btn.classList.remove('bg-wapp', 'hover:bg-wapp-hover', 'active:scale-95');
        } else {
            showToast(result.message || 'Erro do servidor', 'error');
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    } catch (error) {
        showToast('Erro de Conexão com a Aplicação Node.', 'error');
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

/* =======================================================
   ALERTAS E FEEDBACK (Toastify)
   ======================================================= */
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
    // Ao abrir a página, teremos pelo menos 1 slot vazio para carta
    addCardForm();
});
