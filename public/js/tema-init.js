// Inicialização síncrona do tema (evita flash)
(function() {
  'use strict';
  
  function obterTemaInicial() {
    try {
      var armazenado = localStorage.getItem('nono:tema');
      if (armazenado === 'claro' || armazenado === 'escuro') {
        return armazenado;
      }
    } catch (e) {
      // localStorage indisponível
    }
    
    // Preferência do sistema
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'escuro';
    }
    
    return 'claro';
  }
  
  var tema = obterTemaInicial();
  if (tema === 'escuro') {
    document.documentElement.setAttribute('data-tema', 'escuro');
  }
})();
