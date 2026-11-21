# Mind Sensei

A private, local-first brain training app for focus, memory, reaction speed, and number patterns. No account, API key, external font, or database server is required.

## Run locally

Requires Node.js 20.9 or newer and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000).

For the production build, including offline support:

```sh
npm run build
npm start
```

The service worker is enabled in production. Keep the first visit connected until Settings shows **Ready for offline practice**. It prepares every app route and its JavaScript and styles for subsequent offline visits. Installation requires a browser that supports web apps and HTTPS (localhost is supported for development). Install from the browser menu, or use Share → Add to Home Screen on iOS.

## What is implemented

- **Focus:** select circles and ignore square distractors. Missed targets, duplicate clicks, and distractions affect the score.
- **Memory:** watch a number sequence and recall it in order. Exact recall increases the next sequence length; the reported span counts successfully recalled sequences.
- **Reaction:** respond to GO signals and hold back on STOP signals. Early responses, missed GO signals, and incorrect STOP responses are recorded separately.
- **Logic:** complete numeric sequences, with eight progressively unlocked pattern types and four unique answers per puzzle.
- **Sessions:** quick (8 rounds) and standard (16 rounds), countdown, keyboard controls, pause/resume, automatic pause on tab changes, a five-minute active-time limit, and a results screen with per-game metrics.
- **Progress:** session history, XP, levels, ranks, local-calendar streaks, 14 achievements, personal bests, a weighted seven-day growth index, daily trend charts, and a 30-day activity map.
- **Adaptive difficulty:** each skill adjusts after a completed session. Same-skill performance declines dampen the adjustment.
- **Preferences:** functional sound cues, reduced motion, and a saved default session length. System reduced-motion preferences are also respected.
- **Data management:** JSON export, validated import with a replacement preview, difficulty reset, and confirmed deletion of training data.
- **Offline:** precached app routes and assets, installable manifest, an offline indicator, and persistent-storage requests.
- **Accessibility:** labeled controls, visible keyboard focus, semantic session tables, a skip link, a mobile navigation focus trap, and non-color signal labels.

Game scores describe performance in these exercises. They are not a clinical assessment or a measure of intelligence.

## Data and privacy

Training data is saved in IndexedDB on the current browser and origin. All session, XP, streak, achievement, difficulty, and summary updates commit in one transaction. A failed save can be retried from the results screen without duplicating the session. Web Locks serialize writes across tabs where supported, and BroadcastChannel refreshes open tabs.

Database version 2 migrates the original local-storage profile and fixes daily summary keys so multiple skills can retain results on the same day. Daily summaries and XP level counters are regenerated when importing a backup. The full backup is validated before any replacement begins; replacement uses a single transaction.

Back up before clearing browser data, changing browser profiles, moving devices, or switching the app's hostname or port. Browser storage is not a substitute for a backup. **Clear training data** preserves preferences; **Import backup** replaces both history and preferences. There is no cloud sync.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

The domain tests cover inactivity scoring, duplicate input, exact memory recall, reaction false starts, seeded logic generation, date-aware daily aggregation, non-mutating analytics, difficulty bounds, XP progression, achievement deduplication, and backup rejection.

For the browser checks, start the production server in one terminal with `npm start`. In another:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r tests/requirements.txt
playwright install chromium
python tests/e2e.py
```

The browser suite uses an isolated browser profile. It completes all four games, checks saving and reloads, exports and restores a backup, rejects invalid imports, verifies preferences and tab synchronization, checks all routes at mobile and desktop widths, and completes a session without a network connection. Screenshots and the test backup are written to the ignored `test-results/` folder. Set `MINDSENSEI_URL` to test a different server.

## Structure

```text
src/app/                   Next.js routes and page metadata
src/components/training/   Shared session interface and lifecycle
src/components/layout/     App initialization and responsive navigation
src/domain/                Game engines, analytics, difficulty, rewards
src/hooks/                 Reactive storage access and pausable timers
src/infrastructure/state/  Transactional app state and tab synchronization
src/infrastructure/db/     IndexedDB schema and typed operations
src/infrastructure/export/ Backup validation and import/export
src/styles/                Design tokens, pages, responsive styling
public/sw.js               Production offline cache
public/manifest.json       Installable app metadata
tests/                     Domain regression tests and browser suite
```

Built with Next.js, React, TypeScript, and CSS. Deploy with any Node.js host supporting Next.js, using `npm run build` and `npm start`. No secrets or external services are required.
