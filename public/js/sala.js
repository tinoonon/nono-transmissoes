import { CONFIG, ICE_SERVERS } from './config.js';
import { PRESETS, preferirCodecs, lerStats, Adaptador, aplicarParametros } from './qualidade.js';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const normalizarCodigo = (s) =>
  String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CONFIG.TAMANHO_CODIGO);

const gerarCodigo = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(CONFIG.TAMANHO_CODIGO)), (x) => ALFABETO[x % ALFABETO.length]).join('');

async function hashSenha(senha, codigo) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`nono:${codigo}:${senha}`));
  return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
}

const classePeer = () => window.Peer || (window.peerjs && window.peerjs.Peer);

export class Sala {
  constructor(ui) {
    this.ui = ui;
    this.papel = null;
    this.codigo = null;
    this.nome = '';
    this.peer = null;
    this.idHost = null;
    this.senhaHash = null;
    this.pares = new Map();      // id -> { conn, nome, chamadas: Map(kind -> call) }
    this.recebidas = new Map();  // "id:kind" -> call
    this.local = {};             // kind -> MediaStream publicado
    this.mic = null;
    this.cam = null;
    this.cap = null;
    this.saida = null;
    this.ctx = null;
    this.dest = null;
    this.fontes = new Map();
    this.presetId = '1080p60';
    this.conectado = false;
    this.encerrada = false;
    this.ant = new Map();
    this.timer = null;
    this.adaptador = new Adaptador({ aplicar: () => this.reaplicar(), aviso: (m) => ui.aoAviso(m) });
  }

  /* ---------- Conexão ---------- */

  _abrir(id) {
    const P = classePeer();
    if (!P) return Promise.reject(new Error('Biblioteca PeerJS não encontrada. Rode "npm run build" (veja o README).'));
    return new Promise((res, rej) => {
      const opcoes = { config: { iceServers: ICE_SERVERS } };
      const p = id ? new P(id, opcoes) : new P(opcoes);
      const falha = (e) => { try { p.destroy(); } catch (_) { /* ignora */ } rej(e); };
      p.once('error', falha);
      p.once('open', () => {
        p.off('error', falha);
        this.peer = p;
        p.on('error', (e) => this.ui.aoAviso('Erro de conexão: ' + (e.type || e.message)));
        p.on('disconnected', () => { if (!this.encerrada && !p.destroyed) { try { p.reconnect(); } catch (_) { /* ignora */ } } });
        res();
      });
    });
  }

  async criar(nome, senha) {
    this.papel = 'host';
    this.nome = nome || 'Anfitrião';
    for (let i = 0; i < 6 && !this.codigo; i++) {
      const codigo = gerarCodigo();
      this.senhaHash = senha ? await hashSenha(senha, codigo) : null;
      try {
        await this._abrir(CONFIG.PREFIXO_SALA + codigo);
        this.codigo = codigo;
      } catch (e) {
        if (e.type !== 'unavailable-id') throw e;
      }
    }
    if (!this.codigo) throw new Error('Não foi possível reservar um código. Tente novamente.');
    this.peer.on('connection', (c) => this._entrada(c));
    this.peer.on('call', (c) => this._receberChamada(c));
    this._lista();
    this._iniciarMonitor();
  }

  async entrar(codigo, nome, senha) {
    this.papel = 'convidado';
    this.codigo = codigo;
    this.nome = nome || 'Convidado';
    this.idHost = CONFIG.PREFIXO_SALA + codigo;
    await this._abrir(undefined);
    this.peer.on('call', (c) => this._receberChamada(c));
    const metadata = { nome: this.nome };
    if (senha) metadata.senha = await hashSenha(senha, codigo);
    await new Promise((res, rej) => {
      const c = this.peer.connect(this.idHost, { reliable: true, metadata });
      const limite = setTimeout(() => rej(new Error('Tempo esgotado ao conectar. Verifique o código e a rede.')), 15000);
      const falha = (e) => { clearTimeout(limite); rej(e.type === 'peer-unavailable' ? new Error('Sala não encontrada.') : e); };
      this.peer.once('error', falha);
      this.pares.set(this.idHost, { conn: c, nome: 'Anfitrião', chamadas: new Map() });
      c.on('data', (d) => {
        if (!d || typeof d !== 'object') return;
        if (d.t === 'ok') { clearTimeout(limite); this.peer.off('error', falha); this.conectado = true; res(); }
        else if (d.t === 'erro') { clearTimeout(limite); rej(new Error(d.motivo || 'Conexão recusada.')); }
        else if (d.t === 'lista') this.ui.aoLista(d.itens);
        else if (d.t === 'chat') this.ui.aoChat({ ...d, meu: d.de === this.peer.id });
      });
      c.on('close', () => { if (this.conectado && !this.encerrada) this.ui.aoEncerrar('O anfitrião encerrou a sala.'); });
    });
    this._iniciarMonitor();
  }

  /* ---------- Anfitrião: entrada, lista e chat ---------- */

