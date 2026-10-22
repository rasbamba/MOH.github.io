# Moh-clean language selector — GitHub Pages patch

This package changes **only** the language feature of your existing GitHub Pages website.

## Replace only these repository files

1. `index.html` (repository root)
2. `assets/locales.js` (inside the existing `assets` folder)

Do **not** replace or erase `config.js` because it already contains your Apps Script `/exec` URL. Do **not** change the backend Apps Script files or Google Sheets.

## GitHub upload

From `rasbamba/MOH.github.io`, open `index.html`, use **Edit**, replace content with the downloaded `index.html`, and commit. Then open `assets/locales.js`, use **Edit**, replace with `assets/locales.js` from this package, and commit. Or use Add file → Upload files, retaining paths, to replace both.

Under Actions, wait for GitHub Pages deployment to finish. Reload `https://rasbamba.github.io/MOH.github.io/` using Ctrl+Shift+R.

Expected translations when selecting language: EN → **Sign in**; FR → **Connexion**; IT → **Accedi**; AR → **تسجيل الدخول** (right-to-left); DE → **Anmelden**. The printed A4 Arbeitsnachweis stays German.

If the selector still does not work, open Chrome DevTools → Console and run `window.MohCleanLanguage?.get()`; if this returns undefined, `assets/locales.js` is failing to load. Verify the published URL `https://rasbamba.github.io/MOH.github.io/assets/locales.js?v=20261022-fix2` displays JavaScript rather than a 404 page.

The language choice is saved in browser localStorage (`moh_clean_language`).
