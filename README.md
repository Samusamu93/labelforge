# LabelForge

*[🇮🇹 Leggi in italiano](README.it.md)*

Desktop app (Electron) and command-line tool to print **ZPL** labels on Zebra printers (tested on
the **ZD410**) over **network (IP)** or **USB/Windows**. Labels are defined by **dynamic JSON
templates**, with a **visual editor**, **live preview**, drag & resize of elements, list fields
(dropdown / per-option quantity), and rapid printing with a barcode scanner.

No paid dependencies. The CLI runs on plain Node; the GUI uses Electron.

## Features

- Print over network (raw port 9100), by Windows printer name (Win32 API — works with any port
  type, including Zebra Setup Utilities virtual ports), or to a USB device on Linux/Mac.
- JSON templates: text, Code128 barcode, QR code, lines and boxes; sizes in mm; 203/300 dpi.
- Visual editor with live preview: select, drag, resize, snap to grid.
- Dynamic `{{field}}` inputs: text, dropdown, or quantity lists (one label per item).
- Auto-print after scan (the scanner acts as a keyboard).
- Settings and custom templates saved in the user data folder.
- Package to a Windows `.exe`; desktop shortcut created automatically on first run.

## Requirements

- [Node.js](https://nodejs.org) 18+ (20+ recommended).
- Windows for USB printing by printer name; network (IP) works everywhere.

## Quick start (GUI)

```bash
npm install
npm start
```

## Command line (CLI)

```bash
# list templates
node cli.js list-templates
# list Windows printers
node cli.js list-printers
# print over network
node cli.js print --template product-51x25 --ip 192.168.1.50 --set title="Item" --set code=12345
# print by Windows printer name (recommended)
node cli.js print --template product-51x25 --printer "Zebra" --set title="Item" --set code=12345
# test / calibrate
node cli.js test --printer "Zebra"
node cli.js calibrate --printer "Zebra"
```

## Build the Windows EXE

Recommended (no code-signing issues):

```bash
npm install
npm run pack:exe
```

Output in `dist-app/LabelForge-win32-x64/`, a double-clickable executable.

Alternatively, an installer via electron-builder (`npm run dist`) — on Windows this may require
Developer Mode enabled (symbolic links).

### Automatic build on GitHub

The workflow `.github/workflows/build.yml` builds the exe on a Windows runner: create and push a
`vX.Y.Z` tag to produce a Release with the zip attached, or run it manually from the **Actions** tab.

## Templates

Templates live in `templates/*.json`. Minimal example:

```json
{
  "name": "product-51x25",
  "dpi": 203,
  "width_mm": 51,
  "height_mm": 25,
  "tear_off": 30,
  "field_meta": {
    "category": { "type": "select", "label": "Category", "options": ["A", "B", "C"] }
  },
  "elements": [
    { "type": "text", "x_mm": 3, "y_mm": 2, "height_mm": 3, "width_mm": 3, "text": "{{title}}" },
    { "type": "barcode128", "x_mm": 3, "y_mm": 11, "bar_height_mm": 8, "text": "{{code}}" }
  ]
}
```

Element types: `text`, `barcode128`, `qrcode`, `box`, `line`. `field_meta` of type `select` becomes
a dropdown; `multi-qty` becomes a per-option quantity list (one label per unit). The included sample
templates cover a product label, shipping, QR, and `product-variants` (dropdown + quantity list).

## Structure

```
cli.js                       command line
gui/                         Electron app (main, preload, index.html, renderer, preview)
lib/zpl.js                   ZPL generator
lib/print.js                 network / Windows printer / USB sending
scripts/send-raw-printer.ps1 RAW send to a Windows printer by name
templates/                   example templates (editable)
.github/workflows/build.yml  automatic exe build
```

## Technical notes

ZPL is sent "raw": on Windows via `OpenPrinter`/`WritePrinter` (works with any port type, including
virtual ports); over the network on port 9100; on Linux/Mac by writing to the device (e.g.
`/dev/usb/lp0`). If labels don't stop at the tear bar, run `calibrate` and tune `tear_off` in the
template.

## License

MIT — see [LICENSE](LICENSE).
