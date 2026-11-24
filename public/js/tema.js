// Sistema de tema escuro/claro
(function() {
  const CHAVE_TEMA = 'nono-tema';
  
  // Função para obter o tema armazenado ou preferência do sistema
  function obterTemaInicial() {
    const temaArmazenado = localStorage.getItem(CHAVE_TEMA);
    if (temaArmazenado) return temaArmazenado;
    
    // Verifica preferência do sistema
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'escuro';
    }
    return 'claro';
  }
  
  // Aplica o tema no documento
  function aplicarTema(tema) {
    if (tema === 'escuro') {
      document.documentElement.setAttribute('data-tema', 'escuro');
    } else {
      document.documentElement.removeAttribute('data-tema');
    }
    localStorage.setItem(CHAVE_TEMA, tema);
  }
  
  // Alterna entre claro e escuro
  function alternarTema() {
    const temaAtual = document.documentElement.getAttribute('data-tema') === 'escuro' ? 'escuro' : 'claro';
    const novoTema = temaAtual === 'escuro' ? 'claro' : 'escuro';
    aplicarTema(novoTema);
  }
  
  // Aplica tema inicial imediatamente (antes da página carregar)
  aplicarTema(obterTemaInicial());
  
  // Aguarda o DOM carregar para adicionar listeners
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
  
  function inicializar() {
    // Adiciona listener nos botões de tema
    document.querySelectorAll('.btn-tema').forEach(btn => {
      btn.addEventListener('click', alternarTema);
    });
    
    // Escuta mudanças na preferência do sistema (opcional)
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        // Só aplica se o usuário não tiver escolhido manualmente
        if (!localStorage.getItem(CHAVE_TEMA)) {
          aplicarTema(e.matches ? 'escuro' : 'claro');
        }
      });
    }
  }
})();
