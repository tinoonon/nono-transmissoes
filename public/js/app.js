import { Sala, normalizarCodigo } from './sala.js';
import { PRESETS } from './qualidade.js';

const $ = (s) => document.querySelector(s);
const el = (tag, classe, texto) => {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto != null) e.textContent = texto;
  return e;
};

let sala = null;
const estado = { tela: false, mic: false, cam: false };
let timerToast = null;

/* ---------- Utilidades de interface ---------- */

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { t.hidden = true; }, 5000);
}

function textoErro(e) {
  const mapa = {
    network: 'Sem conexão com o servidor de sinalização. Verifique sua internet.',
    'server-error': 'O servidor de sinalização não respondeu. Tente novamente em instantes.',
    'socket-error': 'Falha na conexão com o servidor de sinalização.',
    'socket-closed': 'A conexão com o servidor de sinalização foi encerrada.',
    'browser-incompatible': 'Seu navegador não suporta WebRTC.'
  };
  return mapa[e && e.type] || (e && e.message) || 'Ocorreu um erro inesperado.';
}

function erroInicio(msg) { $('#erro-inicio').textContent = msg || ''; }

function marcar(sel, ligado) { $(sel).setAttribute('aria-pressed', String(!!ligado)); }

function addTile(chave, stream, nome, mudo) {
  removerTile(chave);
  const fig = el('figure', 'tile');
  fig.dataset.chave = chave;
  const v = el('video');
  v.autoplay = true;
  v.playsInline = true;
  v.muted = !!mudo;
  v.srcObject = stream;
  fig.append(v, el('figcaption', null, nome));
  if (!stream.getVideoTracks().length) fig.classList.add('somente-audio');
  $('#tiles').append(fig);
  v.play().catch(() => {});
}

function removerTile(chave) {
  document.querySelectorAll('.tile').forEach((t) => { if (t.dataset.chave === chave) t.remove(); });
}

function formatarBitrate(kbps) {
  return kbps >= 1000 ? (kbps / 1000).toFixed(1) + ' Mbps' : Math.round(kbps) + ' kbps';
}

/* ---------- Callbacks da sala ---------- */

