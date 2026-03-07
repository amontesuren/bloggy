# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at http://localhost:5173
npm run build     # Build to dist/
npm run preview   # Preview production build locally
npm run deploy    # Build and deploy to GitHub Pages
```

No test framework is configured.

## Architecture

**Falken's Maze** is a React 18 + Vite SPA for Medical Physics / Nuclear Medicine, deployed on Vercel with `vercel.json` rewriting all routes to `index.html` for client-side routing.

### Routing (App.jsx)

Two layout tiers:
- **`<Layout />`** (with Sidebar + Topbar): wraps the main tools at `/`, `/convert-units`, `/decay-calculator`, `/restricciones-lu177`, `/uniformidad-gamma`, `/rtplan-compare`
- **Standalone pages** (no layout): `/admin`, `/quiz-creator`, `/quizzes`, `/quiz/:quizId`, `/host/:quizId`, `/join`

### Firebase (firebase.js)

Config is base64-encoded and split across an array to avoid plain-text secrets in source. Exports `db` (Firestore) and `auth` (Google Auth).

Firestore collections used:
- `BLOG` — blog posts, keyed by slug
- `QUIZ_SESSIONS` — real-time quiz sessions (live host/join flow via `onSnapshot`)

### Pages

- **Blog.jsx** — paginated Firestore feed, renders Markdown with `marked` + `highlight.js`. Converts Google Drive share URLs to direct image URLs via `lh3.googleusercontent.com/d/{fileId}`.
- **Admin.jsx** — Google Auth-gated editor. Auto-generates slug from title. Publishes to `BLOG` collection. Includes inline `AdminTopbar` component.
- **UniformidadGamma.jsx** — DICOM file upload, parses with `dicomParser.js`, runs NEMA NU 1-2012 algorithms (`nemaAlgorithms.js`), renders results on `<canvas>` via `canvasRenderer.js`.
- **RTPlanCompare.jsx** — DICOM RT Plan file comparison using `rtPlanParser.js`.
- **QuizHost / QuizJoin / QuizPlay / QuizList / QuizCreator** — real-time multiplayer quiz system using Firestore `onSnapshot` for live state sync.

### Key dependencies

- `dicom-parser` — DICOM file parsing (used in UniformidadGamma and RTPlanCompare)
- `marked` + `highlight.js` — Markdown rendering with syntax highlighting
- `chart.js` + `react-chartjs-2` — bar charts in QuizHost results view
- `firebase` — Firestore + Google Auth backend

### Styles

Global styles in `src/styles.css`. Feature-specific stylesheets: `src/styles/admin.css`, `src/styles/quiz.css`, `src/styles/rtplan.css`. Uses CSS custom properties for theming (e.g. `--text-muted`, `--text-secondary`).
