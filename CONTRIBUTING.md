# Contributing to LabelForge

Thanks for your interest in improving LabelForge! Contributions are welcome.
*(Italiano più sotto.)*

## Getting started

```bash
git clone https://github.com/dextsamu/labelforge.git
cd labelforge
npm install
npm start        # launch the GUI
npm run cli -- list-templates   # try the CLI
```

## Project layout

- `gui/` — Electron app (main process, preload, UI renderer, live preview, barcode encoders)
- `lib/zpl.js` — ZPL generation from templates
- `lib/print.js` — sending to the printer (network / Windows / USB)
- `templates/` — example label templates (JSON)
- `.github/workflows/build.yml` — CI that builds the apps

## How to contribute

1. Open an **issue** first for bugs or feature ideas (templates below).
2. Fork the repo and create a branch: `git checkout -b my-change`.
3. Keep changes focused; match the existing code style (plain JS, no build step for the app code).
4. Test manually: run `npm start`, verify the GUI, and check `node -c` passes on changed JS files.
5. Open a **pull request** describing what changed and why.

## Ideas that are always welcome

- New barcode symbologies (e.g. DataMatrix, Code93), new example templates.
- Translations of the UI, accessibility improvements.
- Bug fixes for specific printer models.

## Notes on signing & auto-update (optional)

The packaged app is **not code-signed**, so Windows SmartScreen may warn on first run.
To sign it you need a code-signing certificate (paid) and to add it as CI secrets; auto-update can
then be added with `electron-updater` pointing at GitHub Releases. These are optional and not
required to build or use the app.

---

# Contribuire a LabelForge

Grazie per l'interesse! I contributi sono benvenuti.

## Avvio rapido

```bash
git clone https://github.com/dextsamu/labelforge.git
cd labelforge
npm install
npm start
```

## Come contribuire

1. Apri prima una **issue** per bug o proposte (usa i modelli).
2. Fai un fork e crea un branch: `git checkout -b mia-modifica`.
3. Mantieni le modifiche mirate e coerenti con lo stile esistente (JS semplice, nessun passo di build per il codice dell'app).
4. Prova a mano con `npm start` e verifica che `node -c` passi sui file modificati.
5. Apri una **pull request** spiegando cosa cambia e perché.

## Firma ed auto-aggiornamento (opzionali)

L'app impacchettata **non è firmata**, quindi Windows SmartScreen può avvisare al primo avvio.
Per firmarla serve un certificato di code-signing (a pagamento) da aggiungere come secret della CI;
l'auto-aggiornamento si può poi attivare con `electron-updater` sulle Release di GitHub. Sono passi
facoltativi, non necessari per usare l'app.
