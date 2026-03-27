const io = require('socket.io-client');

// Connect to Evolution API WebSocket (assuming it uses socket.io at the root or /socket.io/)
// In Evolution API v1 it was specific namespaces, in v2 it's usually the root.
const socket = io('http://localhost:8080/', {
    transports: ['websocket'],
    // query: { apikey: 'D7C05CEA1C64-4B63-A232-BA09E6F3DD41' }
});

socket.on('connect', () => {
    console.log('Connected to Evolution API WebSocket!');
});

// Listen to all events
socket.onAny((eventName, ...args) => {
    console.log(`[WS Event] ${eventName}`);
    const dataStr = JSON.stringify(args);
    if (dataStr.includes('poll') || dataStr.includes('vote') || dataStr.includes('selectedOption')) {
        console.log('!!! ACHOU POLL DATA NO WEBSOCKET !!!');
        console.log(JSON.stringify(args, null, 2));
    }
});

socket.on('connect_error', (error) => {
    console.error('Connection Error:', error.message);
    process.exit(1);
});

// Run for 30 seconds then exit
setTimeout(() => {
    console.log('Exiting WS test...');
    process.exit(0);
}, 30000);
