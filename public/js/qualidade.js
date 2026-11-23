export const PRESETS = {
  '720p30':  { rotulo: '720p · 30 fps',   w: 1280, h: 720,  fps: 30, bitrate: 3_000_000 },
  '1080p60': { rotulo: '1080p · 60 fps',  w: 1920, h: 1080, fps: 60, bitrate: 8_000_000 },
  '1440p60': { rotulo: '1440p · 60 fps',  w: 2560, h: 1440, fps: 60, bitrate: 14_000_000 },
  '2160p60': { rotulo: '2160p (4K) · 60 fps', w: 3840, h: 2160, fps: 60, bitrate: 25_000_000 }
};

// Degraus por modo: divisor de resolução, fator de fps e fator de bitrate.
const DEGRAUS = {
  balanceado: [
    { escala: 1,   fps: 1,    br: 1 },
    { escala: 1,   fps: 0.75, br: 0.75 },
    { escala: 1.5, fps: 0.75, br: 0.55 },
    { escala: 2,   fps: 0.5,  br: 0.4 }
  ],
  nitidez: [
    { escala: 1, fps: 1,    br: 1 },
    { escala: 1, fps: 0.75, br: 0.8 },
    { escala: 1, fps: 0.5,  br: 0.6 },
    { escala: 1, fps: 0.4,  br: 0.45 }
  ],
  fluidez: [
    { escala: 1,    fps: 1, br: 1 },
    { escala: 1.25, fps: 1, br: 0.75 },
    { escala: 1.5,  fps: 1, br: 0.55 },
    { escala: 2,    fps: 1, br: 0.4 }
  ]
};
const DEGRADACAO = { balanceado: 'balanced', nitidez: 'maintain-resolution', fluidez: 'maintain-framerate' };
const ORDEM_CODECS = ['AV1', 'VP9', 'H264'];

