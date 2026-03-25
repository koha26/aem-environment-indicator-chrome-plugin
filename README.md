# AEM Environment Highlighter

> **🚧 Work in progress — not ready for production use.**

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Chrome](https://img.shields.io/badge/chrome-%3E%3D93-brightgreen?logo=googlechrome)
![Manifest](https://img.shields.io/badge/manifest-v3-informational)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
![Build](https://img.shields.io/badge/build-passing-brightgreen)
<!-- Chrome Web Store badge (add once published):
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/<extension-id>)](https://chromewebstore.google.com/detail/<extension-id>)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/<extension-id>)](https://chromewebstore.google.com/detail/<extension-id>)
-->

A Chrome extension that visually indicates which AEM (Adobe Experience Manager) environment you are currently viewing — DEV, STAGE, PROD, QA, UAT, or RELEASE — so you never accidentally edit production.

---

## Features

- **Favicon overlay** — a colored badge letter (D / S / P / Q / U / R) overlaid on the tab favicon
- **Title prefix** — environment label prepended to the page title, with optional emoji (🔵 🟠 🔴 🟣 🟢 ⚫)
- **Popup badge** — extension icon shows the current environment at a glance
- **Author / Publish detection** — detects AEM Author vs Publish mode from URL/path heuristics
- **Manual override** — cycle the environment label with `Alt+Shift+E`
- **Configurable programs** — group environments by AEM program, map hostnames with exact or glob patterns
- **Fallback regex patterns** — catch-all hostname rules when no program matches
- **Export / Import config** — back up and restore settings as JSON

### Environment Colors

| Environment | Color  | Badge |
|-------------|--------|-------|
| DEV         | Blue   | D     |
| STAGE       | Orange | S     |
| PROD        | Red    | P     |
| QA          | Purple | Q     |
| UAT         | Green  | U     |
| RELEASE     | Slate  | R     |

---

## Detection Strategy

1. **DOM label** — reads the `#env-labels` element (standard AEM tier label).
2. **User-configured programs** — exact hostname or glob pattern match (`*.dev.example.com`).
3. **Fallback regex patterns** — user-defined regex rules applied to the hostname.
4. **AEM mode** — path (`/editor.html`, `/libs/wcm/`) and hostname (`author`, port `4503`) heuristics.

---

## Installation (development)

**Prerequisites:** Node.js ≥ 18

```bash
npm install
npm run build        # production build → dist/
npm run dev          # watch mode for development
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

---

## Configuration

Open the **Options** page (right-click the extension icon → *Options*) to:

- Toggle visual features (favicon, title prefix, emoji, badge)
- Add **Programs** with named environments and URL patterns
- Add **Fallback patterns** (regex) for hostname matching
- Export or import the full configuration as JSON

---

## Keyboard Shortcut

`Alt+Shift+E` — cycles the environment override for the active tab:
`(auto) → DEV → STAGE → PROD → QA → UAT → RELEASE → (auto)`

The shortcut can be reassigned at `chrome://extensions/shortcuts`.

---

## Project Structure

```
src/
  assets/          # Extension icons
  background/      # Service worker (MV3)
  content/         # Content scripts (detector, favicon, title)
  options/         # Options page
  popup/           # Popup UI
  shared/          # Constants, storage helpers, URL matcher
  manifest.json
webpack.config.js
```

---

## License

Licensed under the [Apache License 2.0](LICENSE).
