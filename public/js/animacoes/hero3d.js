// Cena 3D leve do hero: monitor flutuante azul e preto, grade e partículas sutis.
// Só é importado dinamicamente quando o hero fica visível.
import * as THREE from '../../vendor/three.module.min.js';

function retangulo(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fill();
}

// Desenha a "tela" do monitor, espelhando o mock em CSS.
function texturaTela() {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 400;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 640, 400);
  grad.addColorStop(0, '#12306e'); grad.addColorStop(0.55, '#0b1530'); grad.addColorStop(1, '#0a0d14');
  g.fillStyle = grad; g.fillRect(0, 0, 640, 400);
  [[0.62, 'rgba(96,165,250,.85)'], [0.82, 'rgba(255,255,255,.16)'], [0.48, 'rgba(255,255,255,.16)'],
   [0.7, 'rgba(96,165,250,.45)'], [0.36, 'rgba(255,255,255,.16)']].forEach(([w, cor], i) => {
    g.fillStyle = cor; retangulo(g, 44, 118 + i * 44, w * 540, 20, 10);
  });
  g.fillStyle = '#2563eb'; retangulo(g, 24, 24, 112, 32, 16);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(44, 40, 5, 0, 7); g.fill();
  g.font = '700 15px system-ui, sans-serif'; g.textBaseline = 'middle';
  g.fillText('AO VIVO', 58, 41);
  g.fillStyle = 'rgba(10,13,20,.8)'; retangulo(g, 330, 346, 286, 34, 9);
  g.fillStyle = '#dbe6ff'; g.font = '14px ui-monospace, monospace';
  g.fillText('1920×1080 · 60 fps · 8,0 Mbps', 344, 364);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function iniciar(visual, canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // máximo 2
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 11, 22);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);

  scene.add(new THREE.AmbientLight(0xffffff, 1.3));
  const sol = new THREE.DirectionalLight(0x9dbcff, 2.4); sol.position.set(3, 4, 5); scene.add(sol);
  const azul = new THREE.PointLight(0x2563eb, 45, 12); azul.position.set(-3, 1, 3); scene.add(azul);

  // Monitor
  const monitor = new THREE.Group();
  const corpoGeo = new THREE.BoxGeometry(4, 2.6, 0.22);
  const corpo = new THREE.Mesh(corpoGeo, new THREE.MeshStandardMaterial({ color: 0x0a0d14, metalness: 0.5, roughness: 0.4 }));
  const borda = new THREE.LineSegments(new THREE.EdgesGeometry(corpoGeo), new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.85 }));
  const textura = texturaTela();
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 2.3), new THREE.MeshBasicMaterial({ map: textura, toneMapped: false }));
  tela.position.z = 0.115;
  const pescoco = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.18), corpo.material);
  pescoco.position.y = -1.65;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1, 0.08, 48), corpo.material);
  base.position.y = -2.05;
  monitor.add(corpo, borda, tela, pescoco, base);
  scene.add(monitor);

  // Anel azul atrás do monitor
  const anel = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.015, 8, 120), new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.5 }));
  anel.position.z = -1.2; scene.add(anel);

  // Grade no chão (se desloca uma célula e reinicia, sem emendas)
  const grade = new THREE.GridHelper(24, 24, 0x2563eb, 0x93b4f5);
  grade.material.transparent = true; grade.material.opacity = 0.32;
  grade.position.y = -2.1; scene.add(grade);

  // Partículas sutis
  const N = 140, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 14;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 7;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1;
  }
  const geoP = new THREE.BufferGeometry();
  geoP.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const particulas = new THREE.Points(geoP, new THREE.PointsMaterial({ color: 0x3b82f6, size: 0.05, transparent: true, opacity: 0.7, depthWrite: false }));
  scene.add(particulas);

  // Estado de interação
  const alvo = { x: 0, y: 0 }, atual = { x: 0, y: 0 };
  let rolagem = 0, rolAtual = 0, visivel = true, raf = 0;
  const relogio = new THREE.Clock();

  function redimensionar() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); // false: não escreve style inline (CSP)
    camera.aspect = w / h;
    camera.position.set(0, 1.9, 11.5 * Math.max(1, 1.25 / camera.aspect));
    camera.lookAt(0, -0.5, 0);
    camera.updateProjectionMatrix();
  }

  function quadro() {
    raf = requestAnimationFrame(quadro);
    const t = relogio.getElapsedTime();
    atual.x += (alvo.x - atual.x) * 0.06; atual.y += (alvo.y - atual.y) * 0.06;
    rolAtual += (rolagem - rolAtual) * 0.08;
    monitor.rotation.y = -0.35 + atual.x * 0.35 + rolAtual * 0.9;
    monitor.rotation.x = 0.05 + atual.y * 0.12;
    monitor.position.y = Math.sin(t * 1.1) * 0.1 - rolAtual * 0.6;
    particulas.rotation.y = t * 0.02; particulas.position.y = rolAtual * 0.8;
    anel.rotation.z = t * 0.1;
    grade.position.z = (t * 0.3) % 1;
    renderer.render(scene, camera);
  }

  // Roda apenas com a cena visível e a aba ativa.
  function atualizar() {
    const deve = visivel && !document.hidden;
    if (deve && !raf) { relogio.getDelta(); raf = requestAnimationFrame(quadro); }
    else if (!deve && raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  const aoMouse = (e) => { alvo.x = (e.clientX / innerWidth) * 2 - 1; alvo.y = (e.clientY / innerHeight) * 2 - 1; };
  const aoRolar = () => { rolagem = Math.min(1, Math.max(0, scrollY / Math.max(1, visual.offsetHeight * 1.6))); };
  const io = new IntersectionObserver((es) => { visivel = es[0].isIntersecting; atualizar(); });
  const ro = new ResizeObserver(redimensionar);

  io.observe(visual); ro.observe(canvas);
  addEventListener('pointermove', aoMouse, { passive: true });
  addEventListener('scroll', aoRolar, { passive: true });
  document.addEventListener('visibilitychange', atualizar);

  function destruir() {
    cancelAnimationFrame(raf); raf = 0;
    io.disconnect(); ro.disconnect();
    removeEventListener('pointermove', aoMouse); removeEventListener('scroll', aoRolar);
    document.removeEventListener('visibilitychange', atualizar);
    scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    textura.dispose(); renderer.dispose();
  }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); destruir(); visual.classList.remove('tem3d'); });
  addEventListener('pagehide', destruir, { once: true });

  redimensionar();
  aoRolar();
  renderer.render(scene, camera); // primeiro quadro antes de esconder o mock
  atualizar();
  return destruir;
}
