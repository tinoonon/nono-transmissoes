// Animações de criar.html e entrar.html (sem alterar formularios.js).
import { reduzMovimento, carregarScript, desativarAnim, $, $$ } from './base.js';
import { normalizarCodigo } from '../sala.js';
import { iniciarBotoes } from './botoes.js';

const form = $('#f-criar') || $('#f-entrar');
const cartao = $('.cartao');
const botao = $('button[type="submit"]', form);

/* ---------- Estado de carregamento ao enviar ---------- */
const textoBotao = [...botao.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
const rotuloOriginal = textoBotao ? textoBotao.textContent : '';

form.addEventListener('submit', () => {
  // Só entra em "carregando" se o formulário é válido (mesma regra do formularios.js).
  const valido = form.id === 'f-criar' || normalizarCodigo($('#codigo').value).length === 6;
  if (!valido) return;
  botao.classList.add('carregando');
  botao.setAttribute('aria-busy', 'true');
  if (textoBotao) textoBotao.textContent = form.id === 'f-criar' ? 'Criando sala… ' : 'Entrando… ';
}, true);

// Voltando pelo histórico (bfcache), restaura o botão.
addEventListener('pageshow', () => {
  botao.classList.remove('carregando');
  botao.removeAttribute('aria-busy');
  if (textoBotao) textoBotao.textContent = rotuloOriginal;
});

/* ---------- Shake discreto quando aparece um erro ---------- */
const erro = $('#erro');
new MutationObserver(() => {
  if (!erro.textContent.trim()) return;
  cartao.classList.remove('treme');
  void cartao.offsetWidth; // reinicia a animação
  cartao.classList.add('treme');
}).observe(erro, { childList: true, characterData: true, subtree: true });
cartao.addEventListener('animationend', () => cartao.classList.remove('treme'));

/* ---------- Feedback por caractere no código ---------- */
const campo = $('#codigo');
let anime = null;
if (campo) {
  const trilha = document.createElement('div');
  trilha.className = 'cod-prog';
  trilha.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 6; i++) trilha.append(document.createElement('i'));
  campo.after(trilha);
  const pontos = [...trilha.children];
  let anterior = 0;

  const atualizar = () => {
    const n = normalizarCodigo(campo.value).length;
    pontos.forEach((p, i) => p.classList.toggle('on', i < n));
    campo.classList.toggle('completo', n === 6);
    if (anime && n > anterior) {
      anime.remove(pontos[n - 1]);
      anime({ targets: pontos[n - 1], scale: [1.9, 1], duration: 380, easing: 'easeOutBack' });
    }
    anterior = n;
  };
  // Espera o formularios.js normalizar o valor antes de ler.
  campo.addEventListener('input', () => requestAnimationFrame(atualizar));
  requestAnimationFrame(atualizar);
}

/* ---------- Entrada animada ---------- */
async function entrada() {
  if (reduzMovimento) return;
  try { await carregarScript('vendor/anime.min.js'); } catch (_) { desativarAnim(); return; }
  anime = window.anime;
  const alvos = $$('.lado > *, .form-topo, .form-miolo > :not(.cartao), .cartao .campo, .cartao .btn.bloco');
  anime({ targets: alvos, opacity: [0, 1], translateY: [16, 0], delay: anime.stagger(60, { start: 80 }), duration: 650, easing: 'easeOutCubic' });
  iniciarBotoes(anime);
}
entrada();
