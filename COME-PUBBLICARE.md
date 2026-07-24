# Come pubblicare su GitHub (gratis)

1. Crea un repository vuoto su GitHub (pubblico), senza README/gitignore/licenza
   (li hai già in questa cartella). Copia l'URL, es. `https://github.com/TUOUTENTE/labelforge.git`.

2. In questa cartella (`github-public`), apri il terminale ed esegui:

   ```bash
   git init
   git add .
   git commit -m "Primo commit: LabelForge"
   git branch -M main
   git remote add origin https://github.com/TUOUTENTE/labelforge.git
   git push -u origin main
   ```

3. (Facoltativo) Per generare l'eseguibile Windows come Release scaricabile:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

   GitHub Actions compilerà l'exe e lo allegherà automaticamente alla Release
   (vedi scheda **Actions** e **Releases** del repo).

Note:
- `node_modules/`, `dist/`, `dist-app/` e `settings.json` sono esclusi da `.gitignore`.
- Se non hai git installato: https://git-scm.com/download/win
- Aggiungi il tuo nome nel campo `"author"` di `package.json` e nel file `LICENSE` se vuoi.
