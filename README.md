<p align="center">
  <span style="display:inline-block;padding:12px 18px;border-radius:16px;background:#0c0d0f;">
    <img src="./resources/logo-white.svg" alt="GrokUI logo" width="100%" />
  </span>
</p>

Unofficial desktop client for `grok` and `agent`, built with Electron and inspired by the browser version of Grok.

## GrokUI

GrokUI does not reimplement Grok from scratch. It uses the locally installed Grok CLI as its backend and turns the terminal workflow into a desktop chat interface.

The app starts `grok` and `agent` commands behind the scenes, without visible CMD windows, and renders CLI streaming output directly in the chat.

## Features

- dark desktop UI inspired by Grok in the browser
- UI language synced with the system language (`it`/`en`, English fallback)
- collapsible sidebar
- contextual `Conversations` list driven by the active mode (`grok` or `agent`)
- existing session discovery via `grok sessions list` and `agent sessions list`
- transcript loading via `grok export` and `agent export`
- streaming output rendered as chat messages
- message renderer with markdown paragraphs, inline code, bold, emphasis, strikethrough, headings, rules, lists, task lists, quotes, tables, images, and triple-backtick code blocks
- full syntax highlighting in code blocks
- automatic language detection for unlabeled code blocks, with safe plain-text fallback
- quick code-block controls with copy, wrap/no-wrap, and line numbers
- in-chat pending response indicator
- stop current generation
- configurable working directory
- configurable model, when supported by the CLI
- switch between `GrokUI` and `CLI` visual styles for assistant messages
- clickable local paths, URLs, markdown links, and markdown images inside messages
- quick copy for messages, code blocks, and markdown tables
- local session rename
- hide sessions locally in the UI
- local assignment of sessions to the Agent section
- open generated images/videos through buttons localized to the system language
- file attachments through the composer `+` button
- drag and drop files into the chat
- removable attachment chips before sending
- send local file paths to Grok CLI as plain text, without copying or uploading files
- SVG logo in the UI and generated app icons from `resources/icon.svg`

## File Attachments

Grok CLI works well with local file paths. For this reason, GrokUI does not upload files: it reads the real path of the selected or dropped file and appends it to the prompt.

Example:

```text
Can you use this image as reference?

File attachments:
K:\AI\ComfyUI\output\Grok_Porn_00031.png
```

You can also send only a file with no extra text:

```text
File attachments:
K:\AI\ComfyUI\output\Grok_Porn_00031.png
```

## Modes

- `grok`: direct chat with Grok through the local CLI
- `agent`: more guided multi-step task workflow through Agent CLI

The distinction is about UX and the underlying CLI command. GrokUI does not automatically convert a `grok` session into an `agent` session: assigning a session to the Agent section remains a local UI preference.

## Requirements

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

## Install

```powershell
npm install
```

## Development

```powershell
npm run dev
```

By default the app uses the real system home directory as the initial working directory, so it can see sessions started from your home folder. You can change it from the sidebar.

## Build

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

All `build:*` scripts run `npm run build` first, so icon generation, typecheck, and the Electron build stay consistent across Windows, Linux, and macOS.

## Useful Scripts

- `npm run dev`: start the app in development
- `npm run start`: preview the Electron build
- `npm run icons`: convert `resources/icon.svg` into `build/icon.png`, `build/icon.ico`, and `build/icon.icns`
- `npm run build`: generate icons, run typechecks, and build the app
- `npm run build:win`: build the Windows installer/app
- `npm run build:linux`: build Linux packages
- `npm run build:mac`: build the macOS package
- `npm run test`: run the Vitest suite for the markdown parser and highlighter
- `npm run test:watch`: run Vitest in watch mode
- `npm run lint`: run ESLint
- `npm run format`: format the project with Prettier

## Troubleshooting

- `grok` or `agent` is not found
  Run `grok --help` and `agent --help` in the same terminal environment used to launch the app. If they fail there, fix your `PATH` or CLI installation first.
- No conversations appear
  The visible session list depends on the current working directory. Change the working directory from the sidebar to the folder or home directory where you normally started `grok` or `agent`.
- Sessions look different between CLI and GrokUI
  GrokUI reads sessions from the CLI. If the CLI changes behavior, output format, or filtering rules, the UI will reflect that.
- Attachments do not upload
  This is expected. GrokUI sends local file paths as text to the CLI. It does not upload files itself.
- A code block shows `text` or plain formatting
  If a block has no explicit language and the detector cannot infer it confidently, GrokUI falls back to plain text rendering.
- Generated media does not open
  Check that the file path in the message still exists on disk and is accessible by the OS.
- Build fails on macOS or Linux
  `electron-builder` may require extra platform tooling or signing configuration depending on your target. Verify your local packaging prerequisites before assuming the app build is broken.
- The UI is in English instead of Italian
  The UI follows the system language. Only `it` is mapped to Italian; all other locales currently fall back to English.

## Assets

- UI logo: `resources/logo.svg`
- white logo for README/UI: `resources/logo-white.svg`
- source icon: `resources/icon.svg`
- generated white icon: `resources/icon-white.svg`
- generated icons:
  - Windows: `build/icon.ico`
  - macOS: `build/icon.icns`
  - Linux: `build/icon.png`

## Notes

- GrokUI depends on the features available in the locally installed CLI.
- Visible sessions may depend on the working directory used when you started `grok` or `agent`.
- The separation between `grok` and `agent` in the sidebar is a UI concept; execution is delegated to the respective CLI commands.
- Rename and hide session are local app preferences, not permanent changes in the CLI.
- Attached files are not copied: Grok receives the local path as text.

## Limitations

- GrokUI depends completely on the capabilities and behavior of the locally installed CLI.
- Attached files are not uploaded by the app; only the local path is sent as text.
- Visible sessions may change depending on the working directory used with `grok` or `agent`.
- Some app behavior may change when the underlying CLI changes.
- The message renderer supports a richer markdown subset and highlighted code blocks, but it is still not a full markdown implementation with every possible extension.
