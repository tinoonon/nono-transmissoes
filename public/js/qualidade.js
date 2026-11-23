export const PRESETS = {
  '720p30':  { rotulo: '720p · 30 fps',   w: 1280, h: 720,  fps: 30, bitrate: 3_000_000 },
  '1080p60': { rotulo: '1080p · 60 fps',  w: 1920, h: 1080, fps: 60, bitrate: 8_000_000 },
  '1440p60': { rotulo: '1440p · 60 fps',  w: 2560, h: 1440, fps: 60, bitrate: 14_000_000 },
  '2160p60': { rotulo: '2160p (4K) · 60 fps', w: 3840, h: 2160, fps: 60, bitrate: 25_000_000 }
};

// Degraus de adaptação: divisor de resolução, fator de fps e fator de bitrate.
export const NIVEIS = [
  { escala: 1,   fps: 1,    br: 1 },
  { escala: 1.5, fps: 1,    br: 0.7 },
  { escala: 2,   fps: 0.5,  br: 0.5 },
  { escala: 3,   fps: 0.5,  br: 0.3 },
  { escala: 4,   fps: 0.25, br: 0.2 }
];

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

export async function aplicarParametros(sender, preset, nivel) {
  const p = sender.getParameters();
  if (!p.encodings || !p.encodings.length) p.encodings = [{}];
  const n = NIVEIS[nivel];
  const e = p.encodings[0];
  e.maxBitrate = Math.round(preset.bitrate * n.br);
  e.maxFramerate = Math.max(10, Math.round(preset.fps * n.fps));
  e.scaleResolutionDownBy = n.escala;
  await sender.setParameters(p);
}

// Reduz a qualidade após ~4 s ruins e restaura um degrau após ~20 s bons (amostras a cada 2 s).
export class Adaptador {
  constructor({ aplicar, aviso }) {
    this.aplicar = aplicar;
    this.aviso = aviso;
    this.ativo = true;
    this.reiniciar();
  }
  reiniciar() { this.nivel = 0; this.ruins = 0; this.bons = 0; }
  amostra(pior) {
    if (!this.ativo) return;
    const ruim = pior.perda > 0.05 || pior.limite === 'bandwidth' || pior.limite === 'cpu';
    if (ruim) { this.ruins++; this.bons = 0; } else { this.bons++; this.ruins = 0; }
    if (this.ruins >= 2 && this.nivel < NIVEIS.length - 1) {
      this.nivel++; this.ruins = 0;
      this.aplicar();
      this.aviso('Rede instável: resolução e fps reduzidos automaticamente.');
    } else if (this.bons >= 10 && this.nivel > 0) {
      this.nivel--; this.bons = 0;
      this.aplicar();
      this.aviso('Rede estável: qualidade parcialmente restaurada.');
    }
  }
}
