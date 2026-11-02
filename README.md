# SkyTuner

Yesterday’s transits. Tomorrow’s hits.

[Open SkyTuner](https://skytuner.akrabu.app) · [Source](https://github.com/akrabu/skytuner) · [Changes](CHANGELOG.md)

SkyTuner v0.0.4 · © 2026 [Mark Steven Smith, Jr.](https://www.markstevensmithjr.com)

A single-screen tropical transit wheel with local natal charts, time scrubbing, forward/reverse playback, planet focus, shared moments, and PNG export. Birth data and planetary calculations remain in the browser. Location search uses Open-Meteo/GeoNames; manual coordinates and time zones work without the search service.

## Run and build

Requires Node.js 24 or later and npm. Run `npm ci`, then `node scripts/prepare-vendor.mjs` and `npm run dev`. Run `npm run build` for the static `dist/` output. Serve it at the origin root. `npm test` runs the time, chart, and sharing checks. `node --experimental-strip-types scripts/verify-native.mjs` also compares the browser adapter with a separately compiled native Swiss Ephemeris build (requires `cc` and `tar`).

The production app requires WebAssembly and modern JavaScript. It has no application server, API keys, database, accounts, or analytics. The shared link uses a URL fragment and intentionally excludes natal data. Browser storage can be backed up and restored with the birth-chart manager.

## Releases

Every newly published release increments the patch version unless Mark requests a minor or major release. Run `npm run release` (patch by default), or explicitly `npm run release -- minor` / `npm run release -- major`. This prepares package.json and package-lock.json together; it does not publish anything. The footer, About dialog and image attribution read that package version, and the build writes `/version.json`.

Run `npm run check`, `npm test`, `npm run verify:native`, and `npm run build`; review the changed browser flows at desktop and mobile sizes. Publish the same tested source to the Site and GitHub and tag it `v<version>`. A retry of the same release uses its existing version. See [maintenance instructions](AGENTS.md) and [review details](docs/REVIEW.md).

Static hosting needs the contents of `dist/` served at the domain root with HTTPS. GitHub stores the portable source; the live deployment is hosted by Sites. There are no application secrets to configure. The `.openai/` identity used by the original hosted Site is intentionally excluded from public source.

## Calculations

Swiss Ephemeris 2.10.03 via the pinned swisseph-wasm 0.1.0 release, with bundled `sepl_18.se1`, `semo_18.se1`, and `seas_18.se1` data, with adjacent 1200/2400 blocks loaded at the range boundaries to cover light-time and Delta-T overlap. Apparent geocentric tropical positions, speed-derived retrogrades, true lunar nodes, and Placidus/Whole Sign houses. UTC is converted to UT1 by Swiss Ephemeris. The app checks return codes rather than silently accepting a different ephemeris or house system. The Gregorian date range is 1800-01-01 through 2399-12-31 UTC. Available IANA civil-time rules are provided by the browser; explicit UTC offsets support historical records.

## Corresponding source

This project is AGPL-3.0-or-later. See LICENSE and THIRD-PARTY-NOTICES.md. The exact upstream source for the distributed WASM binary, including C sources, data, JavaScript glue, and its Emscripten build script, is in `public/source/swisseph-wasm-corresponding-source.tar.gz`; its pinned provenance is in `public/source/UPSTREAM.json`. To rebuild the upstream WASM, unpack it, install Emscripten, and run its `compile.sh` from the extracted root. To use that rebuilt binary, replace the three generated `wasm/swisseph.*` files in the installed `swisseph-wasm` package, then run the app build. The unmodified upstream wrapper is GPL-3.0-or-later; Swiss Ephemeris itself is covered by its AGPL license.

`scripts/source.mjs` creates a source ZIP in the build output. The ZIP includes this app, lockfile, fonts and notices, and the matching upstream source archive. It contains no saved charts, credentials, hosting configuration, or deployment archive.

## Install on a phone

Open Settings → Install SkyTuner for separate iPhone/Safari and Android/Chrome steps, with links to Apple and Google’s current instructions. A standalone manifest and bundled PNG icons support Home Screen installation. An internet connection is needed to open/reload the app and search cities; there is no offline service worker. If charts do not appear after installation, export them with Birth charts → Back up charts in the browser and Import backup in the installed app.

The PNG app icons are rendered from `public/icons/icon.svg` (the existing favicon mark on an opaque background), using `rsvg-convert` at 180, 192 and 512 pixels. They are committed assets; building the app does not require an image renderer.

## Shared-link previews

The initial HTML includes canonical/Open Graph/Twitter metadata and a branded 1200×630PNG at `public/social/skytuner-card-v1.png`, plus raster icons. `npm run check:sharing` validates the metadata, canonical host, linked files and PNG dimensions; every build runs it. After publication, verify that the unauthenticated public HTML and image return successfully, including preview-crawler requests. Keep image filenames fresh when artwork changes. Existing Messages cards may remain cached by the receiving app. Preview metadata intentionally describes the app rather than any private natal chart.

The social artwork SVG is editable source; its PNG and the 32px favicon can be regenerated with `rsvg-convert`. Builds use the committed PNGs and do not require that renderer. Apple guidance: https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages. Open Graph reference: https://ogp.me/.
