// Animações da página inicial: título, recursos, passos, botões e cena 3D.
import { reduzMovimento, carregarScript, desativarAnim, aoFicarVisivel, temWebGL, $, $$ } from './base.js';
import { iniciarBotoes } from './botoes.js';

// Quebra o título em palavras (mantém o <em> e os espaços originais).
function dividirPalavras(h1) {
  const quebrar = (no) => {
    [...no.childNodes].forEach((f) => {
      if (f.nodeType === 3) {
        const frag = document.createDocumentFragment();
        f.textContent.split(/(\s+)/).forEach((p) => {
          if (!p) return;
          if (/^\s+$/.test(p)) frag.append(p);
          else { const s = document.createElement('span'); s.className = 'pal'; s.textContent = p; frag.append(s); }
        });
        f.replaceWith(frag);
      } else if (f.nodeType === 1) quebrar(f);
    });
  };
  quebrar(h1);
  h1.classList.add('pronto');
}

function entradaHero(gsap) {
  const h1 = $('.heroi h1');
  dividirPalavras(h1);
  const em = $('em', h1);
  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .fromTo('.heroi .selo', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5 })
    .fromTo('.heroi h1 .pal', { opacity: 0, y: '0.6em', rotate: 3 }, { opacity: 1, y: 0, rotate: 0, duration: 0.7, stagger: 0.07 }, '-=0.2')
    .add(() => em && em.classList.add('on'), '-=0.1')
    .fromTo(['.heroi .lead', '.heroi .acoes', '.heroi .provas'], { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 }, '-=0.45');
}

function recursos(gsap, ScrollTrigger) {
  const cards = $$('.recurso');
  gsap.set(cards, { opacity: 0, y: 28 });
  ScrollTrigger.batch(cards, {
    start: 'top 88%', once: true,
    onEnter: (lote) => gsap.to(lote, {
      opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out', overwrite: true,
      onComplete() { lote.forEach((e) => { e.classList.add('visto'); gsap.set(e, { clearProps: 'all' }); }); }
    })
  });
}

function passos(gsap, ScrollTrigger) {
  const caixa = $('.passos');
  const prog = $('.passos-prog');
  const numeros = $$('.passo .n');
  if (!caixa || !prog) return;
  const alvos = numeros.map((n) => parseInt(n.textContent, 10));
  const feito = numeros.map(() => false);
  numeros.forEach((n) => { n.textContent = '00'; });

  const contar = (i) => {
    const n = numeros[i], o = { v: 0 };
    gsap.to(o, { v: alvos[i], duration: 0.9, ease: 'power1.out', onUpdate() { n.textContent = String(Math.round(o.v)).padStart(2, '0'); } });
    gsap.fromTo(n, { scale: 1.18, transformOrigin: 'left center' }, { scale: 1, duration: 0.6, ease: 'back.out(2)' });
  };
  const aoAtualizar = (self) => {
    numeros.forEach((_, i) => {
      if (!feito[i] && self.progress >= (i + 0.35) / numeros.length) { feito[i] = true; contar(i); }
    });
  };

  const mm = gsap.matchMedia();
  const gatilho = { trigger: caixa, start: 'top 80%', end: 'bottom 55%', scrub: 0.4, onUpdate: aoAtualizar };
  mm.add('(min-width: 961px)', () => { gsap.fromTo(prog, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: gatilho }); });
  mm.add('(max-width: 960px)', () => { gsap.fromTo(prog, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: gatilho }); });
}

function cena3d() {
  const visual = $('.heroi .visual'), canvas = $('.cena3d');
  if (!visual || !canvas || navigator.connection?.saveData || !temWebGL()) return;
  aoFicarVisivel(visual, async () => {
    try {
      const { iniciar } = await import('./hero3d.js');
      iniciar(visual, canvas);
      visual.classList.add('tem3d');
    } catch (_) { /* mantém o mock em CSS */ }
  });
}

async function principal() {
  if (reduzMovimento) return; // sem movimento: página estática e sem 3D
  try {
    await Promise.all([carregarScript('vendor/gsap.min.js'), carregarScript('vendor/anime.min.js')]);
    await carregarScript('vendor/ScrollTrigger.min.js');
  } catch (_) { desativarAnim(); return; }

  const { gsap, ScrollTrigger, anime } = window;
  gsap.registerPlugin(ScrollTrigger);
  entradaHero(gsap);
  recursos(gsap, ScrollTrigger);
  passos(gsap, ScrollTrigger);
  gsap.to('.heroi .visual', { y: -30, ease: 'none', scrollTrigger: { trigger: '.heroi', start: 'top top', end: 'bottom top', scrub: true } });
  iniciarBotoes(anime);
  cena3d();
}
principal();