  _entrada(c) {
    const meta = c.metadata || {};
    c.on('open', () => {
      const recusar = (motivo) => { try { c.send({ t: 'erro', motivo }); } catch (_) { /* ignora */ } setTimeout(() => c.close(), 400); };
      if (this.pares.size >= CONFIG.MAX_CONVIDADOS) return recusar('Sala cheia');
      if (this.senhaHash && meta.senha !== this.senhaHash) return recusar('Senha incorreta');
      const par = { conn: c, nome: String(meta.nome || 'Convidado').slice(0, 24), chamadas: new Map() };
      this.pares.set(c.peer, par);
      c.send({ t: 'ok' });
      c.on('data', (d) => this._dados(c.peer, d));
      c.on('close', () => this._saiu(c.peer));
      c.on('error', () => this._saiu(c.peer));
      this._lista();
      ['tela', 'camera'].forEach((k) => { if (this.local[k]) this._chamar(c.peer, par, k, this.local[k]); });
      this.ui.aoAviso(par.nome + ' entrou na sala.');
    });
  }

  _dados(id, d) {
    const par = this.pares.get(id);
    if (!par || !d || typeof d !== 'object') return;
    if (d.t === 'chat') this._difundirChat(id, par.nome, d.texto);
  }

  _difundirChat(de, nome, texto) {
    texto = String(texto || '').trim().slice(0, 500);
    if (!texto) return;
    const m = { t: 'chat', de, nome, texto, hora: Date.now() };
    this.pares.forEach((p) => { try { p.conn.send(m); } catch (_) { /* ignora */ } });
    this.ui.aoChat({ ...m, meu: de === 'host' });
  }

  enviarChat(texto) {
    if (this.papel === 'host') this._difundirChat('host', this.nome, texto);
    else {
      const par = this.pares.get(this.idHost);
      if (par) par.conn.send({ t: 'chat', texto: String(texto).slice(0, 500) });
    }
  }

  _lista() {
    const itens = [{ nome: this.nome, papel: 'Anfitrião' }];
    this.pares.forEach((p) => itens.push({ nome: p.nome, papel: 'Espectador' }));
    this.ui.aoLista(itens);
    this.pares.forEach((p) => { try { p.conn.send({ t: 'lista', itens }); } catch (_) { /* ignora */ } });
  }

  _saiu(id) {
    const par = this.pares.get(id);
    if (!par) return;
    this.pares.delete(id);
    par.chamadas.forEach((c) => { try { c.close(); } catch (_) { /* ignora */ } });
    [...this.recebidas.keys()].filter((k) => k.startsWith(id + ':')).forEach((k) => {
      try { this.recebidas.get(k).close(); } catch (_) { /* ignora */ }
      this.recebidas.delete(k);
      this.ui.aoFluxoFim(k.split(':')[1], id);
    });
    this._lista();
    this.ui.aoAviso(par.nome + ' saiu da sala.');
  }

  /* ---------- Chamadas de mídia ---------- */

  _chamar(id, par, kind, stream) {
    const antiga = par.chamadas.get(kind);
    if (antiga) { par.chamadas.delete(kind); try { antiga.close(); } catch (_) { /* ignora */ } }
    if (!stream || !stream.getTracks().length) return;
    const call = this.peer.call(id, stream, { metadata: { kind, nome: this.nome }, sdpTransform: preferirCodecs });
    if (!call) return;
    par.chamadas.set(kind, call);
    call.on('close', () => { if (par.chamadas.get(kind) === call) par.chamadas.delete(kind); });
    if (kind === 'tela') { setTimeout(() => this.reaplicar(), 800); setTimeout(() => this.reaplicar(), 3000); }
  }

  publicar(kind, stream) {
    this.local[kind] = stream;
    this.pares.forEach((par, id) => this._chamar(id, par, kind, stream));
  }

  _receberChamada(call) {
    if (!this.pares.has(call.peer)) { call.close(); return; }
    const kind = (call.metadata && call.metadata.kind) || 'tela';
    const nome = String((call.metadata && call.metadata.nome) || 'Participante').slice(0, 24);
    const chave = call.peer + ':' + kind;
    this.recebidas.set(chave, call);
    call.answer();
    call.on('stream', (s) => this.ui.aoFluxo(kind, s, call.peer, nome));
    call.on('close', () => {
      if (this.recebidas.get(chave) === call) this.recebidas.delete(chave);
      this.ui.aoFluxoFim(kind, call.peer);
    });
  }

  /* ---------- Captura local ---------- */

  _mixer() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.dest = this.ctx.createMediaStreamDestination();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _fonte(nome, stream) {
    this._removerFonte(nome);
    const n = this.ctx.createMediaStreamSource(stream);
    n.connect(this.dest);
    this.fontes.set(nome, n);
  }

  _removerFonte(nome) {
    const n = this.fontes.get(nome);
    if (n) { n.disconnect(); this.fontes.delete(nome); }
  }