// Reordena os payloads de vídeo do SDP: AV1, VP9, H.264 e demais (RTX acompanha o codec associado).
export function preferirCodecs(sdp) {
  const L = sdp.split('\r\n');
  const inicios = [];
  L.forEach((l, i) => { if (l.startsWith('m=')) inicios.push(i); });
  inicios.forEach((i, b) => {
    if (!L[i].startsWith('m=video')) return;
    const fim = inicios[b + 1] ?? L.length;
    const nomes = {}, apt = {};
    for (let k = i; k < fim; k++) {
      let m = L[k].match(/^a=rtpmap:(\d+) ([\w-]+)\//);
      if (m) nomes[m[1]] = m[2].toUpperCase();
      m = L[k].match(/^a=fmtp:(\d+) .*apt=(\d+)/);
      if (m) apt[m[1]] = m[2];
    }
    const rank = (pt) => {
      const r = ORDEM_CODECS.indexOf(nomes[apt[pt] ?? pt]);
      return r < 0 ? 9 : r;
    };
    const p = L[i].split(' ');
    const pts = p.slice(3).sort((a, b2) => rank(a) - rank(b2));
    L[i] = [...p.slice(0, 3), ...pts].join(' ');
  });
  return L.join('\r\n');
}

// Faz o codificador começar já em bitrate alto (sem isso o Chrome parte de ~300 kbps e fica borrado).
export function ajustarBitrateSDP(sdp, { min = 500, inicio = 5000, max = 40000 } = {}) {
  const extra = `x-google-min-bitrate=${min};x-google-start-bitrate=${inicio};x-google-max-bitrate=${max}`;
  return sdp.split(/\r\n(?=m=)/).map((sec) => {
    if (!sec.startsWith('m=video')) return sec;
    const linhas = sec.split('\r\n');
    const pts = [];
    linhas.forEach((l) => {
      const m = l.match(/^a=rtpmap:(\d+) (VP8|VP9|AV1|H264)\//i);
      if (m) pts.push(m[1]);
    });
    pts.forEach((pt) => {
      const i = linhas.findIndex((l) => l.startsWith(`a=fmtp:${pt} `));
      if (i >= 0) {
        if (!linhas[i].includes('x-google-start-bitrate')) linhas[i] += ';' + extra;
      } else {
        const j = linhas.findIndex((l) => l.startsWith(`a=rtpmap:${pt} `));
        linhas.splice(j + 1, 0, `a=fmtp:${pt} ${extra}`);
      }
    });
    return linhas.join('\r\n');
  }).join('\r\n');
}

export const transformarSDP = (sdp, opcoes) => ajustarBitrateSDP(preferirCodecs(sdp), opcoes);

export async function lerStats(pc) {
  const r = {};
  const rel = await pc.getStats();
  rel.forEach((s) => {
    if (s.kind !== 'video' && s.mediaType !== 'video') return;
    if (s.type === 'inbound-rtp') {
      Object.assign(r, { dir: 'rx', w: s.frameWidth, h: s.frameHeight, fps: s.framesPerSecond, bytes: s.bytesReceived, perdidos: s.packetsLost, recebidos: s.packetsReceived, t: s.timestamp });
    } else if (s.type === 'outbound-rtp') {
      Object.assign(r, { dir: 'tx', w: s.frameWidth, h: s.frameHeight, fps: s.framesPerSecond, bytes: s.bytesSent, limite: s.qualityLimitationReason, t: s.timestamp });
    } else if (s.type === 'remote-inbound-rtp') {
      r.perda = s.fractionLost;
      r.rtt = s.roundTripTime;
    }
  });
  return r;
}

export async function aplicarParametros(sender, preset, n, degradacao) {
  const montar = (completo) => {
    const p = sender.getParameters();
    if (!p.encodings || !p.encodings.length) p.encodings = [{}];
    const e = p.encodings[0];
    e.maxBitrate = Math.round(preset.bitrate * n.br);
    e.maxFramerate = Math.max(15, Math.round(preset.fps * n.fps));
    e.scaleResolutionDownBy = n.escala;
    if (completo) { e.priority = 'high'; e.networkPriority = 'high'; p.degradationPreference = degradacao; }
    return p;
  };
  try { await sender.setParameters(montar(true)); }
  catch (_) { await sender.setParameters(montar(false)); }
}

// Adaptação conservadora: espera a rede "esquentar", só reduz com problema sustentado e restaura com calma.
export class Adaptador {
  constructor({ aplicar, aviso }) {
    this.aplicar = aplicar;
    this.aviso = aviso;
    this.ativo = true;
    this.modo = 'balanceado';
    this.reiniciar();
  }
  get niveis() { return DEGRAUS[this.modo]; }
  get atual() { return this.niveis[this.nivel]; }
  get degradacao() { return DEGRADACAO[this.modo]; }
  reiniciar() {
    this.nivel = 0; this.ruins = 0; this.cpu = 0; this.bons = 0;
    this.exigidos = 8;                       // amostras boas (2 s cada) para subir um degrau
    this.ultimaSubida = 0;
    this.espera = Date.now() + 20000;        // aquecimento: ignora os primeiros 20 s
  }
  definirModo(m) {
    if (!DEGRAUS[m]) return;
    this.modo = m; this.nivel = 0; this.ruins = this.cpu = this.bons = 0;
    this.espera = Date.now() + 8000;
    this.aplicar();
  }
  definirAtivo(v) {
    this.ativo = v;
    if (!v && this.nivel > 0) { this.nivel = 0; this.aplicar(); }
  }
  amostra({ perda = 0, banda = false, cpu = false }) {
    if (!this.ativo || Date.now() < this.espera) return;
    const ruim = perda > 0.08 || banda;
    this.ruins = ruim ? this.ruins + 1 : 0;
    this.cpu = cpu ? this.cpu + 1 : 0;
    this.bons = ruim || cpu ? 0 : this.bons + 1;
    const max = this.niveis.length - 1;
    if ((this.ruins >= 3 || this.cpu >= 5) && this.nivel < max) {
      this.nivel++; this.ruins = this.cpu = this.bons = 0;
      if (Date.now() - this.ultimaSubida < 30000) this.exigidos = Math.min(this.exigidos * 2, 40);
      this.espera = Date.now() + 8000;
      this.aplicar();
      this.aviso(this.cpu >= 0 && cpu ? 'Processador no limite: qualidade reduzida.' : 'Rede instável: qualidade reduzida automaticamente.');
    } else if (this.bons >= this.exigidos && this.nivel > 0) {
      this.nivel--; this.bons = 0;
      this.ultimaSubida = Date.now();
      this.espera = Date.now() + 4000;
      this.aplicar();
      this.aviso('Rede estável: qualidade restaurada.');
    }
  }
}
