import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),html=await readFile(new URL('index.html',root),'utf8');
const head=html.match(/<head>([\s\S]*?)<\/head>/i)?.[1];assert.ok(head,'Initial HTML must include a head.');
const attributes=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const tags=[...head.matchAll(/<meta\b[^>]*>/g)].map(m=>attributes(m[0]));
function meta(key){const matches=tags.filter(t=>t.property===key||t.name===key);assert.equal(matches.length,1,`Expected one static ${key} tag.`);assert.ok(matches[0].content.trim(),`${key} must not be empty.`);return matches[0].content;}
const {homepage}=JSON.parse(await readFile(new URL('package.json',root),'utf8')),origin=new URL(homepage).origin;
const canonical=[...head.matchAll(/<link\b[^>]*>/g)].map(m=>attributes(m[0])).filter(t=>t.rel==='canonical');
assert.equal(canonical.length,1);assert.equal(canonical[0].href,origin+'/');assert.equal(meta('og:url'),canonical[0].href);assert.equal(meta('og:type'),'website');meta('og:site_name');meta('og:description');meta('og:image:alt');meta('twitter:image:alt');
assert.equal(meta('twitter:card'),'summary_large_image');assert.equal(meta('twitter:title'),meta('og:title'));assert.ok(meta('og:title').length<=70,'Keep shared titles concise.');assert.equal(meta('twitter:description'),meta('og:description'));assert.equal(meta('twitter:image'),meta('og:image'));assert.equal(meta('og:image:type'),'image/png');
const image=new URL(meta('og:image'));assert.equal(image.protocol,'https:');assert.equal(image.origin,origin);assert.equal(image.search,'');assert.equal(image.hash,'');
async function png(file){const bytes=await readFile(file);assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Preview assets must be real PNGs.');assert.ok(bytes.length<1_000_000,'Keep preview assets lightweight.');return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];}
const dimensions=await png(new URL('public'+image.pathname,root));assert.deepEqual(dimensions,[Number(meta('og:image:width')),Number(meta('og:image:height'))]);assert.ok(dimensions[0]>=900,'Messages preview images should be at least 900px wide.');
const links=[...head.matchAll(/<link\b[^>]*>/g)].map(m=>attributes(m[0]));
for(const [rel,size] of [['apple-touch-icon',180],['icon',32]]){const link=links.find(t=>t.rel===rel&&t.sizes===`${size}x${size}`);assert.ok(link,`Missing ${rel} PNG.`);assert.deepEqual(await png(new URL('public'+link.href,root)),[size,size]);}
console.log(`Shared-link metadata and PNG assets verified (${dimensions.join('×')}).`);
