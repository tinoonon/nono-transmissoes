// Ajuda: destaque da seção ativa no índice e abertura animada do FAQ.
import { reduzMovimento, carregarScript, $, $$ } from './base.js';

async function principal() {
  try {
    await carregarScript('vendor/gsap.min.js');
    await carregarScript('vendor/ScrollTrigger.min.js');
  } catch (_) { return; } // sem biblioteca: índice e FAQ nativos continuam funcionando
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  /* Índice: marca a seção visível (não é movimento, vale também com reduced-motion) */
  const links = new Map($$('.indice a').map((a) => [a.getAttribute('href').slice(1), a]));
  const marcar = (id) => links.forEach((a, k) => {
    a.classList.toggle('ativo', k === id);
    if (k === id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
  });
  const secoes = $$('.texto section[id]');
  if (secoes[0]) marcar(secoes[0].id);
  secoes.forEach((s) => ScrollTrigger.create({
    trigger: s, start: 'top 35%', end: 'bottom 35%',
    onToggle: (self) => { if (self.isActive) marcar(s.id); }
  }));

  /* FAQ: só opacidade e transform no texto; com reduced-motion fica o comportamento nativo */
  if (reduzMovimento) return;
  $$('details.faq').forEach((d) => {
    const p = $('p', d);
    $('summary', d).addEventListener('click', (ev) => {
      ev.preventDefault();
      if (d.dataset.anim) return;
      gsap.killTweensOf(p);
      if (!d.open) {
        d.open = true;
        gsap.fromTo(p, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', clearProps: 'all' });
        ScrollTrigger.refresh();
      } else {
        d.dataset.anim = '1';
        gsap.to(p, { opacity: 0, y: -10, duration: 0.2, ease: 'power2.in', onComplete() {
          d.open = false; delete d.dataset.anim; gsap.set(p, { clearProps: 'all' }); ScrollTrigger.refresh();
        } });
      }
    });
  });
}
principal();
