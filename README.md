# GrokUI

<p align="center">
  <span style="display:inline-block;padding:12px 18px;border-radius:16px;background:#0c0d0f;">
    <img src="./resources/logo-white.svg" alt="GrokUI logo" width="100%" />
  </span>
</p>

Desktop client non ufficiale per usare `grok` e `agent` con una UI Electron ispirata a Grok sul browser.

## Cosa fa

GrokUI non reimplementa Grok da zero: usa la CLI locale `grok-cli` come backend e mostra in una GUI quello che normalmente useresti da terminale.

Funzionalita principali:

- interfaccia desktop in stile Grok browser
- sezioni separate per `grok` e `agent`
- recupero sessioni esistenti tramite `grok sessions list` / `agent sessions list`
- apertura transcript tramite `grok export` / `agent export`
- invio prompt al CLI in background senza finestre CMD visibili
- output streaming mostrato nella UI
- composer stile Grok
- working directory configurabile, utile per recuperare sessioni avviate da cartelle diverse
- logo SVG mostrato nella UI e icone app generate da `resources/icon.svg`

I processi CLI vengono avviati dal processo main di Electron con `windowsHide: true`, quindi non resta aperto un terminale separato.

## Requisiti

- Node.js
- `grok-cli` installato e disponibile nei comandi `grok` e `agent`
- login/configurazione gia eseguita dal CLI, se richiesta

Puoi verificare:

```powershell
grok --help
agent --help
grok sessions list
```

## Installazione

```powershell
npm install
```

## Avvio in sviluppo

```powershell
npm run dev
```

Di default l'app usa `C:\Users\lollo` come working directory iniziale, cosi puo vedere le sessioni avviate dalla home. Puoi cambiarla dalla sidebar.

## Build applicazione

Build base dei file Electron/Vite:

```powershell
npm run build
```

Build pacchetto Windows:

```powershell
npm run build:win
```

Build pacchetto Linux:

```powershell
npm run build:linux
```

Build pacchetto macOS:

```powershell
npm run build:mac
```

Build non impacchettata:

```powershell
npm run build:unpack
```

## Script utili

- `npm run dev`: avvia l'app in sviluppo
- `npm run start`: anteprima della build Electron
- `npm run icons`: converte `resources/icon.svg` in `build/icon.png`, `build/icon.ico` e `build/icon.icns`
- `npm run build`: genera icone, esegue typecheck e build applicativa
- `npm run build:win`: build installer/app Windows
- `npm run build:linux`: build pacchetti Linux
- `npm run build:mac`: build pacchetto macOS
- `npm run lint`: esegue ESLint
- `npm run format`: formatta il progetto con Prettier

## Asset

- Logo UI: `resources/logo.svg`
- Icona sorgente: `resources/icon.svg`
- Icone generate:
  - Windows: `build/icon.ico`
  - macOS: `build/icon.icns`
  - Linux: `build/icon.png`

## Note

- GrokUI dipende dalle funzionalita disponibili nella CLI installata localmente.
- Le sessioni possono dipendere dalla working directory usata quando hai avviato `grok` o `agent`.
- La GUI separa `grok` e `agent`, ma entrambi vengono delegati ai rispettivi comandi CLI.
