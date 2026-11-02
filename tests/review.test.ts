import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {aspectsFor,DEFAULT_PREFS,type BirthChart,type Chart} from '../src/model.ts';
import {localInput,resolveEditedLocal,resolveLocal,MIN_TIME,MAX_TIME} from '../src/time.ts';
import {parseBackup,readCharts,readPrefs,readShare,saveCharts,storageWarnings} from '../src/storage.ts';
import {calculateChart,type SweModule} from '../src/engine.ts';
import {exportSvg} from '../src/export.ts';
import {LIGHT_COLORS} from '../src/wheel.ts';
import {APP_VERSION} from '../src/version.ts';

const place={name:'New York',latitude:40.7128,longitude:-74.006,zone:'America/New_York'};
const birth:BirthChart={id:'original',name:'A chart',instant:Date.parse('2026-11-01T06:30:45.123Z'),localDateTime:'2026-11-01T01:30:45',place,timeUnknown:false};

test('editing a chart preserves exact seconds, milliseconds and the recorded DST fold',()=>{
  const input=localInput(birth.instant,place.zone);
  assert.equal(input,'2026-11-01T01:30:45');
  assert.equal(resolveEditedLocal(input,place.zone,birth.instant,place.zone),birth.instant);
  assert.equal(resolveEditedLocal(input,place.zone,birth.instant,place.zone,'later'),birth.instant);
  assert.equal(resolveEditedLocal(input,place.zone,birth.instant,place.zone,'earlier'),birth.instant-3600000-123);
  assert.equal(resolveEditedLocal('2026-11-01T01:31:45',place.zone,birth.instant,place.zone,'later'),birth.instant+60000-123);
});
test('UTC boundary moments round-trip through local dates outside the UTC year envelope',()=>{
  for(const [instant,zone] of [[MIN_TIME,'-12:00'],[MAX_TIME,'+14:00']] as const){
    assert.equal(resolveLocal(localInput(instant,zone),zone),instant);
  }
});
test('aspect phase is instantaneous near exactness, including retrograde and zodiac wrap',()=>{
  const phase=(longitude:number,speed:number,target=0)=>aspectsFor([{id:'moon',longitude,speed}],[{id:'sun',longitude:target,speed:1}],3)[0].phase;
  assert.equal(phase(59.99,12),'Applying');
  assert.equal(phase(60.01,12),'Separating');
  assert.equal(phase(60.01,-12),'Applying');
  assert.equal(phase(359.99,12),'Applying');
  assert.equal(phase(.01,12),'Separating');
  assert.equal(phase(60,12),'Exact');
  assert.equal(phase(61,0),'Stationary');
  const relative=aspectsFor([{id:'moon',longitude:59.99,speed:12},{id:'sun',longitude:0,speed:13}],null,3)[0];
  assert.equal(relative.phase,'Separating');
});
test('backup validation rejects malformed values and injected date markup',()=>{
  const invalid=[null,[],{version:1,charts:[{...birth,localDateTime:'2026-11-01T01:30\" onfocus=\"alert(1)'}]},{version:1,charts:[{...birth,name:''}]},{version:1,charts:[{...birth,instant:MAX_TIME+1}]},{version:1,charts:[{...birth,timeUnknown:'false'}]},{version:1,charts:[{...birth,place:{...place,latitude:NaN}}]}];
  for(const value of invalid)assert.throws(()=>parseBackup(JSON.stringify(value)),/valid/);
  assert.throws(()=>parseBackup('{oops'),/valid/);
  const imported=parseBackup(JSON.stringify({version:1,charts:[{...birth,extra:'discard',place:{...place,extra:'discard'}}]}));
  assert.notEqual(imported[0].id,birth.id);assert.equal(imported[0].instant,birth.instant);
  assert.ok(!('extra' in imported[0]));assert.ok(!('extra' in imported[0].place));
});
test('corrupt storage reports recovery warnings and failed writes return false',()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const values=new Map<string,string>([['skytuner.preferences.v1','{bad'],['skytuner.birth-charts.v1',JSON.stringify([birth,birth,{name:'broken'}])]]);
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:()=>{throw new Error('QuotaExceededError');}}});
  try{
    const before=storageWarnings.length;
    assert.equal(readPrefs().houseSystem,'P');assert.equal(readCharts().length,1);
    assert.equal(storageWarnings.length,before+2);assert.equal(saveCharts([birth]),false);
    assert.equal(values.get('skytuner.birth-charts.v1'),JSON.stringify([birth,birth,{name:'broken'}]));
  }finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else Reflect.deleteProperty(globalThis,'localStorage');}
});
test('shared moments reject empty coordinates, unsupported bodies and excessive input',()=>{
  const date='2026-01-01T00:00:00Z';
  assert.equal(readShare(`#t=${date}&lat=&lon=&tz=UTC`,DEFAULT_PREFS)?.prefs.place,null);
  assert.deepEqual(readShare(`#t=${date}&bodies=sun,sun,unknown`,DEFAULT_PREFS)?.prefs.bodies,['sun']);
  assert.equal(readShare('#t='+date+'&x='+'a'.repeat(5000),DEFAULT_PREFS),null);
});
test('engine rejects invalid requests before allocating WASM memory',()=>{
  const module={} as SweModule;
  for(const instant of [NaN,Infinity,MIN_TIME-1,MAX_TIME+1,1.1])assert.throws(()=>calculateChart(module,instant,null,'P'),/moment/);
  assert.throws(()=>calculateChart(module,birth.instant,{...place,latitude:90},'P'),/coordinates/);
});
test('image metadata identifies natal birthplace, omits unavailable houses and escapes names',()=>{
  const chart:Chart={instant:birth.instant,positions:[{id:'sun',longitude:10,speed:1}],cusps:Array.from({length:12},(_,i)=>i*30),ascendant:0,mc:270,houseError:null};
  const view={result:{id:1,sky:{...chart,cusps:null},natal:chart},prefs:DEFAULT_PREFS,focus:null,mobile:false,colors:LIGHT_COLORS};
  const named={...birth,name:'<script>alert(1)</script>',place:{...place,name:'Birth & home'}};
  const svg=exportSvg(view,'UTC','Transit city',named,'data:font/woff2;base64,','data:font/woff2;base64,');
  assert.match(svg,/Natal houses: Birth &amp; home/);assert.ok(!svg.includes('Transit city'));assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes(`SkyTuner v${APP_VERSION} · © 2026 Mark Steven Smith, Jr.`));
  const unknown=exportSvg({...view,result:{...view.result,natal:{...chart,cusps:null,ascendant:null,mc:null}}},'UTC','', {...named,timeUnknown:true},'','');
  assert.match(unknown,/noon estimate/);assert.match(unknown,/No houses/);
});
test('release preparation defaults to patch and synchronizes the lockfile',async()=>{
  const {advanceVersion}=await import(new URL('../scripts/release.mjs',import.meta.url).href);
  const root=await mkdtemp(path.join(tmpdir(),'skytuner-release-'));
  try{
    await writeFile(path.join(root,'package.json'),JSON.stringify({version:'1.2.9'}));
    await writeFile(path.join(root,'package-lock.json'),JSON.stringify({version:'1.2.9',packages:{'':{version:'1.2.9'}}}));
    assert.equal(await advanceVersion(root),'1.2.10');
    assert.equal(await advanceVersion(root,'minor'),'1.3.0');
    assert.equal(await advanceVersion(root,'major'),'2.0.0');
    await assert.rejects(()=>advanceVersion(root,'invalid'),/Choose/);
    const metadata=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')),lock=JSON.parse(await readFile(path.join(root,'package-lock.json'),'utf8'));
    assert.equal(metadata.version,'2.0.0');assert.equal(lock.version,metadata.version);assert.equal(lock.packages[''].version,metadata.version);
  }finally{await rm(root,{recursive:true,force:true});}
});
