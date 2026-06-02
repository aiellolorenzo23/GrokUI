<p align="center">
  <span style="display:inline-block;padding:12px 18px;border-radius:16px;background:#0c0d0f;">
    <img src="./resources/logo-white.svg" alt="GrokUI logo" width="100%" />
  </span>
</p>

Desktop client non ufficiale per usare `grok` e `agent` con una UI Electron ispirata a Grok sul browser.

English version: see [English](#english).

## Cosa fa

GrokUI non reimplementa Grok da zero: usa la CLI locale `grok-cli` come backend e mostra in una GUI quello che normalmente useresti da terminale.
Se scarichi Grok CLI da `https://grokcli.io/`, questa app puo essere usata come UI desktop per quel CLI. Il CLI resta quindi un requisito obbligatorio.

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

## English

<p align="center">
  <span style="display:inline-block;padding:12px 18px;border-radius:16px;background:#0c0d0f;">
    <img src="./resources/logo-white.svg" alt="GrokUI logo" width="100%" />
  </span>
</p>

Unofficial desktop client for `grok` and `agent`, with an Electron UI inspired by the browser version of Grok.

### What It Does

GrokUI does not reimplement Grok from scratch: it uses the local `grok-cli` as its backend and exposes in a GUI what you would normally use from the terminal.
If you download Grok CLI from `https://grokcli.io/`, this app can be used as a desktop UI for that CLI. The CLI is therefore a required dependency.

Main features:

- desktop interface inspired by the Grok browser experience
- separate sections for `grok` and `agent`
- existing session discovery via `grok sessions list` / `agent sessions list`
- transcript loading via `grok export` / `agent export`
- background prompt execution without visible CMD windows
- streaming output rendered in the UI
- Grok-style composer
- configurable working directory, useful when sessions were started from different folders
- SVG logo in the UI and generated app icons from `resources/icon.svg`

CLI processes are started by the Electron main process with `windowsHide: true`, so no separate terminal window stays open.

### Requirements

- Node.js
- `grok-cli` installed locally and available through the `grok` and `agent` commands
- CLI login/configuration already completed, if required

You can verify:

```powershell
grok --help
agent --help
grok sessions list
```

### Installation

```powershell
npm install
```

### Development

```powershell
npm run dev
```

By default, the app uses `C:\Users\lollo` as the initial working directory so it can discover sessions started from the home folder. You can change it from the sidebar.

### Build

Base Electron/Vite build:

```powershell
npm run build
```

Windows package:

```powershell
npm run build:win
```

Linux package:

```powershell
npm run build:linux
```

macOS package:

```powershell
npm run build:mac
```

Unpacked build:

```powershell
npm run build:unpack
```

### Useful Scripts

- `npm run dev`: start the app in development mode
- `npm run start`: preview the Electron build
- `npm run icons`: convert `resources/icon.svg` into `build/icon.png`, `build/icon.ico`, and `build/icon.icns`
- `npm run build`: generate icons, run typechecks, and build the app
- `npm run build:win`: build the Windows installer/app
- `npm run build:linux`: build Linux packages
- `npm run build:mac`: build the macOS package
- `npm run lint`: run ESLint
- `npm run format`: format the project with Prettier

### Assets

- UI logo: `resources/logo.svg`
- Source icon: `resources/icon.svg`
- Generated icons:
  - Windows: `build/icon.ico`
  - macOS: `build/icon.icns`
  - Linux: `build/icon.png`

### Notes

- GrokUI depends on the features exposed by the locally installed CLI.
- Sessions may depend on the working directory used when you started `grok` or `agent`.
- The GUI separates `grok` and `agent`, but both are delegated to their respective CLI commands.
