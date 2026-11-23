import { normalizarCodigo } from './sala.js';

const $ = (s) => document.querySelector(s);
const ENTRADA = 'nono:entrada';
const ERRO = 'nono:erro';
const NOME = 'nono:nome';

function guardar(k, v) { try { sessionStorage.setItem(k, v); } catch (_) { /* modo privado restrito */ } }
function ler(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } }
function apagar(k) { try { sessionStorage.removeItem(k); } catch (_) { /* nada */ } }

function mostrarErro(msg) {
  const e = $('#erro');
  e.textContent = msg || '';
}

// Mensagem deixada pela sala (falha de conexão, sala cheia, senha errada etc.)
const erroSalvo = ler(ERRO);
if (erroSalvo) { mostrarErro(erroSalvo); apagar(ERRO); }

const nomeSalvo = ler(NOME);
if (nomeSalvo) $('#nome').value = nomeSalvo;

function enviar(dados) {
  guardar(NOME, dados.nome);
  guardar(ENTRADA, JSON.stringify(dados));
  location.href = 'sala.html';
}

const fCriar = $('#f-criar');
if (fCriar) {
  $('#nome').focus();
  fCriar.addEventListener('submit', (ev) => {
    ev.preventDefault();
    enviar({
      modo: 'criar',
      nome: $('#nome').value.trim().slice(0, 24),
      senha: $('#senha').value
    });
  });
}

const fEntrar = $('#f-entrar');
if (fEntrar) {
  const campo = $('#codigo');
  const doLink = normalizarCodigo(new URLSearchParams(location.search).get('sala'));
  if (doLink) campo.value = doLink;
  (doLink ? $('#nome') : campo).focus();
  campo.addEventListener('input', (ev) => { ev.target.value = normalizarCodigo(ev.target.value); });
  fEntrar.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const codigo = normalizarCodigo(campo.value);
    if (codigo.length !== 6) { mostrarErro('Digite o código de 6 caracteres.'); campo.focus(); return; }
    enviar({
      modo: 'entrar',
      codigo,
      nome: $('#nome').value.trim().slice(0, 24),
      senha: $('#senha').value
    });
  });
}
