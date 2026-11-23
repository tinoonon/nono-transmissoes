# Nono Transmissões

Transmissão de tela em tempo real, P2P, para até 3 pessoas (1 transmissor e 2 espectadores). Site 100% estático (HTML, CSS e JavaScript com ES modules), sem backend e sem framework. WebRTC para a mídia e PeerJS (servidor público) apenas para a sinalização.

## Estrutura

```
nono-transmissoes/
├─ package.json            dependência do PeerJS e script de build
├─ vercel.json             pasta de saída, build e cabeçalhos de segurança/noindex
├─ README.md
├─ scripts/copiar-peerjs.mjs   copia o PeerJS para public/vendor
└─ public/
   ├─ index.html           página única (início + sala)
   ├─ robots.txt, favicon.svg
   ├─ css/estilo.css
   ├─ vendor/peerjs.min.js (gerado por "npm run build")
   └─ js/
      ├─ config.js         TURN, prefixo da sala, limites
      ├─ qualidade.js      presets, codecs, getStats e adaptação
      ├─ sala.js           conexões, chamadas, chat, captura de mídia
      └─ app.js            interface
```

## Rodar localmente

```bash
npm install
npm run build      # copia o PeerJS para public/vendor/peerjs.min.js
npm start          # serve a pasta public (http://localhost:3000)
```

`getDisplayMedia`, câmera e microfone exigem HTTPS ou `localhost`.

Para ter o PeerJS "dentro" do repositório (sem depender do build), rode `npm run build` uma vez e faça commit de `public/vendor/peerjs.min.js`.

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
