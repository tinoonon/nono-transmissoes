import { copyFileSync, mkdirSync, existsSync } from 'node:fs';

// Copia as bibliotecas do node_modules para public/vendor (CSP: só scripts locais).
const arquivos = [
  ['node_modules/peerjs/dist/peerjs.min.js', 'peerjs.min.js'],
  ['node_modules/three/build/three.module.min.js', 'three.module.min.js'],
  ['node_modules/gsap/dist/gsap.min.js', 'gsap.min.js'],
  ['node_modules/gsap/dist/ScrollTrigger.min.js', 'ScrollTrigger.min.js'],
  ['node_modules/animejs/lib/anime.min.js', 'anime.min.js']
];

mkdirSync('public/vendor', { recursive: true });
for (const [origem, nome] of arquivos) {
  if (!existsSync(origem)) {
    console.error(`${origem} não encontrado. Rode "npm install" antes de "npm run build".`);
    process.exit(1);
  }
  copyFileSync(origem, `public/vendor/${nome}`);
  console.log(`Copiado: public/vendor/${nome}`);
}
