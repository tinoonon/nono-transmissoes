import { copyFileSync, mkdirSync, existsSync } from 'node:fs';

const origem = 'node_modules/peerjs/dist/peerjs.min.js';
if (!existsSync(origem)) {
  console.error('PeerJS não encontrado. Rode "npm install" antes de "npm run build".');
  process.exit(1);
}
mkdirSync('public/vendor', { recursive: true });
copyFileSync(origem, 'public/vendor/peerjs.min.js');
console.log('PeerJS copiado para public/vendor/peerjs.min.js');
