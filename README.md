# World-O-Rama

A zoomable world-map quiz about who exploited whom throughout history, with a dry sense of humor. Each round gives a clue such as:

> An African nation that was exploited by Belgium for rubber in the 1900s

Click the right country. You keep a score, a streak and a trend over time.

## Run it

Requires Node 18 or newer. Works on Linux, macOS and Windows.

```
npm install
npm run dev        # http://localhost:5173
```

For a static build: `npm run build && npm run preview`.

## Desktop app (Linux AppImage)

The game can also be packaged as a single-file desktop app with Electron.

```
npm run package:linux          # builds release/World-O-Rama-<version>-x86_64.AppImage
chmod +x release/World-O-Rama-*.AppImage
./release/World-O-Rama-*.AppImage
```

- Packaging needs Node 22.12 or newer (an Electron requirement). If you run it on an older Node, the script re-runs itself under a temporary Node 22 fetched by `npx`, so nothing is installed system-wide. The first run downloads Electron (about 100 MB).
- Running an AppImage needs FUSE 2. On Ubuntu and Linux Mint 22 install it with `sudo apt install libfuse2t64`. Without it, run `./World-O-Rama-*.AppImage --appimage-extract-and-run`.
- The app loads the same static build in a sandboxed window with a strict Content-Security-Policy. The only network access is Wikipedia, for the optional extract on the reveal card. Links open in your browser.
- Stats and settings are stored per user by the desktop app, separately from the browser version.
- To try the desktop wrapper without packaging: `npm run electron`. To redraw the icon: `npm run icon`, then the `convert` command in `scripts/make-icon.mjs`.

## How to play

- **Modes:** Quick Round (10 questions) or Endless.
- **Clues:** questions are generated from templates, for example region + exploiter + resource + era, "which modern nation was once part of the Congo Free State?", coups ("a coup backed by the CIA"), invasions ("invaded by the Soviet Union"), and hand-written clues. A clue accepts every country that fits it.
- **Hints:** each hint costs 25% of the points (penalty capped at 75%). The first hint highlights five countries, exactly one of which is correct. Later hints give the continent, whether the country is an island or landlocked, the sub-region, and written clues.
- **Scoring:** base points by difficulty (easy, medium, hard), a streak bonus, minus hint penalties.
- **Filters (Settings):** region, era, difficulty and topic (coups and CIA operations, invasions, colonialism, occupations and annexations). Questions only appear if every accepted answer is in your chosen regions.
- **Map:** wheel or pinch to zoom, drag to pan, `+` `-` `0` and the arrow keys when the map is focused. Hovering a country shows its name (can be turned off in Settings). Very small countries get click markers.
- **Theme:** a Dark / Light selector in the header (light blue ocean in the light theme).
- **Trend:** accuracy and score over time, breakdowns by region, era and exploiter, and a weak-spots list. Missed countries come back sooner.
- **Humor:** jokes aim at empires, bureaucracy and the player's cartography, never at victims. Sensitive events (slavery, famine, massacres and similar) never get quips, and quips can be turned off in Settings.

Stats and settings are stored in your browser's `localStorage`. Settings has export, import and reset.

## The data

About 1,070 events across 230 countries and territories, which generate roughly 22,700 questions. Everything lives in `data/events/<ISO3>.json`, one file per country, and is editable by hand. Events attach to the modern country covering the territory and name the historical power involved.

- Contested claims are flagged `"alleged": true`, and question wording, hints and the reveal card then say "allegedly".
- Every event has a Wikipedia article and at least one source. The reveal card shows an optional live Wikipedia extract when you are online.
- The dataset is curated and non-exhaustive, written from web research. Please review it for accuracy, completeness and framing. Each reveal card has a "Report this question" button that saves a flag locally, exported from Settings.

See [docs/DATA_GUIDE.md](docs/DATA_GUIDE.md) for the schema, labels, tone rules and quality bar.

## Scripts

- `npm run dev` starts the dev server.
- `npm run build` typechecks and builds. `npm run preview` serves the build.
- `npm test` runs the unit tests (Vitest).
- `npm run typecheck` runs TypeScript.
- `npm run package:linux` builds the AppImage into `release/` (git-ignored). `npm run electron` runs the desktop wrapper from a fresh build.
- `npm run validate` checks the dataset (schema, vocabulary, years, duplicate ids, answer-set ambiguity, per-country question coverage). Add `-- --strict` to fail on low coverage and `-- --online` to also check that every Wikipedia title exists. The online check retries when Wikipedia rate-limits it.

## Project layout

```
data/events/      one JSON file per country (the dataset)
docs/             data authoring guide
electron/         desktop wrapper (Electron main process)
build/            app icon
scripts/          dataset validator, icon generator, packaging script
src/data/         country lookup, vocabularies, event loading
src/game/         question engine, scoring, stats, humor copy, era helpers
src/ui/           map, game UI, trend charts, Wikipedia enrichment
tests/            unit tests
```

Built with Vite and TypeScript. The map uses `d3-geo` and `d3-zoom` with Natural Earth data from `world-atlas`.

## License

GPL-2.0, see [LICENSE](LICENSE).
