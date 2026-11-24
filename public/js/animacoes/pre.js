// Marca a página como "animável" antes da primeira pintura (evita flash de conteúdo).
// Sem movimento (preferência do usuário) ou aberta via file:// (módulos ES não rodam), nada é escondido.
if (location.protocol !== 'file:' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('anim');
}
