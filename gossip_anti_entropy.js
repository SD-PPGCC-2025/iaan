const dgram = require('dgram');
const readline = require('readline');

const PORT = process.argv[2] ? parseInt(process.argv[2]) : 5000;
let PEERS = process.argv.slice(3);

const SYNC_INTERVAL = 5000; 

const server = dgram.createSocket('udp4');
const knownMessages = {};

function logPeers() {
  if (PEERS.length === 0) {
    console.log(`[INFO] Nenhum peer conhecido no momento.`);
  } else {
    console.log(`[INFO] Peers conhecidos:`);
    PEERS.forEach((peer, idx) => {
      console.log(`  [${idx}] ${peer}`);
    });
  }
  
}

function sendSyncRequest(peer) {
  const [host, port] = peer.split(':');
  const message = {
    type: 'sync_request',
    knownIds: Object.keys(knownMessages)
  };
  server.send(Buffer.from(JSON.stringify(message)), 0, JSON.stringify(message).length, parseInt(port), host);
  console.log(`[ANTI-ENTROPY] Enviando sync_request para ${peer}`);
}

function sendSyncResponse(peer, missingMessages) {
  const [host, port] = peer.split(':');
  const message = {
    type: 'sync_response',
    messages: missingMessages
  };
  server.send(Buffer.from(JSON.stringify(message)), 0, JSON.stringify(message).length, parseInt(port), host);
  console.log(`[ANTI-ENTROPY] Enviando sync_response para ${peer} (${Object.keys(missingMessages).length} mensagens)`);
}

function pickRandomPeer() {
  if (PEERS.length === 0) return null;
  const idx = Math.floor(Math.random() * PEERS.length);
  return PEERS[idx];
}

server.on('message', (msg, rinfo) => {
  try {
    const data = JSON.parse(msg.toString());
    if (data.type === 'sync_request') {
      // Recebeu pedido de sincronização: envie as mensagens que o peer não tem
      const missing = {};
      for (const id in knownMessages) {
        if (!data.knownIds.includes(id)) {
          missing[id] = knownMessages[id];
        }
      }
      sendSyncResponse(`${rinfo.address}:${rinfo.port}`, missing);
    } else if (data.type === 'sync_response') {
      // Recebeu mensagens que faltavam
      let count = 0;
      for (const id in data.messages) {
        if (!knownMessages[id]) {
          knownMessages[id] = data.messages[id];
          console.log(`[SINCRONIZADO] Nova mensagem recebida via anti-entropy: "${data.messages[id]}"`);
          count++;
        }
      }
      if (count > 0) {
        console.log(`[ANTI-ENTROPY] Sincronização trouxe ${count} novas mensagens.`);
      }
    } else if (data.type === 'new_message') {
      // Mensagem nova criada manualmente
      if (!knownMessages[data.id]) {
        knownMessages[data.id] = data.text;
        console.log(`[RECEBIDO] Nova mensagem recebida: "${data.text}"`);
      }
    }
  } catch (e) {
    console.log(`[ERRO] Mensagem inválida recebida de ${rinfo.address}:${rinfo.port}`);
  }
});

server.on('listening', () => {
  const address = server.address();
  console.log(`[INICIADO] Nó anti-entropy rodando em ${address.address}:${address.port}`);
  logPeers();
  console.log(`[DICA] Digite uma mensagem para criar uma nova mensagem.`);
  console.log(`[DICA] Comandos:`);
  console.log(`  /add host:porta         -> adiciona peer`);
  console.log(`  /remove host:porta      -> remove peer`);
  console.log(`  /peers                  -> lista peers`);
  console.log(`  /messages               -> lista mensagens conhecidas`);
  console.log(`  /delete-message id      -> deleta mensagem localmente`);
  console.log(`  /help                   -> mostra comandos`);
});

server.bind(PORT);

// Ciclo anti-entropy: periodicamente sincroniza com um peer aleatório
setInterval(() => {
  const peer = pickRandomPeer();
  if (peer) {
    sendSyncRequest(peer);
  }
    const ids = Object.keys(knownMessages);
    if (ids.length === 0) {
      console.log('[MESSAGES] Nenhuma mensagem conhecida.');
    } else {
      console.log('[MESSAGES] Mensagens conhecidas:');
      ids.forEach(id => {
        console.log(`  ${id}: "${knownMessages[id]}"`);
      });
    }
}, SYNC_INTERVAL);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function sendNewMessage(text) {
  const id = `${PORT}-${Date.now()}`;
  knownMessages[id] = text;
  // Propaga para todos os peers imediatamente
  // PEERS.forEach(peer => {
  //   const [host, port] = peer.split(':');
  //   const msg = {
  //     type: 'new_message',
  //     id,
  //     text
  //   };
  //   server.send(Buffer.from(JSON.stringify(msg)), 0, JSON.stringify(msg).length, parseInt(port), host);
  // });
  console.log(`[NOVA] Mensagem criada: "${text}"`);
}

function addPeer(peer) {
  if (!PEERS.includes(peer)) {
    PEERS.push(peer);
    console.log(`[PEER] Adicionado: ${peer}`);
  } else {
    console.log(`[PEER] Peer já existe: ${peer}`);
  }
  logPeers();
}

function removePeer(peer) {
  if (PEERS.includes(peer)) {
    PEERS = PEERS.filter(p => p !== peer);
    console.log(`[PEER] Removido: ${peer}`);
  } else {
    console.log(`[PEER] Peer não encontrado: ${peer}`);
  }
  logPeers();
}

rl.on('line', (input) => {
  const trimmed = input.trim();
  if (trimmed.startsWith('/add ')) {
    const peer = trimmed.slice(5);
    addPeer(peer);
  } else if (trimmed.startsWith('/remove ')) {
    const peer = trimmed.slice(8);
    removePeer(peer);
  } else if (trimmed === '/peers') {
    logPeers();
  } else if (trimmed === '/help') {
    console.log(`Comandos disponíveis:`);
    console.log(`  /add host:porta         -> adiciona peer`);
    console.log(`  /remove host:porta      -> remove peer`);
    console.log(`  /peers                  -> lista peers`);
    console.log(`  /messages               -> lista mensagens conhecidas`);
    console.log(`  /delete-message id      -> deleta mensagem localmente`);
    console.log(`  /help                   -> mostra comandos`);
  } else if (trimmed === '/messages') {
    const ids = Object.keys(knownMessages);
    if (ids.length === 0) {
      console.log('[MESSAGES] Nenhuma mensagem conhecida.');
    } else {
      console.log('[MESSAGES] Mensagens conhecidas:');
      ids.forEach(id => {
        console.log(`  ${id}: "${knownMessages[id]}"`);
      });
    }
  } else if (trimmed.startsWith('/delete-message ')) {
    const id = trimmed.slice(16).trim();
    if (knownMessages[id]) {
      delete knownMessages[id];
      console.log(`[DELETE] Mensagem ${id} removida localmente.`);
    } else {
      console.log(`[DELETE] Mensagem ${id} não encontrada.`);
    }
  } else if (trimmed.length > 0) {
    sendNewMessage(trimmed);
  }
});

/**
 * node gossip_anti_entropy.js 5000 localhost:5001 localhost:5002
node gossip_anti_entropy.js 5001 localhost:5000 localhost:5002
node gossip_anti_entropy.js 5002 localhost:5000 localhost:5001
 */