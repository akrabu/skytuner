import {readFile} from 'node:fs/promises';
const metadata=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
if(!/^\d+\.\d+\.\d+$/.test(metadata.version)||metadata.version!==lock.version||metadata.version!==lock.packages?.['']?.version)throw new Error('Release versions do not match. Run npm run release before publishing.');
console.log(`SkyTuner v${metadata.version}: version metadata matches.`);
