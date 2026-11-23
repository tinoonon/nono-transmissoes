// ---------------------------------------------------------------
// TURN OPCIONAL: preencha para ativar (veja o README).
// Exemplo:
//   export const TURN = [{ urls: 'turn:turn.exemplo.com:3478', username: 'usuario', credential: 'senha' }];
// Deixe como null para usar apenas STUN (funciona na maioria das redes).
// ---------------------------------------------------------------
export const TURN = null;

export const CONFIG = {
  PREFIXO_SALA: 'nono-',   // prefixo do ID do peer, evita colisões no servidor público
  TAMANHO_CODIGO: 6,
  MAX_CONVIDADOS: 2        // anfitrião + 2 = 3 pessoas no total
};

export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  ...(TURN ? [].concat(TURN) : [])
];
