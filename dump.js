const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:\\Users\\Carlo\\OneDrive\\Área de Trabalho\\Dashboard Leilão\\debug_payloads.json', 'utf8'));
const upserts = d.filter(e => e.evento === 'messages.upsert');

console.log(`Encontrados ${upserts.length} eventos messages.upsert`);
upserts.forEach((e, i) => {
    console.log(`\n--- Evento ${i + 1} ---`);
    console.log(JSON.stringify(e.payloadCompleto.data, null, 2));
});
