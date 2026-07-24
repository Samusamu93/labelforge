# LabelForge

*[🇬🇧 Read in English](README.md)*

Applicazione desktop (Electron) e strumento da riga di comando per stampare etichette **ZPL** su
stampanti Zebra (testata su **ZD410**) via **rete (IP)** o **USB/Windows**. Le etichette sono
definite tramite **template dinamici** in JSON, con **editor visuale**, **anteprima live**,
trascinamento e ridimensionamento degli elementi, campi a lista (menu a tendina / quantità) e
stampa a raffica con lettore di codici a barre.

Nessuna dipendenza a pagamento. La CLI funziona con Node puro; la GUI usa Electron.

## Caratteristiche

- Stampa via rete (porta raw 9100), stampante Windows per nome (API Win32, funziona con qualsiasi
  porta, anche quelle virtuali di Zebra Setup Utilities), o device USB su Linux/Mac.
- Template JSON: testo, codice a barre Code128, QR code, linee e riquadri; misure in mm; 203/300 dpi.
- Editor visuale con anteprima live: seleziona, trascina, ridimensiona, snap alla griglia.
- Campi dinamici `{{campo}}`: testo, menu a tendina, oppure liste con quantità (una etichetta per voce).
- Stampa automatica dopo la scansione (il lettore si comporta come tastiera).
- Impostazioni e template personalizzati salvati nella cartella dati utente.
- Pacchettizzazione in `.exe` Windows; collegamento sul Desktop creato automaticamente al primo avvio.

## Requisiti

- [Node.js](https://nodejs.org) 18+ (consigliato 20+).
- Windows per la stampa USB tramite nome stampante; rete (IP) funziona ovunque.

## Avvio rapido (GUI)

```bash
npm install
npm start
```

## Riga di comando (CLI)

```bash
# elenco template
node cli.js list-templates
# elenco stampanti Windows
node cli.js list-printers
# stampa via rete
node cli.js print --template product-51x25 --ip 192.168.1.50 --set title="Prodotto" --set code=12345
# stampa per nome stampante Windows (consigliato)
node cli.js print --template product-51x25 --printer "Zebra" --set title="Prodotto" --set code=12345
# test / calibrazione
node cli.js test --printer "Zebra"
node cli.js calibrate --printer "Zebra"
```

## Creare l'eseguibile Windows

Metodo consigliato (nessun problema di code-signing):

```bash
npm install
npm run pack:exe
```

Risultato in `dist-app/LabelForge-win32-x64/`, eseguibile avviabile a doppio clic.

In alternativa, installer con electron-builder (`npm run dist`) — su Windows può richiedere la
Modalità sviluppatore attiva per i link simbolici.

### Build automatica su GitHub

Il workflow `.github/workflows/build.yml` compila l'exe su un runner Windows: crea e pubblica un tag
`vX.Y.Z` per generare una Release con lo zip allegato, oppure lancialo dalla scheda **Actions**.

## Template

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

Tipi di elemento: `text`, `barcode128`, `qrcode`, `box`, `line`. I `field_meta` di tipo `select`
diventano menu a tendina; `multi-qty` diventa una lista con quantità per voce (una etichetta per
quantità). I template di esempio inclusi coprono prodotto, spedizione, QR e `product-variants`
(menu a tendina + lista con quantità).

## Struttura

```
cli.js                       riga di comando
gui/                         app Electron (main, preload, index.html, renderer, preview)
lib/zpl.js                   generatore ZPL
lib/print.js                 invio rete / stampante Windows / USB
scripts/send-raw-printer.ps1 invio RAW a stampante Windows per nome
templates/                   template di esempio (modificabili)
.github/workflows/build.yml  build automatica dell'exe
```

## Note tecniche

Lo ZPL viene inviato "raw": su Windows tramite le API `OpenPrinter`/`WritePrinter` (così funziona
con qualsiasi tipo di porta, anche quelle virtuali di Zebra Setup Utilities); via rete su porta 9100;
su Linux/Mac scrivendo sul device (es. `/dev/usb/lp0`). Se le etichette non si posizionano bene sulla
barra di strappo, esegui `calibrate` e regola `tear_off` nel template.

## Licenza

MIT — vedi [LICENSE](LICENSE).
