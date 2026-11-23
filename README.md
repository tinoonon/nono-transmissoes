# Nono Transmissões

Transmissão de tela em tempo real, P2P, para até 3 pessoas (1 transmissor e 2 espectadores). Site 100% estático (HTML, CSS e JavaScript com ES modules), sem backend e sem framework, com 5 páginas. WebRTC para a mídia e PeerJS (servidor público) apenas para a sinalização.

## Estrutura

```
nono-transmissoes/
├─ package.json            dependência do PeerJS e script de build
├─ vercel.json             pasta de saída, build e cabeçalhos de segurança/noindex
├─ README.md
├─ scripts/copiar-peerjs.mjs   copia PeerJS, Three, GSAP e anime.js para public/vendor
└─ public/
   ├─ index.html           página inicial (apresentação)
   ├─ criar.html           formulário para criar sala
   ├─ entrar.html          formulário para entrar com código ou link
   ├─ sala.html            a sala (transmissão, controles, chat)
   ├─ ajuda.html           ajuda, qualidade, navegadores e privacidade
   ├─ robots.txt, favicon.svg
   ├─ img/icones.svg       ícones (sprite)
   ├─ css/estilo.css       sistema visual (branco, azul e preto) e microinterações da sala
   ├─ css/animacoes.css    estados e keyframes das animações (fora da sala)
   ├─ css/transicoes.css   View Transitions entre páginas (a sala não usa)
   ├─ vendor/              peerjs, three (módulo), gsap, ScrollTrigger e anime (versões fixas)
   └─ js/
      ├─ config.js         TURN, prefixo da sala, limites
      ├─ qualidade.js      presets, codecs, getStats e adaptação
      ├─ sala.js           conexões, chamadas, chat, captura de mídia
      ├─ formularios.js    criar.html e entrar.html
      ├─ sala-pagina.js    interface de sala.html
      └─ animacoes/        um módulo por página (index, hero3d, formularios-anim, ajuda) + base, botoes e pre
```

Fluxo: `criar.html` ou `entrar.html` guardam os dados em `sessionStorage` (uso único) e abrem `sala.html`, que lê e apaga esses dados e conecta. Se a conexão falhar, o usuário volta ao formulário com a mensagem de erro. O link de convite aponta para `entrar.html?sala=CODIGO`.

## Rodar localmente

```bash
npm install
npm run build      # copia PeerJS, Three, GSAP e anime.js para public/vendor
npm start          # serve a pasta public (http://localhost:3000)
```

`getDisplayMedia`, câmera e microfone exigem HTTPS ou `localhost`.

Para ter o PeerJS "dentro" do repositório (sem depender do build), rode `npm run build` uma vez e faça commit de `public/vendor/peerjs.min.js`.

## Animações e 3D

- **Bibliotecas** (todas locais, versões fixas, por causa da CSP `script-src 'self'`): Three 0.170.0 (módulo ES, ≈171 KB gzip, só na index e só quando o hero fica visível), GSAP 3.12.7 e ScrollTrigger (index e ajuda), anime.js 3.2.2 (index, criar e entrar).
- **sala.html** não carrega biblioteca nem 3D: só microinterações CSS em `estilo.css` (toast, painel de qualidade, pulso do indicador ao vivo, mensagens).
- **prefers-reduced-motion**: sem animações, sem 3D e sem estados escondidos. O mock em CSS do hero fica no lugar da cena.
- **Fallbacks**: sem WebGL, com economia de dados ou se uma biblioteca falhar, a página volta ao conteúdo estático. Sem View Transitions, a navegação é normal.
- **Transições**: `css/transicoes.css` usa `@view-transition` (Chrome/Edge 126+). Como `sala.html` não o inclui, a sala é sempre navegação completa.
- Valores dinâmicos usam classes ou CSSOM (`element.style`), nunca `style=""` nem `<style>`.
- Para atualizar uma biblioteca, mude a versão no `package.json`, rode `npm install && npm run build` e teste a index.

## Deploy na Vercel

1. Crie um repositório (GitHub, GitLab ou Bitbucket) com esta pasta e faça push.
2. Em vercel.com, clique em **Add New > Project** e importe o repositório.
3. Em **Framework Preset**, deixe **Other**. As configurações de build e saída já vêm do `vercel.json` (`npm run build` e `public`).
4. Clique em **Deploy**. Ao terminar, abra o endereço `https://seu-projeto.vercel.app`.

Pela linha de comando: `npm i -g vercel`, depois `vercel` dentro da pasta e, para produção, `vercel --prod`.

## Configurar TURN (opcional)

O STUN do Google resolve a maioria das conexões. Se alguém ficar preso em "conectando" (rede corporativa, 4G com CGNAT), adicione um servidor TURN:

1. Obtenha um TURN: um próprio com coturn, ou um provedor (Metered, Twilio, Cloudflare Calls etc.).
2. Edite `public/js/config.js` e troque a constante no topo:

```js
export const TURN = [
  { urls: 'turn:turn.exemplo.com:3478', username: 'usuario', credential: 'senha' },
  { urls: 'turns:turn.exemplo.com:443?transport=tcp', username: 'usuario', credential: 'senha' }
];
```

3. Faça novo deploy. As credenciais ficam visíveis no código do navegador: use credenciais dedicadas a este projeto e, se possível, com cota limitada.

## Observações

- **Sala:** o código de 6 caracteres é o ID do anfitrião no PeerJS com o prefixo `nono-`. A quarta pessoa recebe "Sala cheia".
- **Senha:** o espectador envia o hash SHA-256 (código + senha) no handshake e o anfitrião valida antes de aceitar. Protege contra curiosos, mas não substitui um canal privado para passar o código.
- **Microfone e câmera dos espectadores** vão apenas para o anfitrião; não são retransmitidos entre espectadores.
- **Banda:** o anfitrião envia um fluxo separado para cada espectador. 1080p60 usa até 8 Mbps por espectador; 2160p60, até 25 Mbps. A adaptação automática reduz resolução, fps e bitrate em caso de perda de pacotes.
- **Navegadores:** Chrome e Edge dão o melhor suporte (áudio do sistema no Windows e áudio de aba, AV1). O Firefox não captura áudio do sistema. No Safari, a captura de tela tem limitações.
- **Privacidade:** sem login, sem analytics, sem gravação. `noindex` via meta tag, `robots.txt` e cabeçalho `X-Robots-Tag`.
