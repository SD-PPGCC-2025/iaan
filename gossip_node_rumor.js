const dgram = require('dgram');
const readline = require('readline');

const PORT = process.argv[2] ? parseInt(process.argv[2]) : 4000;
let PEERS = process.argv.slice(3);

const server = dgram.createSocket('udp4');




const knownRumors = new Set(); // Armazena apenas os IDs dos rumores já vistos

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

function sendRumor(rumor, excludePeer = null) {
  const message = Buffer.from(JSON.stringify(rumor));
  const peersToSend = PEERS.filter(p => p !== excludePeer);
  if (peersToSend.length === 0) return;
  // Envia para 2 peers aleatórios (ou menos)
  const shuffled = peersToSend.sort(() => 0.5 - Math.random());
  const targets = shuffled.slice(0, Math.min(2, shuffled.length));
  targets.forEach(peer => {
    const [host, port] = peer.split(':');
    console.log(`[GOSSIP] Enviando rumor "${rumor.text}" para ${peer}`);
    server.send(message, 0, message.length, parseInt(port), host);
  });
}

server.on('message', (msg, rinfo) => {
  try {
    const rumor = JSON.parse(msg.toString());
    if (!knownRumors.has(rumor.id)) {
      knownRumors.add(rumor.id);
      console.log(`[RECEBIDO] Novo rumor recebido de ${rinfo.address}:${rinfo.port}: "${rumor.text}"`);
      sendRumor(rumor, `${rinfo.address}:${rinfo.port}`);
    } else {
      // Não repassa rumores já conhecidos
     console.log(`[IGNORADO] Rumor já conhecido: "${rumor.text}" -> Não repassado`);
    }
  } catch (e) {
    console.log(`[ERRO] Mensagem inválida recebida de ${rinfo.address}:${rinfo.port}`);
  }
});

server.on('listening', () => {
  const address = server.address();
  console.log(`[INICIADO] Nó gossip rodando em ${address.address}:${address.port}`);
  logPeers();
  console.log(`[DICA] Digite uma mensagem para iniciar um rumor.`);
  console.log(`[DICA] Comandos:`);
  console.log(`  /add host:porta   -> adiciona peer`);
  console.log(`  /remove host:porta -> remove peer`);
  console.log(`  /peers           -> lista peers`);
  console.log(`  /help            -> mostra comandos`);
});

server.bind(PORT);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function sendNewRumor(text) {
  const rumor = {
    id: `${PORT}-${Date.now()}`,
    text
  };
  knownRumors.add(rumor.id);
  console.log(`[NOVO RUMOR] Iniciando rumor: "${text}"`);
  sendRumor(rumor);
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
    console.log(`  /add host:porta   -> adiciona peer`);
    console.log(`  /remove host:porta -> remove peer`);
    console.log(`  /peers           -> lista peers`);
    console.log(`  /help            -> mostra comandos`);
  } else if (trimmed.length > 0) {
    sendNewRumor(trimmed);
  }
});


/**
 * 
  node gossip_node_rumor.js 4000 localhost:4001 localhost:4002
  node gossip_node_rumor.js 4001 localhost:4000 localhost:4002
  node gossip_node_rumor.js 4002 localhost:4000 localhost:4001
 */