# Release 0.0.2 review

Review of the 0.0.2 release prepared for [SkyTuner](https://skytuner.akrabu.app) and its [public source repository](https://github.com/akrabu/skytuner).

## Changes reviewed

Calculation input validation, applying/separating motion near exact aspects, DST ambiguity and precise time preservation, backup validation, storage failure reporting, stale location searches, worker recovery, keyboard focus, timeline controls, narrow layouts, exported chart metadata and synchronized release attribution.

## Calculation limits

Gregorian UTC range: 1800-01-01 through 2399-12-31. Civil-time conversions use the browser's time-zone database; fixed UTC offsets are available for historical records. Placidus can be undefined at polar latitudes; the app reports that condition and offers Whole Sign without silently substituting it. Unknown birth time uses a labeled noon estimate with natal houses and angles omitted.

## Privacy and distribution

Charts and preferences are stored only in the current browser. Search queries go to Open-Meteo's geocoding service. Shared links include the selected transit location and settings, never birth-chart names or birth times. PNG images intentionally include the visible natal overlay. Browser storage may be unavailable or cleared, so chart backups remain available.

The source download and repository include application code, lockfile, fonts and notices, ephemeris data, and corresponding upstream source for the distributed WASM. Hosting configuration and browser data are excluded.

## Validation results

- TypeScript check and all 18 automated tests pass. Regression checks cover exact-time edits, both DST occurrences, spring-forward gaps, UTC boundaries, aspect motion, malformed/injected backups, corrupt storage, failed writes, shared locations, engine input validation, image metadata and default patch/minor/major release preparation.
- A separately compiled native Swiss Ephemeris reference matches 444 values across 12 charts; maximum difference 0.00003650 arcseconds. Cases include both supported date boundaries and polar house behavior.
- Seeded stress check: 20,000 groups of 13 planetary labels retained the required minimum separation, including clusters across zodiac zero.
- Dependency audit: zero known vulnerabilities in production and development dependencies at review time.
- Browser main view fits without horizontal or vertical page scrolling at 305×743, 320×568, 360×640, 390×844, 844×390 and 1280×720. Date-editor content scrolls within its dialog when needed.
- Browser checks confirmed explicit DST occurrence selection and unchanged re-save, Home/End date boundaries, city/manual coordinate synchronization, unfinished-search validation and keyboard planet selection.
- Controlled browser failure checks confirmed Worker-construction recovery, the 45-second unresponsive-worker timeout and recovery, corrupt-storage notices, and honest save-failure reporting. Simulation pages are excluded from production/source distribution.
- A real 1800×2142 PNG with natal overlay was downloaded and visually inspected: fonts/glyphs, natal birthplace, date/time zone and release/copyright metadata render correctly.
- GitHub Actions repeats checks, tests, native comparison and production build for main, release tags and pull requests. Browser checks apply to the connected Chromium environment; separate physical iOS/Android devices were not available for testing.

## 0.0.3 installation follow-up

Added expandable iPhone/Safari and Android/Chrome install instructions near the top of Settings, checked against Apple and Google’s official guides. Includes older browser menu labels, embedded-browser advice, chart backup transfer steps and the internet requirement. A standalone manifest and opaque PNG icons at 180/192/512pixels use the existing SkyTuner mark; the app still needs a connection when opened or reloaded and does not register an offline service worker.

Browser checks at 305px,390px and1280px confirmed that the instructions expand with mouse/keyboard, remain within the dialog without horizontal overflow and leave existing Settings controls available. All 18tests and 444native reference values pass. The production build validates types and includes manifest/icons/source. Actual installation on physical iPhone/Android devices was not performed in this browser environment.