const ui = {
  aoLista(itens) {
    $('#lista').replaceChildren(...itens.map((i) => {
      const li = el('li');
      li.append(el('span', null, i.nome), el('small', null, i.papel));
      return li;
    }));
    $('#n-part').textContent = itens.length + ' de 3';
  },
  aoChat(m) {
    const p = el('div', 'msg');
    const hora = new Date(m.hora || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    p.append(el('b', null, m.meu ? 'Você' : m.nome), el('time', null, hora), document.createElement('br'), document.createTextNode(m.texto));
    const log = $('#chat-log');
    log.append(p);
    log.scrollTop = log.scrollHeight;
  },
  aoFluxo(kind, stream, id, nome) {
    if (kind === 'tela') {
      const v = $('#video');
      v.srcObject = stream;
      $('#vazio').hidden = true;
      v.play().catch(() => toast('Clique no vídeo para iniciar a reprodução.'));
    } else {
      addTile(id + ':' + kind, stream, nome, false);
    }
  },
  aoFluxoFim(kind, id) {
    if (kind === 'tela') {
      if (sala && sala.papel === 'host') return;
      $('#video').srcObject = null;
      $('#vazio').hidden = false;
      $('#stats').hidden = true;
    } else {
      removerTile(id + ':' + kind);
    }
  },
  aoStats(s, nivel) {
    const e = $('#stats');
    if (!s || !s.w) { e.hidden = true; return; }
    e.hidden = false;
    e.textContent = `${s.w}×${s.h} · ${Math.round(s.fps || 0)} fps · ${formatarBitrate(s.kbps)}` +
      (nivel > 0 ? ` · qualidade reduzida (nível ${nivel})` : '');
  },
  aoAviso: toast,
  aoTelaParada() {
    estado.tela = false;
    marcar('#btn-tela', false);
    $('#txt-tela').textContent = 'Transmitir tela';
    $('#video').srcObject = null;
    $('#vazio').hidden = false;
    $('#aviso-audio').hidden = true;
    $('#stats').hidden = true;
  },
  aoEncerrar(msg) { voltarInicio(msg); }
};

/* ---------- Fluxo: início e sala ---------- */

function setOcupado(sim) {
  document.querySelectorAll('#inicio .btn').forEach((b) => { b.disabled = sim; });
}

async function iniciar(modo) {
  erroInicio('');
  const nome = $('#nome').value.trim().slice(0, 24);
  setOcupado(true);
  sala = new Sala(ui);
  try {
    if (modo === 'criar') {
      await sala.criar(nome, $('#senha-criar').value);
    } else {
      const cod = normalizarCodigo($('#codigo').value);
      if (cod.length !== 6) throw new Error('Digite o código de 6 caracteres.');
      await sala.entrar(cod, nome, $('#senha-entrar').value);
    }
    abrirSala();
  } catch (e) {
    sala.sair();
    sala = null;
    erroInicio(textoErro(e));
  } finally {
    setOcupado(false);
  }
}

function abrirSala() {
  document.body.dataset.papel = sala.papel === 'host' ? 'host' : 'convidado';
  $('#inicio').hidden = true;
  $('#sala').hidden = false;
  $('#codigo-sala').textContent = sala.codigo;
  $('#video').muted = sala.papel === 'host';
  $('#vazio').firstElementChild.textContent = sala.papel === 'host'
    ? 'Clique em "Transmitir tela" para começar'
    : 'Aguardando o anfitrião iniciar a transmissão';
  document.title = 'Sala ' + sala.codigo + ' · Nono Transmissões';
  if (sala.papel === 'host') {
    const url = new URL(location.href);
    url.search = '?sala=' + sala.codigo;
    url.hash = '';
    $('#link-convite').value = url.toString();
    $('#btn-tela').focus();
  }
  document.body.classList.add('em-sala');
}

function voltarInicio(msg) {
  if (sala) { sala.sair(); sala = null; }
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  Object.assign(estado, { tela: false, mic: false, cam: false });
  ['#btn-tela', '#btn-mic', '#btn-cam'].forEach((s) => marcar(s, false));
  $('#txt-tela').textContent = 'Transmitir tela';
  $('#video').srcObject = null;
  $('#tiles').replaceChildren();
  $('#chat-log').replaceChildren();
  $('#lista').replaceChildren();
  $('#aviso-audio').hidden = true;
  $('#stats').hidden = true;
  $('#vazio').hidden = false;
  $('#sala').hidden = true;
  $('#inicio').hidden = false;
  document.body.dataset.papel = '';
  document.title = 'Nono Transmissões';
  erroInicio(msg || '');
}

/* ---------- Eventos ---------- */

$('#f-criar').addEventListener('submit', (ev) => { ev.preventDefault(); iniciar('criar'); });
$('#f-entrar').addEventListener('submit', (ev) => { ev.preventDefault(); iniciar('entrar'); });
$('#codigo').addEventListener('input', (ev) => { ev.target.value = normalizarCodigo(ev.target.value); });
$('#btn-sair').addEventListener('click', () => voltarInicio(''));
window.addEventListener('beforeunload', () => { if (sala) sala.sair(); });

Object.entries(PRESETS).forEach(([id, p]) => {
  const o = el('option', null, p.rotulo);
  o.value = id;
  if (id === '1080p60') o.selected = true;
  $('#preset').append(o);
});

$('#btn-copiar').addEventListener('click', async () => {
  const campo = $('#link-convite');
  try {
    await navigator.clipboard.writeText(campo.value);
    toast('Link de convite copiado.');
  } catch (_) {
    campo.select();
    toast('Não foi possível copiar sozinho. Use Ctrl+C com o link selecionado.');
  }
});

$('#btn-tela').addEventListener('click', async () => {
  if (!sala) return;
  if (estado.tela) { sala.pararTela(); return; }
  try {
    const r = await sala.iniciarTela($('#preset').value, $('#hint').value);
    estado.tela = true;
    marcar('#btn-tela', true);
    $('#txt-tela').textContent = 'Parar transmissão';
    const v = $('#video');
    v.srcObject = r.stream;
    v.muted = true;
    v.play().catch(() => {});
    $('#vazio').hidden = true;
    $('#aviso-audio').hidden = r.temAudio;
  } catch (e) {
    if (e && e.name === 'NotAllowedError') toast('Compartilhamento cancelado.');
    else toast('Não foi possível iniciar a transmissão: ' + textoErro(e));
  }
});

$('#preset').addEventListener('change', (ev) => { if (sala) sala.mudarPreset(ev.target.value); });
$('#hint').addEventListener('change', (ev) => { if (sala) sala.definirHint(ev.target.value); });
$('#auto').addEventListener('change', (ev) => { if (sala) sala.adaptador.ativo = ev.target.checked; });

$('#btn-mic').addEventListener('click', async () => {
  if (!sala) return;
  try {
    await sala.alternarMic(!estado.mic);
    estado.mic = !estado.mic;
    marcar('#btn-mic', estado.mic);
    if (estado.mic && sala.papel === 'host' && !estado.tela) toast('O microfone será enviado junto com a transmissão de tela.');
  } catch (_) {
    toast('Não foi possível acessar o microfone. Verifique a permissão do navegador.');
  }
});

$('#btn-cam').addEventListener('click', async () => {
  if (!sala) return;
  try {
    const cam = await sala.alternarCamera(!estado.cam);
    estado.cam = !estado.cam;
    marcar('#btn-cam', estado.cam);
    if (cam) addTile('local:camera', cam, 'Você', true);
    else removerTile('local:camera');
  } catch (_) {
    toast('Não foi possível acessar a câmera. Verifique a permissão do navegador.');
  }
});

$('#volume').addEventListener('input', (ev) => { $('#video').volume = Number(ev.target.value); });
$('#video').addEventListener('click', () => $('#video').play().catch(() => {}));

$('#btn-fs').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else $('#video-wrap').requestFullscreen().catch(() => toast('Tela cheia indisponível neste navegador.'));
});

$('#btn-pip').addEventListener('click', async () => {
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await $('#video').requestPictureInPicture();
  } catch (_) {
    toast('A janela flutuante só funciona depois que a transmissão começar.');
  }
});
if (!document.pictureInPictureEnabled) $('#btn-pip').hidden = true;

$('#f-chat').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const campo = $('#chat-texto');
  const texto = campo.value.trim();
  if (!texto || !sala) return;
  sala.enviarChat(texto);
  campo.value = '';
});

/* ---------- Link de convite ---------- */

const codigoUrl = normalizarCodigo(new URLSearchParams(location.search).get('sala'));
if (codigoUrl) {
  $('#codigo').value = codigoUrl;
  $('#nome').focus();
}
