# SkyTuner maintenance

Preserve the simple wheel and time controls, fitting desktop and mobile screens without scrolling the primary view. Keep birth data in the browser and out of shared links.

## Release policy requested by Mark

- Increment the patch version for every newly published release unless Mark explicitly requests a minor or major bump.
- Use `npm run release` for patch, `npm run release -- minor` or `npm run release -- major` only when requested.
- A Site deployment and its matching GitHub source/tag are one logical release and use the same version. A retry of the same build retains its version.
- Read the current version from package.json. Advance it once at the start of a new release; keep that version when retrying the same release.
- Package metadata is the source of truth. Keep package-lock.json, the footer/About/image attribution, version.json, source download and GitHub release/tag consistent.
- The copyright owner is Mark Steven Smith, Jr.; link the name to https://www.markstevensmithjr.com. Preserve the 2026 copyright year for this release.
- Run `npm run check`, `npm test`, `npm run verify:native`, and `npm run build` before publication. Verify the browser layout and changed user flows. Do not claim unperformed checks.
- GitHub destination: public https://github.com/akrabu/skytuner. Do not publish hosting identity, credentials, saved charts, or local runtime state. Keep the full corresponding source and third-party notices.

Host an existing Sites project through its supported source helper and native deployment tools. Preserve its project identity and public audience.
