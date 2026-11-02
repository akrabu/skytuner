import {execFileSync} from 'node:child_process';
import {mkdir,readFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {calculateChart} from '../src/engine.ts';
import {distance} from '../src/model.ts';
const root=process.cwd(),cache=path.join(root,'node_modules/.cache/skytuner-native');
await mkdir(cache,{recursive:true});
execFileSync('tar',['-xzf',path.join(root,'public/source/swisseph-wasm-corresponding-source.tar.gz'),'-C',cache,'--strip-components=1']);
const source=path.join(cache,'deps/swisseph'),data=path.join(cache,'deps/sweph'),binary=path.join(cache,'reference');
for(const block of ['12','24'])for(const kind of ['sepl','semo','seas']){const name=`${kind}_${block}.se1`;await copyFile(path.join(root,'public/vendor/swisseph',name),path.join(data,name));}
const files=['swecl.c','swedate.c','swehouse.c','swejpl.c','swemmoon.c','swemplan.c','sweph.c','swephlib.c','swehel.c'];
execFileSync('cc',['-O2','-I',source,path.join(root,'tests/native-reference.c'),...files.map(f=>path.join(source,f)),'-lm','-o',binary],{stdio:'pipe'});
const base=new URL('../node_modules/swisseph-wasm/wasm/',import.meta.url);
const factory=(await import(new URL('swisseph.js',base).href)).default;
const module=await factory({locateFile:file=>new URL(file,base).pathname});
module.ccall('swe_set_ephe_path',null,['string'],['/sweph']);
for(const block of ['12','24'])for(const kind of ['sepl','semo','seas']){const name=`${kind}_${block}.se1`;module.FS.writeFile(`/sweph/${name}`,new Uint8Array(await readFile(path.join(root,'public/vendor/swisseph',name))));}
const cases=[['1800-01-01T00:00:00Z',51.5074,-.1278],['1900-06-15T17:30:00Z',-33.8688,151.2093],['2000-01-01T12:00:00Z',51.5074,-.1278],['2026-11-01T06:30:00Z',40.7128,-74.006],['2399-12-31T23:59:59Z',35.6762,139.6503],['2026-06-21T12:00:00Z',69.6492,18.9553]];
let checks=0,maxDifference=0;
for(const [iso,latitude,longitude] of cases) for(const house of ['P','W']) {
  const date=new Date(iso),args=[data,date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate(),date.getUTCHours(),date.getUTCMinutes(),date.getUTCSeconds(),latitude,longitude,house,'fixture'].map(String);
  const native=JSON.parse(execFileSync(binary,args,{encoding:'utf8'}));
  const chart=calculateChart(module,date.getTime(),{name:'Reference',latitude,longitude,zone:'UTC'},house);
  function close(a,b,label){const difference=Math.abs(a-b);maxDifference=Math.max(maxDifference,difference);assert.ok(difference<1/3600,`${iso} ${house} ${label}: ${difference}°`);checks++;}
  chart.positions.slice(0,12).forEach((p,i)=>{close(distance(p.longitude,native.positions[i][0]),0,p.id);close(p.speed,native.positions[i][1],`${p.id} speed`);});
  assert.equal(chart.cusps===null,native.houseStatus<0);
  if(chart.cusps)chart.cusps.forEach((c,i)=>close(distance(c,native.cusps[i]),0,`house ${i+1}`));
  close(distance(chart.ascendant,native.ascendant),0,'ASC');close(distance(chart.mc,native.mc),0,'MC');
}
console.log(`Native Swiss Ephemeris verification: ${checks} values across ${cases.length*2} charts; maximum difference ${(maxDifference*3600).toFixed(8)} arcseconds.`);
