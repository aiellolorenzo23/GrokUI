# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, adapted to the current needs of this project.

## [1.0.0] - 2026-06-08

### Added
- Initial public release of GrokUI as an Electron desktop client for the local Grok CLI.
- Desktop chat interface for `grok` and `agent` sessions with streaming CLI output rendering.
- Session discovery and transcript loading through the locally installed CLI.
- Markdown message rendering with code blocks, syntax highlighting, tables, task lists, quotes, links, and images.
- Assistant message display modes for `GrokUI` and `CLI`.
- Inline media previews and quick open/view actions for generated local assets.
- Configurable working directory and model selection when supported by the CLI.
- File attachments sent as local file paths in prompts instead of uploaded file contents.
- Local session rename, hide, and Agent assignment preferences in the UI.
- Generated desktop icons for Windows, macOS, and Linux from the SVG source asset.

### Notes
- GrokUI depends on a locally installed and already configured Grok CLI environment.
- Windows, macOS, and Linux packages are produced through Electron Builder.
