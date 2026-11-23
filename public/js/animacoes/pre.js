// Marca a página como "animável" antes da primeira pintura (evita flash de conteúdo).
// Se o usuário prefere menos movimento, nada é escondido nem animado.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('anim');
}
