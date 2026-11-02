import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arrangeLabels,aspectsFor,DEFAULT_PREFS,distance,positionLabel} from '../src/model.ts';
import {AmbiguousTime,MIN_TIME,MAX_TIME,localInput,playbackTime,resolveLocal,stepTime} from '../src/time.ts';
import {parseBackup,readShare,shareLink} from '../src/storage.ts';
import {calculateChart} from '../src/engine.ts';
import {readFile} from 'node:fs/promises';

test('local date entry handles DST repeats and gaps explicitly',()=>{
  assert.throws(()=>resolveLocal('2026-11-01T01:30','America/Los_Angeles'),AmbiguousTime);
  const early=resolveLocal('2026-11-01T01:30','America/Los_Angeles','earlier');
  const late=resolveLocal('2026-11-01T01:30','America/Los_Angeles','later');
  assert.equal(late-early,3600000);
  assert.throws(()=>resolveLocal('2026-03-08T02:30','America/Los_Angeles'),/did not exist/);
  assert.equal(new Date(resolveLocal('1900-01-01T12:00','-05:30')).toISOString(),'1900-01-01T17:30:00.000Z');
});
test('calendar steps preserve clock time, clamp month ends, and handle leap years',()=>{
  const start=resolveLocal('2026-03-07T12:00','America/Los_Angeles');
  assert.equal(stepTime(start,'day',1,'America/Los_Angeles')-start,23*3600000);
  assert.equal(localInput(stepTime(Date.parse('2024-01-31T12:00Z'),'month',1,'UTC'),'UTC'),'2024-02-29T12:00:00');
  assert.equal(localInput(stepTime(Date.parse('2024-02-29T12:00Z'),'year',1,'UTC'),'UTC'),'2025-02-28T12:00:00');
});
test('playback is derived from elapsed time and respects range boundaries',()=>{
  const start=Date.parse('2026-06-01T00:00Z');
  assert.equal(playbackTime(start,2.5,1,1,'day','UTC'),start+2.5*86400000);
  assert.equal(playbackTime(start,2,.25,-1,'hour','UTC'),start-1800000);
  assert.equal(stepTime(MAX_TIME,'year',1,'UTC'),MAX_TIME);
  assert.equal(stepTime(MIN_TIME,'day',-1,'UTC'),MIN_TIME);
});
test('degree formatting carries into the next sign and wraps the zodiac',()=>{
  assert.equal(positionLabel(29.99999).text,'0°00′ Taurus');
  assert.equal(positionLabel(359.99999).text,'0°00′ Aries');
});
test('crowded labels spanning zero stay separated in cyclic order',()=>{
  const p=[358,359,0,1,2].map((longitude,i)=>({id:String(i),longitude,speed:1}));
  const labels=arrangeLabels(p,10),values=[...labels.values()].sort((a,b)=>a-b);
  for(let i=0;i<values.length;i++) assert.ok(distance(values[i],values[(i+1)%values.length])>=9.9999);
});
test('major aspects work across zero, including fixed natal targets',()=>{
  const sky=[{id:'sun',longitude:359,speed:1},{id:'moon',longitude:1,speed:12}];
  assert.equal(aspectsFor(sky,null,6)[0].name,'Conjunction');
  assert.equal(aspectsFor([sky[0]],[{id:'venus',longitude:59,speed:1}],3)[0].name,'Sextile');
});
test('shared moments round-trip their settings and never include birth details',()=>{
  const prefs={...DEFAULT_PREFS,timeZone:'America/New_York',place:{name:'New York',latitude:40.7128,longitude:-74.006,zone:'America/New_York'}};
  const instant=Date.parse('2026-11-01T06:30Z'),url=shareLink('https://example.test',instant,prefs);
  const incoming=readShare(new URL(url).hash,DEFAULT_PREFS)!;
  assert.equal(incoming.instant,instant);assert.deepEqual(incoming.prefs.place,prefs.place);assert.equal(incoming.prefs.timeZone,prefs.timeZone);
  assert.ok(!url.includes('birth'));assert.ok(!url.includes('natal'));assert.equal(readShare('#t=nonsense',prefs),null);
});
test('invalid or out-of-range birth backups are rejected',()=>{
  assert.throws(()=>parseBackup('{"version":1,"charts":[{"name":"Fake","instant":0}]}'),/valid/);
  assert.throws(()=>parseBackup('{"version":2,"charts":[]}'),/valid/);
});
test('full ephemeris works at both ends of the range, with honest house failures',async()=>{
  const path=new URL('../node_modules/swisseph-wasm/wasm/',import.meta.url);
  const factory=(await import(new URL('swisseph.js',path).href)).default;
  const module=await factory({locateFile:(file:string)=>new URL(file,path).pathname});
  module.ccall('swe_set_ephe_path',null,['string'],['/sweph']);
  for(const block of ['12','24'])for(const kind of ['sepl','semo','seas']){const name=`${kind}_${block}.se1`;module.FS.writeFile(`/sweph/${name}`,new Uint8Array(await readFile(new URL(`../public/vendor/swisseph/${name}`,import.meta.url))));}
  for(const instant of [MIN_TIME,Date.parse('2000-01-01T12:00Z'),MAX_TIME]) {
    const chart=calculateChart(module,instant,null,'P');assert.equal(chart.positions.length,13);assert.ok(chart.positions.every(p=>Number.isFinite(p.longitude)&&p.longitude>=0&&p.longitude<360));
    const north=chart.positions.find(p=>p.id==='northnode')!,south=chart.positions.find(p=>p.id==='southnode')!;assert.ok(Math.abs(distance(north.longitude,south.longitude)-180)<1e-9);
  }
  const place={name:'Tromsø',latitude:69.6492,longitude:18.9553,zone:'Europe/Oslo'};
  const polar=calculateChart(module,Date.parse('2026-06-21T12:00Z'),place,'P');
  assert.ok(polar.houseError);assert.equal(polar.cusps,null);
  assert.equal(calculateChart(module,Date.parse('2026-06-21T12:00Z'),place,'W').cusps?.length,12);
  const unknown=calculateChart(module,Date.parse('2000-01-01T12:00Z'),place,'P',true);assert.equal(unknown.ascendant,null);assert.equal(unknown.cusps,null);
});
