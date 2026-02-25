# CLAUDE.md — AI Assistant Guide for `bloggy`

## Project Overview

`bloggy` is a static website focused on nuclear medicine and medical physics. It combines a Firebase-backed blog platform with scientific calculators for radioactivity unit conversion, isotope decay, and Lu-177 radiotherapy dosimetry. The site is written in **Spanish** and targets medical physicists and nuclear medicine professionals.

There is **no build step, no package manager, and no test suite**. All code is plain HTML, CSS, and JavaScript served directly from static files.

---

## Repository Structure

```
/home/user/bloggy/
├── index.html               # Main blog hub with Firebase integration
├── convertUnits.html        # Radioactivity unit converter (Ci ↔ Bq)
├── decayCalculator.html     # Isotope decay calculator
├── RestricionesLu177.html   # Lu-177 dosimetric restrictions calculator
└── logo.png                 # Site logo/avatar image
```

All HTML files are self-contained: markup, CSS (`<style>`), and JavaScript (`<script>`) are all embedded inline. There are no separate `.css` or `.js` files.

---

## Technology Stack

| Layer | Technology | Version | Loaded Via |
|---|---|---|---|
| UI Framework | Bootstrap | 5.3.2 | CDN |
| Blog Backend | Firebase Firestore | 9.23.0 | CDN |
| Math Rendering | MathJax | 3.2.2 | CDN |
| Markdown Parsing | Marked.js | latest | CDN |
| Charting | Chart.js | latest | CDN |
| DOM Extensions | HTMX | 1.9.10 | CDN (unused) |

There is no Node.js, Python, or any server-side code.

---

## Key Files In Depth

### `index.html` — Blog Hub

- Loads blog posts dynamically from a Firebase Firestore collection named `BLOG`.
- Firebase credentials are stored **base64-encoded** in a `<script>` block near the top of the file. Do not move or re-encode them.
- Blog posts support:
  - Markdown content rendered via `marked.js`
  - LaTeX math rendered via MathJax
  - Topic-based filtering via query param `?t=<topic>`
  - Direct post linking via query param `?slug=<slug>`
  - Infinite scroll using `IntersectionObserver`
- **Firestore collection:** `BLOG`
- **Firestore document fields:**
  - `titulo` — post title (string)
  - `contenido` — Markdown body (string)
  - `fecha` — publication timestamp (Firestore Timestamp)
  - `topic` — category tag (string)
  - `minutos` — estimated reading time in minutes (number)

### `convertUnits.html` — Unit Converter

Simple real-time converter between Curie-based and Becquerel-based radioactivity units. No backend. Conversion factors are hardcoded in the inline `<script>`.

### `decayCalculator.html` — Decay Calculator

Calculates residual activity using `A(t) = A₀ × e^(-λt)`. Supported isotopes and their half-lives are hardcoded. Input is via datetime pickers for calibration date and target date.

### `RestricionesLu177.html` — Lu-177 Restrictions

Most complex page. Calculates radiation restriction periods for family members and workers after Lu-177 therapy. Features:
- Drug selection (DOTA-TATE vs PSMA-617) with different effective half-lives
- Multi-cycle support
- Chart.js dose-rate decay visualization
- Color-coded restriction badges (green/yellow/red)

---

## Development Conventions

### Language and Naming
- **UI text and comments:** Spanish (es-ES)
- **HTML `id` and `name` attributes:** kebab-case, often in Spanish (e.g., `actividad-inicial`, `fecha-calibracion`)
- **JavaScript variables and functions:** camelCase, mix of Spanish and English names
- **CSS custom properties:** kebab-case (e.g., `--bg-color`, `--text-primary`)

### Visual Style
- Dark theme throughout, inspired by GitHub's color scheme
- CSS variables defined in `:root` control the palette; always use variables rather than hard-coded hex values
- Consistent sidebar navigation pattern on `index.html`; other pages have simpler single-column layouts
- Bootstrap grid used for responsive layout; custom media queries supplement it for mobile

### JavaScript Patterns
- All logic is inline in `<script>` blocks at the bottom of each `<body>`
- Event listeners attached directly (no framework state management)
- Firebase SDK used in compat mode (v9 compat namespace API): `firebase.firestore()`, not the modular API
- `IntersectionObserver` used for infinite scroll in `index.html`

---

## Making Changes

### Editing Pages
1. Open the relevant `.html` file directly.
2. CSS lives in the `<style>` block inside `<head>`.
3. JavaScript lives in `<script>` block(s) at the end of `<body>`.
4. There is no compilation — changes are immediately reflected when the file is opened in a browser.

### Adding a New Calculator Page
1. Create a new `.html` file at the root of the repository.
2. Copy the `<head>` section from an existing page to inherit Bootstrap and the dark theme CSS variables.
3. Add a link to it in the sidebar of `index.html` (the `<nav>` element with class `sidebar-nav`).

### Adding or Editing Blog Posts
Blog posts are managed directly in the Firebase Firestore console for project `falken-s-maze`. There is no admin UI in the codebase itself.

### Changing CDN Library Versions
All CDN URLs are inline in each HTML file. Search across files with `grep` for the library name (e.g., `bootstrap`) and update every occurrence. Test manually after upgrading.

---

## No Testing or Linting

There is no automated test suite, linter, or formatter configured. Manual browser testing is the only validation method. When making changes:
- Open the modified HTML file in a browser to verify visual correctness
- Check the browser's developer console for JavaScript errors
- Test on both a wide desktop viewport and a narrow mobile viewport

---

## Git Workflow

- Main branch: `master`
- Feature/session branches follow the pattern: `claude/<session-id>`
- Commit messages follow the pattern: `Update <filename>.html` or `Add <description>`
- No CI/CD is configured; pushes go directly to the repo

---

## Firebase Credentials Note

The Firebase project ID is `falken-s-maze`. Credentials are embedded (base64-encoded) in `index.html`. These are client-side Firebase credentials (not secret server keys) and are intentionally public-facing, but avoid committing plaintext copies unnecessarily.

---

## What This Project Is NOT

- Not a Node.js/npm project — do not run `npm install`
- Not a Python project — do not create virtual environments
- Not a TypeScript project — all JS is plain ES6+
- There are no tests to run
- There is no build command to execute
- There is no local development server required — open `.html` files directly in a browser
