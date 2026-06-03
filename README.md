<p align="center">
  <span style="display:inline-block;padding:12px 18px;border-radius:16px;background:#0c0d0f;">
    <img src="./resources/logo-white.svg" alt="GrokUI logo" width="100%" />
  </span>
</p>

Client desktop non ufficiale per usare `grok` e `agent` con una UI Electron ispirata a Grok sul browser.

English version: see [English](#english).

## GrokUI

GrokUI non reimplementa Grok da zero: usa la CLI locale di Grok come backend e trasforma in interfaccia desktop quello che normalmente useresti da terminale.

L'app avvia i comandi `grok` e `agent` dietro le quinte, senza finestre CMD visibili, e mostra in chat lo streaming prodotto dalla CLI.

## Funzionalita'

- UI desktop scura ispirata a Grok browser
- sidebar collassabile
- sezioni separate per `grok` e `agent`
- recupero sessioni esistenti tramite `grok sessions list` e `agent sessions list`
- apertura transcript tramite `grok export` e `agent export`
- output streaming renderizzato come chat
- indicatore di risposta in corso nella conversazione
- stop della generazione in corso
- working directory configurabile
- modello configurabile, se supportato dalla CLI
- rinomina locale delle sessioni
- nascondi sessione solo nella UI
- assegnazione locale di sessioni alla sezione Agent
- apertura di immagini/video generati tramite pulsanti localizzati in base alla lingua del sistema
- allegati file tramite bottone `+`
- drag and drop di file nella chat
- chip rimovibili per i file allegati prima dell'invio
- invio dei path locali a Grok CLI come testo, senza copiare o caricare i file
- logo SVG nella UI e icone app generate da `resources/icon.svg`

## Allegati

Grok CLI lavora bene con i path locali. Per questo GrokUI non fa upload dei file: prende il percorso reale del file selezionato o trascinato e lo aggiunge al prompt.

Esempio:

```text
Puoi usare questa immagine come riferimento?

File allegati:
K:\AI\ComfyUI\output\Grok_Porn_00031.png
```

Puoi anche inviare solo un file senza testo:

```text
File allegati:
K:\AI\ComfyUI\output\Grok_Porn_00031.png
```

## Requisiti

- Node.js 20 o superiore
- Grok CLI installata localmente
- comandi `grok` e `agent` disponibili da terminale
- login/configurazione della CLI gia completati, se richiesti

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

## Avvio In Sviluppo

```powershell
npm run dev
```

Di default l'app usa la home directory reale del sistema come working directory iniziale, cosi puo vedere le sessioni avviate dalla home. Puoi cambiarla dalla sidebar.

## Build

Build base Electron/Vite:

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

Nota: `build:win` esegue prima `npm run build` (icone, typecheck e build Electron), mentre `build:mac` e `build:linux` al momento eseguono direttamente `electron-vite build` prima del packaging. Se vuoi un comportamento uniforme, conviene allineare anche questi script.

## Script Utili

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
- Logo bianco README/UI: `resources/logo-white.svg`
- Icona sorgente: `resources/icon.svg`
- Icona bianca generata: `resources/icon-white.svg`
- Icone generate:
  - Windows: `build/icon.ico`
  - macOS: `build/icon.icns`
  - Linux: `build/icon.png`

## Note

- GrokUI dipende dalle funzionalita disponibili nella CLI installata localmente.
- Le sessioni possono dipendere dalla working directory usata quando hai avviato `grok` o `agent`.
- La separazione tra `grok` e `agent` nella sidebar e gestita dalla UI, mentre l'esecuzione viene delegata ai rispettivi comandi CLI.
- Rinomina e nascondi sessione sono preferenze locali dell'app, non modifiche permanenti nella CLI.
- I file allegati non vengono copiati: Grok riceve il path locale come testo.

## Limitazioni

- GrokUI dipende completamente dalle funzionalita e dal comportamento della CLI installata localmente.
- I file allegati non vengono caricati dall'app: viene inviato solo il path locale come testo.
- Le sessioni visibili possono cambiare in base alla working directory usata con `grok` o `agent`.
- Il comportamento di alcune funzioni puo cambiare se cambia la CLI sottostante.

## English

<p align="center">
  <span style="display:inline-block;padding:12px 18px;border-radius:16px;background:#0c0d0f;">
    <img src="./resources/logo-white.svg" alt="GrokUI logo" width="100%" />
  </span>
</p>

Unofficial desktop client for `grok` and `agent`, built with Electron and inspired by the browser version of Grok.

### GrokUI

GrokUI does not reimplement Grok from scratch. It uses the locally installed Grok CLI as its backend and turns the terminal workflow into a desktop chat interface.

The app starts `grok` and `agent` commands behind the scenes, without visible CMD windows, and renders CLI streaming output directly in the chat.

### Features

- dark desktop UI inspired by Grok in the browser
- collapsible sidebar
- separate `grok` and `agent` sections
- existing session discovery via `grok sessions list` and `agent sessions list`
- transcript loading via `grok export` and `agent export`
- streaming output rendered as chat messages
- in-chat pending response indicator
- stop current generation
- configurable working directory
- configurable model, when supported by the CLI
- local session rename
- hide sessions locally in the UI
- local assignment of sessions to the Agent section
- open generated images/videos through buttons localized to the system language
- file attachments through the composer `+` button
- drag and drop files into the chat
- removable attachment chips before sending
- send local file paths to Grok CLI as plain text, without copying or uploading files
- SVG logo in the UI and generated app icons from `resources/icon.svg`

### File Attachments

Grok CLI works well with local file paths. For this reason, GrokUI does not upload files: it reads the real path of the selected or dropped file and appends it to the prompt.

Example:

```text
Can you use this image as a reference?

File attachments:
K:\AI\ComfyUI\output\Grok_Porn_00031.png
```

You can also send only a file without extra text:

```text
File attachments:
K:\AI\ComfyUI\output\Grok_Porn_00031.png
```

### Requirements

- Node.js 20 or later
- Grok CLI installed locally
- `grok` and `agent` commands available from the terminal
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

By default, the app uses the real system home directory as the initial working directory so it can discover sessions started from the home folder. You can change it from the sidebar.

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

Note: `build:win` runs `npm run build` first (icons, typecheck, and Electron build), while `build:mac` and `build:linux` currently run `electron-vite build` directly before packaging. If you want consistent behavior, align those scripts as well.

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
- White README/UI logo: `resources/logo-white.svg`
- Source icon: `resources/icon.svg`
- Generated white icon: `resources/icon-white.svg`
- Generated icons:
  - Windows: `build/icon.ico`
  - macOS: `build/icon.icns`
  - Linux: `build/icon.png`

### Notes

- GrokUI depends on the features exposed by the locally installed CLI.
- Sessions may depend on the working directory used when you started `grok` or `agent`.
- The sidebar separates `grok` and `agent` in the UI, while execution is delegated to their respective CLI commands.
- Rename and hide session actions are local app preferences, not permanent CLI changes.
- Attached files are not copied: Grok receives the local path as plain text.

### Limitations

- GrokUI depends entirely on the features and behavior exposed by the locally installed CLI.
- Attached files are not uploaded by the app: only the local path is sent as plain text.
- Visible sessions may change depending on the working directory used with `grok` or `agent`.
- Some app behavior may change when the underlying CLI changes.
