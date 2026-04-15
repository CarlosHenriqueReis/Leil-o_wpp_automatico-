const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'table.txt');
const data = fs.readFileSync(inputPath, 'utf8');

const lines = data.split('\n').map(l => l.trim()).filter(l => l.length > 0);

const leiloes = {};

for (const line of lines) {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length < 5) continue;
    
    const [dataLeilao, comprador, cartasStr, valorStr, status] = parts;
    const nomeLeilao = `Leilão ${dataLeilao}`;
    
    if (!leiloes[nomeLeilao]) {
        // Build timestamp from date
        const [day, month, year] = dataLeilao.split('/');
        const isoDate = new Date(`${year}-${month}-${day}T12:00:00Z`).toISOString();
        leiloes[nomeLeilao] = {
            id: Date.now().toString() + Math.floor(Math.random()*1000),
            nome_leilao: nomeLeilao,
            data: isoDate,
            nao_vendidas: [],
            clientes: [],
            _clientesMap: {}
        };
    }
    
    const l = leiloes[nomeLeilao];
    
    if (!l._clientesMap[comprador]) {
        l._clientesMap[comprador] = {
            telefone: comprador, // we map telefone to comprador name to display it easily
            nome_display: comprador,
            status_pagamento: status.toLowerCase() === 'pago' ? 'pago' : 'pendente',
            cartas: [],
            subtotal: 0
        };
        l.clientes.push(l._clientesMap[comprador]);
    }
    
    const val = valorStr === '-' ? 0 : parseFloat(valorStr.replace('.', '').replace(',', '.'));
    
    // As cartas are separated by comma usually, let's treat it as one text block
    l._clientesMap[comprador].cartas.push({
        nome: cartasStr,
        valor: val
    });
    l._clientesMap[comprador].subtotal += val;
}

const finalL = Object.values(leiloes).map(l => {
    delete l._clientesMap;
    // ensure date sorting (descending)
    return l;
}).sort((a, b) => new Date(b.data) - new Date(a.data));


const outputPath = path.join(__dirname, 'cobrancas.json');
let oldData = [];
try {
    oldData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
} catch (e) {}

const combinedResult = [...finalL, ...oldData];

fs.writeFileSync(outputPath, JSON.stringify(combinedResult, null, 2));

console.log('Success! Processed', finalL.length, 'leilões');
