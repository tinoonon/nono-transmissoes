// Microinterações dos botões (anime.js): efeito magnético sutil e seta deslizando.
import { $$, reduzMovimento } from './base.js';

export function iniciarBotoes(anime) {
  if (reduzMovimento || !anime) return;
  const fino = matchMedia('(hover: hover) and (pointer: fine)').matches;

  $$('.btn').forEach((b) => {
    if (b.closest('.dock')) return;
    const seta = b.querySelector('use[href$="#i-arrow"]')?.closest('svg');
    const limite = (v, m) => Math.max(-m, Math.min(m, v));

    const mover = (x, y, dur, easing) => {
      anime.remove(b);
      anime({ targets: b, translateX: x, translateY: y, duration: dur, easing });
    };
    const deslizar = (x) => {
      if (!seta) return;
      anime.remove(seta);
      anime({ targets: seta, translateX: x, duration: 260, easing: 'easeOutQuad' });
    };

    b.addEventListener('pointerenter', () => deslizar(5));
    b.addEventListener('pointerleave', () => { deslizar(0); mover(0, 0, 700, 'easeOutElastic(1, .6)'); });
    b.addEventListener('focus', () => deslizar(5));
    b.addEventListener('blur', () => deslizar(0));

    if (fino) {
      b.addEventListener('pointermove', (ev) => {
        const r = b.getBoundingClientRect();
        const dx = (ev.clientX - (r.left + r.width / 2)) * 0.16;
        const dy = (ev.clientY - (r.top + r.height / 2)) * 0.22;
        mover(limite(dx, 6), limite(dy, 4), 250, 'easeOutQuad');
      });
    }
  });
}
