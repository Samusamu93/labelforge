<div align="center">

<img src="docs/banner.svg" width="820" alt="LabelForge">

### Stampa etichette ZPL su stampanti Zebra — app desktop + CLI, con editor visuale dei template.

Progetta le etichette visivamente, compila i campi (o scansionali) e stampa via rete o USB.

[![Licenza: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Piattaforma](https://img.shields.io/badge/piattaforma-Windows%20%7C%20Linux%20%7C%20macOS-blue)](#-requisiti)
[![Electron](https://img.shields.io/badge/Electron-31-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Build](https://github.com/Samusamu93/labelforge/actions/workflows/build.yml/badge.svg)](https://github.com/Samusamu93/labelforge/actions/workflows/build.yml)

[🇬🇧 English](README.md) · **🇮🇹 Italiano**

</div>

---

> **LabelForge** trasforma template JSON dinamici in ZPL e li invia direttamente a una stampante
> Zebra (testata su **ZD410**). Funziona da un'interfaccia desktop pulita *oppure* da riga di
> comando, con editor dei template drag‑and‑drop e anteprima live. Nessuna dipendenza a pagamento.

<div align="center">
  <img src="docs/Screenshot.png" width="880" alt="LabelForge — vista di stampa con anteprima live">
</div>

## ✨ Caratteristiche

| | |
|---|---|
| 🖨️ **Connessioni multiple** | Rete (porta raw 9100), stampante Windows per nome (API Win32 — funziona con qualsiasi porta, anche quelle virtuali di Zebra Setup Utilities), o device USB su Linux/Mac. |
| 🧩 **Template dinamici** | Template JSON con testo, codice a barre Code128, QR code, linee e riquadri. Misure in mm; 203/300 dpi. |
| 🎨 **Editor visuale** | Anteprima live; seleziona, trascina, ridimensiona e aggancia gli elementi a una griglia. Nessuna modifica manuale del JSON. |
| ⌨️ **Campi intelligenti** | Campi `{{campo}}` come testo, menu a tendina o liste con quantità per voce (una etichetta per unità). |
| ⚡ **Scansiona e stampa** | Stampa automatica dopo la scansione (il lettore si comporta come tastiera) — ideale per raffiche. |
| 📄 **Stampa in blocco da CSV** | Importa un CSV e stampa una etichetta per riga (le colonne riempiono i `{{campi}}`). |
| 🔁 **Condividi i template** | Esporta/importa i template come `.json`; testa la connessione alla stampante prima di stampare. |
| 💾 **Ricorda tutto** | Stampante, ultimo template e preferenze salvati tra un avvio e l'altro. |
| 📦 **Distribuisci come app** | Pacchettizzazione in `.exe` Windows; collegamento sul Desktop creato automaticamente al primo avvio. |

## 📋 Requisiti

- [Node.js](https://nodejs.org) 18+ (consigliato 20+)
- Windows per la stampa USB tramite nome stampante — la rete (IP) funziona ovunque

## 🚀 Avvio rapido (GUI)

```bash
npm install
npm start
```

## 🖥️ Riga di comando (CLI)

```bash
node cli.js list-templates                 # elenco template
node cli.js list-printers                  # elenco stampanti Windows
# stampa via rete
node cli.js print --template product-51x25 --ip 192.168.1.50 --set title="Prodotto" --set code=12345
# stampa per nome stampante Windows (consigliato)
node cli.js print --template product-51x25 --printer "Zebra" --set title="Prodotto" --set code=12345
node cli.js test --printer "Zebra"         # etichetta di prova
node cli.js calibrate --printer "Zebra"    # calibrazione automatica sensori
```

## 📦 Creare l'eseguibile Windows

Metodo consigliato (nessun problema di code‑signing):

```bash
npm install
npm run pack:exe
```

Risultato in `dist-app/LabelForge-win32-x64/` — eseguibile avviabile a doppio clic.
In alternativa un installer con `npm run dist` (electron‑builder; su Windows può richiedere la Modalità sviluppatore).

### 🤖 Build automatica su GitHub

Il workflow [`build.yml`](.github/workflows/build.yml) compila l'exe su un runner Windows.
Pubblica un tag `vX.Y.Z` per generare una **Release** con lo zip allegato, oppure lancialo dalla
scheda **Actions**:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## 🧩 Template

I template stanno in `templates/*.json`. Esempio minimo:

```json
{
  "name": "product-51x25",
  "dpi": 203,
  "width_mm": 51,
  "height_mm": 25,
  "tear_off": 30,
  "field_meta": {
    "category": { "type": "select", "label": "Categoria", "options": ["A", "B", "C"] }
  },
  "elements": [
    { "type": "text", "x_mm": 3, "y_mm": 2, "height_mm": 3, "width_mm": 3, "text": "{{title}}" },
    { "type": "barcode128", "x_mm": 3, "y_mm": 11, "bar_height_mm": 8, "text": "{{code}}" }
  ]
}
```

**Tipi di elemento:** `text`, `barcode128`, `qrcode`, `box`, `line`.
**Tipi di campo** (`field_meta`): `select` → menu a tendina, `multi-qty` → lista con quantità per
voce (una etichetta per unità). Esempi inclusi: prodotto, spedizione, QR e `product-variants`
(tendina + lista quantità).

## 🗂️ Struttura del progetto

```
cli.js                        riga di comando
gui/                          app Electron (main, preload, index.html, renderer, preview)
lib/zpl.js                    generatore ZPL
lib/print.js                  invio rete / stampante Windows / USB
scripts/send-raw-printer.ps1  invio RAW a stampante Windows per nome
templates/                    template di esempio (modificabili)
.github/workflows/build.yml   build automatica dell'exe
```

## 🔧 Note tecniche

Lo ZPL viene inviato **raw**: su Windows tramite `OpenPrinter`/`WritePrinter` (qualsiasi tipo di
porta, anche virtuali); via rete su porta 9100; su Linux/Mac scrivendo sul device (es.
`/dev/usb/lp0`). Se le etichette non si fermano sulla barra di strappo, esegui `calibrate` e regola
`tear_off` nel template.

> `npm audit` può segnalare avvisi dagli strumenti di sviluppo (Electron/builder). Non finiscono
> nell'app e si possono ignorare — **non** lanciare `npm audit fix --force` (rompe il build).

## 📄 Licenza

Rilasciato sotto [Licenza MIT](LICENSE).
