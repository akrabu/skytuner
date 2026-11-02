# SkyTuner

Yesterday’s transits. Tomorrow’s hits.

[Open SkyTuner](https://skytuner.akrabu.app) · [Source](https://github.com/akrabu/skytuner) · [Changes](CHANGELOG.md)

SkyTuner v0.0.2 · © 2026 [Mark Steven Smith, Jr.](https://www.markstevensmithjr.com)

A single-screen tropical transit wheel with local natal charts, time scrubbing, forward/reverse playback, planet focus, shared moments, and PNG export. Birth data and planetary calculations remain in the browser. Location search uses Open-Meteo/GeoNames; manual coordinates and time zones work without the search service.

## Run and build

Requires Node.js 24 or later and npm. Run `npm ci`, then `node scripts/prepare-vendor.mjs` and `npm run dev`. Run `npm run build` for the static `dist/` output. Serve it at the origin root. `npm test` runs the time, chart, and sharing checks. `node --experimental-strip-types scripts/verify-native.mjs` also compares the browser adapter with a separately compiled native Swiss Ephemeris build (requires `cc` and `tar`).

The production app requires WebAssembly and modern JavaScript. It has no application server, API keys, database, accounts, or analytics. The shared link uses a URL fragment and intentionally excludes natal data. Browser storage can be backed up and restored with the birth-chart manager.

## Releases

Every newly published release increments the patch version unless Mark requests a minor or major release. Run `npm run release` (patch by default), or explicitly `npm run release -- minor` / `npm run release -- major`. This prepares package.json and package-lock.json together; it does not publish anything. The footer, About dialog and image attribution read that package version, and the build writes `/version.json`.

Run `npm run check`, `npm test`, `npm run verify:native`, and `npm run build`; review the changed browser flows at desktop and mobile sizes. Publish the same tested source to the Site and GitHub and tag it `v<version>`. A retry of the same release uses its existing version. See [maintenance instructions](AGENTS.md) and [review details](docs/REVIEW.md). The 0.0.2 version is already prepared for this review release.

Static hosting needs the contents of `dist/` served at the domain root with HTTPS. GitHub stores the portable source; the live deployment is hosted by Sites. There are no application secrets to configure. The `.openai/` identity used by the original hosted Site is intentionally excluded from public source.

## Calculations

Swiss Ephemeris 2.10.03 via the pinned swisseph-wasm 0.1.0 release, with bundled `sepl_18.se1`, `semo_18.se1`, and `seas_18.se1` data, with adjacent 1200/2400 blocks loaded at the range boundaries to cover light-time and Delta-T overlap. Apparent geocentric tropical positions, speed-derived retrogrades, true lunar nodes, and Placidus/Whole Sign houses. UTC is converted to UT1 by Swiss Ephemeris. The app checks return codes rather than silently accepting a different ephemeris or house system. The Gregorian date range is 1800-01-01 through 2399-12-31 UTC. Available IANA civil-time rules are provided by the browser; explicit UTC offsets support historical records.

## Corresponding source

This project is AGPL-3.0-or-later. See LICENSE and THIRD-PARTY-NOTICES.md. The exact upstream source for the distributed WASM binary, including C sources, data, JavaScript glue, and its Emscripten build script, is in `public/source/swisseph-wasm-corresponding-source.tar.gz`; its pinned provenance is in `public/source/UPSTREAM.json`. To rebuild the upstream WASM, unpack it, install Emscripten, and run its `compile.sh` from the extracted root. To use that rebuilt binary, replace the three generated `wasm/swisseph.*` files in the installed `swisseph-wasm` package, then run the app build. The unmodified upstream wrapper is GPL-3.0-or-later; Swiss Ephemeris itself is covered by its AGPL license.

`scripts/source.mjs` creates a source ZIP in the build output. The ZIP includes this app, lockfile, fonts and notices, and the matching upstream source archive. It contains no saved charts, credentials, hosting configuration, or deployment archive.
