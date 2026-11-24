// Sistema de tema escuro/claro (gerenciamento do botão)
(function() {
  'use strict';
  
  var CHAVE_TEMA = 'nono:tema';
  
  function aplicarTema(tema) {
    if (tema === 'escuro') {
      document.documentElement.setAttribute('data-tema', 'escuro');
    } else {
      document.documentElement.removeAttribute('data-tema');
    }
    
    try {
      localStorage.setItem(CHAVE_TEMA, tema);
    } catch (e) {
      // localStorage indisponível
    }
    
    atualizarBotoes(tema);
  }
  
  function obterTemaAtual() {
    return document.documentElement.getAttribute('data-tema') === 'escuro' ? 'escuro' : 'claro';
  }
  
  function alternarTema() {
    var temaAtual = obterTemaAtual();
    var novoTema = temaAtual === 'escuro' ? 'claro' : 'escuro';
    aplicarTema(novoTema);
  }
  
  function atualizarBotoes(tema) {
    var botoes = document.querySelectorAll('.btn-tema');
    botoes.forEach(function(btn) {
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', tema === 'escuro' ? 'Mudar para tema claro' : 'Mudar para tema escuro');
    });
  }
  
  function inicializar() {
    var botoes = document.querySelectorAll('.btn-tema');
    
    botoes.forEach(function(btn) {
      btn.addEventListener('click', alternarTema);
    });
    
    atualizarBotoes(obterTemaAtual());
    
    // Escuta mudanças na preferência do sistema
    if (window.matchMedia) {
      var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      var listener = function(e) {
        try {
          var armazenado = localStorage.getItem(CHAVE_TEMA);
          if (!armazenado) {
            aplicarTema(e.matches ? 'escuro' : 'claro');
          }
        } catch (err) {
          // localStorage indisponível
        }
      };
      
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', listener);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(listener);
      }
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
