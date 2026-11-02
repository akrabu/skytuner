import {cp,mkdir,copyFile} from 'node:fs/promises';
await mkdir('public/vendor/swisseph',{recursive:true});
await cp('node_modules/swisseph-wasm/wasm','public/vendor/swisseph',{recursive:true});
await copyFile('node_modules/swisseph-wasm/LICENSE','public/vendor/swisseph/WRAPPER-LICENSE');
await mkdir('public/fonts',{recursive:true});
await copyFile('node_modules/@fontsource/noto-sans-symbols-2/files/noto-sans-symbols-2-symbols-400-normal.woff2','public/fonts/sky-symbols.woff2');
await copyFile('node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2','public/fonts/dm-sans.woff2');
await copyFile('node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2','public/fonts/space-grotesk.woff2');
await mkdir('public/licenses',{recursive:true});
for(const [name,file] of [
  ['DM-Sans-OFL.txt','node_modules/@fontsource-variable/dm-sans/LICENSE'],
  ['Space-Grotesk-OFL.txt','node_modules/@fontsource-variable/space-grotesk/LICENSE'],
  ['Noto-Sans-Symbols-2-OFL.txt','node_modules/@fontsource/noto-sans-symbols-2/LICENSE'],
  ['Temporal-ISC.txt','node_modules/@js-temporal/polyfill/LICENSE'],
  ['JSBI-Apache-2.0.txt','node_modules/jsbi/LICENSE']
]) await copyFile(file,`public/licenses/${name}`);