  async iniciarTela(presetId, hint) {
    if (this.cap) this.pararTela();
    const p = PRESETS[presetId];
    const cap = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: p.w }, height: { ideal: p.h }, frameRate: { ideal: p.fps, max: p.fps } },
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      systemAudio: 'include'
    });
    const v = cap.getVideoTracks()[0];
    v.contentHint = hint;
    this.cap = cap;
    this.presetId = presetId;
    this._mixer();
    const temAudio = cap.getAudioTracks().length > 0;
    if (temAudio) this._fonte('sistema', new MediaStream(cap.getAudioTracks()));
    v.addEventListener('ended', () => this.pararTela());
    this.saida = new MediaStream([v, this.dest.stream.getAudioTracks()[0]]);
    this.adaptador.reiniciar();
    this.publicar('tela', this.saida);
    return { temAudio, stream: this.saida };
  }

  pararTela() {
    if (!this.cap) return;
    this.cap.getTracks().forEach((t) => t.stop());
    this.cap = null;
    this.saida = null;
    this._removerFonte('sistema');
    this.publicar('tela', null);
    this.ui.aoTelaParada();
  }

  definirHint(hint) {
    const t = this.cap && this.cap.getVideoTracks()[0];
    if (t) t.contentHint = hint;
  }

  async mudarPreset(id) {
    this.presetId = id;
    const t = this.cap && this.cap.getVideoTracks()[0];
    if (!t) return;
    const p = PRESETS[id];
    await t.applyConstraints({ width: { ideal: p.w }, height: { ideal: p.h }, frameRate: { ideal: p.fps, max: p.fps } }).catch(() => {});
    this.adaptador.reiniciar();
    this.reaplicar();
  }

  async alternarMic(ligar) {
    if (ligar) {
      this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } else if (this.mic) {
      this.mic.getTracks().forEach((t) => t.stop());
      this.mic = null;
    }
    this._atualizarMidia();
  }

  async alternarCamera(ligar) {
    if (ligar) {
      this.cam = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
    } else if (this.cam) {
      this.cam.getTracks().forEach((t) => t.stop());
      this.cam = null;
    }
    this._atualizarMidia();
    return this.cam;
  }

  _atualizarMidia() {
    if (this.papel === 'host') {
      this._mixer();
      this._removerFonte('mic');
      if (this.mic) this._fonte('mic', this.mic);
      this.publicar('camera', this.cam);
    } else {
      const trilhas = [...(this.mic ? this.mic.getAudioTracks() : []), ...(this.cam ? this.cam.getVideoTracks() : [])];
      this.publicar('convidado', trilhas.length ? new MediaStream(trilhas) : null);
    }
  }

  /* ---------- Qualidade e estatísticas ---------- */

  reaplicar() {
    const preset = PRESETS[this.presetId];
    this.pares.forEach((par) => {
      const call = par.chamadas.get('tela');
      const pc = call && call.peerConnection;
      if (!pc) return;
      pc.getSenders().filter((s) => s.track && s.track.kind === 'video')
        .forEach((s) => aplicarParametros(s, preset, this.adaptador.nivel).catch(() => {}));
    });
  }

  _iniciarMonitor() {
    this.timer = setInterval(() => this._monitorar(), 2000);
  }

  async _monitorar() {
    const alvos = [];
    if (this.papel === 'host') this.pares.forEach((p) => { const c = p.chamadas.get('tela'); if (c) alvos.push(c); });
    else this.recebidas.forEach((c, k) => { if (k.endsWith(':tela')) alvos.push(c); });
    if (!alvos.length) { this.ui.aoStats(null, 0); return; }
    let ref = null;
    const pior = { perda: 0, limite: 'none' };
    for (const c of alvos) {
      const pc = c.peerConnection;
      if (!pc) continue;
      const s = await lerStats(pc).catch(() => null);
      if (!s || !s.t || !Number.isFinite(s.bytes)) continue;
      const a = this.ant.get(c);
      this.ant.set(c, s);
      const kbps = a && s.t > a.t ? ((s.bytes - a.bytes) * 8) / (s.t - a.t) : 0;
      let perda = s.perda || 0;
      if (s.dir === 'rx' && a) {
        const dp = s.perdidos - a.perdidos;
        const dr = s.recebidos - a.recebidos;
        perda = dp + dr > 0 ? Math.max(0, dp) / (dp + dr) : 0;
      }
      pior.perda = Math.max(pior.perda, perda);
      if (s.limite === 'bandwidth' || s.limite === 'cpu') pior.limite = s.limite;
      if (!ref || kbps > ref.kbps) ref = { w: s.w, h: s.h, fps: s.fps, kbps };
    }
    this.ui.aoStats(ref, this.adaptador.nivel);
    if (this.papel === 'host') this.adaptador.amostra(pior);
  }

  sair() {
    this.encerrada = true;
    clearInterval(this.timer);
    [this.cap, this.mic, this.cam].forEach((s) => { if (s) s.getTracks().forEach((t) => t.stop()); });
    if (this.ctx) this.ctx.close().catch(() => {});
    if (this.peer) { try { this.peer.destroy(); } catch (_) { /* ignora */ } }
  }
}
