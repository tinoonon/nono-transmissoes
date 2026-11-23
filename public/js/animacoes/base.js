// Utilitários compartilhados pelos módulos de animação.
export const reduzMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const cache = new Map();

/** Carrega um script local (UMD) uma única vez. A CSP permite apenas 'self'. */
export function carregarScript(src) {
  if (!cache.has(src)) {
    cache.set(src, new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => falha(new Error('Falha ao carregar ' + src));
      document.head.append(s);
    }));
  }
  return cache.get(src);
}

/** Se uma biblioteca falhar, volta ao conteúdo estático (nada fica escondido). */
export function desativarAnim() {
  document.documentElement.classList.remove('anim');
}

/** Executa cb uma vez, quando o elemento estiver (quase) visível. */
export function aoFicarVisivel(el, cb, margem = '150px') {
  if (!('IntersectionObserver' in window)) { cb(); return; }
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { io.disconnect(); cb(); }
  }, { rootMargin: margem });
  io.observe(el);
}

export function temWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (_) { return false; }
}
