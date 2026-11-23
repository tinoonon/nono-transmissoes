import { Sala } from './sala.js';
import { PRESETS } from './qualidade.js';

const $ = (s) => document.querySelector(s);
const el = (tag, classe, texto) => {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto != null) e.textContent = texto;
  return e;
};

let sala = null;
let entrada = null;
const estado = { tela: false, mic: false, cam: false };
let timerToast = null;

/* ---------- Utilidades ---------- */

function guardar(k, v) { try { sessionStorage.setItem(k, v); } catch (_) { /* nada */ } }

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

/* ---------- Saída da sala (troca de página) ---------- */

function sairDaSala(destino, msg) {
  if (sala) { sala.sair(); sala = null; }
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  if (msg) guardar('nono:erro', msg);
  location.replace(destino);
}

function paginaDeRetorno() {
  if (entrada && entrada.modo === 'entrar') return 'entrar.html?sala=' + encodeURIComponent(entrada.codigo);
  return 'criar.html';
}

/* ---------- Callbacks da sala ---------- */

const ui = {
  aoLista(itens) {
    $('#lista').replaceChildren(...itens.map((i) => {
      const li = el('li');
      li.dataset.i = (i.nome || '?').trim().charAt(0).toUpperCase() || '?';
      li.append(el('span', null, i.nome), el('small', null, i.papel));
      return li;
    }));
    $('#n-part').textContent = itens.length + ' de 3';
  },
  aoChat(m) {
    const p = el('div', m.meu ? 'msg meu' : 'msg');
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
    const limites = { cpu: 'processador', bandwidth: 'rede' };
    e.textContent = `${s.w}×${s.h} · ${Math.round(s.fps || 0)} fps · ${formatarBitrate(s.kbps)}` +
      (s.codec ? ` · ${s.codec}` : '') +
      (limites[s.limite] ? ` · limitado por ${limites[s.limite]}` : '') +
      (nivel > 0 ? ` · qualidade reduzida (nível ${nivel})` : '');
  },
  aoAviso: toast,
  aoPreset(id) { $('#preset').value = id; },
  aoTelaParada() {
    estado.tela = false;
    marcar('#btn-tela', false);
    $('#txt-tela').textContent = 'Transmitir tela';
    $('#video').srcObject = null;
    $('#vazio').hidden = false;
    $('#aviso-audio').hidden = true;
    $('#stats').hidden = true;
  },
  aoEncerrar(msg) { sairDaSala(paginaDeRetorno(), msg); }
};

/* ---------- Conexão ---------- */

function abrirSala() {
  const host = sala.papel === 'host';
  document.body.dataset.papel = host ? 'host' : 'convidado';
  $('#papel-tag').textContent = host ? 'Transmissor' : 'Espectador';
  $('#codigo-sala').textContent = sala.codigo;
  $('#video').muted = host;
  $('#txt-vazio').textContent = host
    ? 'Clique em “Transmitir tela” para começar'
    : 'Aguardando o anfitrião iniciar a transmissão';
  document.title = 'Sala ' + sala.codigo + ' · Nono Transmissões';
  if (host) {
    const url = new URL('entrar.html', location.href);
    url.search = '?sala=' + sala.codigo;
    $('#link-convite').value = url.toString();
  }
  $('#conectando').hidden = true;
  if (host) $('#btn-tela').focus();
}

async function conectar() {
  let bruto = null;
  try { bruto = sessionStorage.getItem('nono:entrada'); sessionStorage.removeItem('nono:entrada'); } catch (_) { /* nada */ }
  if (!bruto) { location.replace('index.html'); return; }
  try { entrada = JSON.parse(bruto); } catch (_) { location.replace('index.html'); return; }

  $('#txt-conectando').textContent = entrada.modo === 'criar' ? 'Criando sua sala…' : 'Entrando na sala…';
  sala = new Sala(ui);
  try {
    if (entrada.modo === 'criar') await sala.criar(entrada.nome, entrada.senha);
    else await sala.entrar(entrada.codigo, entrada.nome, entrada.senha);
    abrirSala();
  } catch (e) {
    sairDaSala(paginaDeRetorno(), textoErro(e));
  }
}

/* ---------- Eventos ---------- */

$('#btn-sair').addEventListener('click', () => {
  if (sala && sala.papel === 'host' && !confirm('Sair encerra a sala para todos. Deseja continuar?')) return;
  sairDaSala('index.html');
});
$('#lnk-marca').addEventListener('click', (ev) => {
  ev.preventDefault();
  $('#btn-sair').click();
});
window.addEventListener('beforeunload', () => { if (sala) sala.sair(); });

Object.entries(PRESETS).forEach(([id, p]) => {
  const o = el('option', null, p.rotulo);
  o.value = id;
  if (id === '1080p60') o.selected = true;
  $('#preset').append(o);
});

async function copiar(texto, ok, campo) {
  try {
    await navigator.clipboard.writeText(texto);
    toast(ok);
  } catch (_) {
    if (campo) { campo.select(); toast('Não foi possível copiar sozinho. Use Ctrl+C com o texto selecionado.'); }
    else toast('Não foi possível copiar. Anote o código: ' + texto);
  }
}
$('#btn-copiar').addEventListener('click', () => copiar($('#link-convite').value, 'Link de convite copiado.', $('#link-convite')));
$('#btn-codigo').addEventListener('click', () => { if (sala) copiar(sala.codigo, 'Código da sala copiado.'); });

$('#btn-tela').addEventListener('click', async () => {
  if (!sala) return;
  if (estado.tela) { sala.pararTela(); return; }
  try {
    sala.codec = $('#codec').value;
    sala.adaptador.modo = $('#modo').value;
    sala.adaptador.ativo = $('#auto').checked;
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
$('#auto').addEventListener('change', (ev) => { if (sala) sala.adaptador.definirAtivo(ev.target.checked); });
$('#codec').addEventListener('change', (ev) => { if (sala) sala.definirCodec(ev.target.value); });
$('#modo').addEventListener('change', (ev) => { if (sala) sala.adaptador.definirModo(ev.target.value); });

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

conectar();
