import { BODIES,DEFAULT_PREFS,STEPS,type BirthChart,type Place,type Prefs } from './model.ts';
import { MIN_TIME,MAX_TIME,validZone,validLocalDateTime } from './time.ts';
const PREF_KEY='skytuner.preferences.v1', CHART_KEY='skytuner.birth-charts.v1';
const BODY_IDS=new Set<string>(BODIES.map(b=>b.id));
export let storageAvailable=true;
export const storageWarnings:string[]=[];
function record(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
function read(key:string):string|null {try{return localStorage.getItem(key);}catch{storageAvailable=false;return null;}}
function bodies(value:unknown,fallback:string[]) {return Array.isArray(value)?[...new Set(value.filter((id):id is string=>typeof id==='string'&&BODY_IDS.has(id)))]:[...fallback];}
export function readPrefs():Prefs {
  let raw:Record<string,unknown>={};
  const text=read(PREF_KEY);
  if(text!==null)try{const parsed=JSON.parse(text);if(!record(parsed))throw new Error();raw=parsed;}catch{storageWarnings.push('Saved display settings could not be read. Default settings are in use.');}
  return {...DEFAULT_PREFS,
    theme:raw.theme==='light'||raw.theme==='dark'?raw.theme:'system',
    houseSystem:raw.houseSystem==='W'?'W':'P',aspects:raw.aspects!==false,
    bodies:bodies(raw.bodies,DEFAULT_PREFS.bodies),
    skyOrb:typeof raw.skyOrb==='number'&&Number.isFinite(raw.skyOrb)?Math.max(1,Math.min(10,raw.skyOrb)):6,
    natalOrb:typeof raw.natalOrb==='number'&&Number.isFinite(raw.natalOrb)?Math.max(1,Math.min(10,raw.natalOrb)):3,
    step:STEPS.some(s=>s.id===raw.step)?raw.step as Prefs['step']:'day',speed:[0.25,1,4].includes(Number(raw.speed))?Number(raw.speed):1,
    timeZone:typeof raw.timeZone==='string'&&validZone(raw.timeZone)?raw.timeZone:isPlace(raw.place)?raw.place.zone:DEFAULT_PREFS.timeZone,
    place:isPlace(raw.place)?cleanPlace(raw.place):null};
}
export function isPlace(value:unknown):value is Place {
  return record(value)&&typeof value.name==='string'&&value.name.trim().length>0&&value.name.length<=160&&typeof value.latitude==='number'&&Number.isFinite(value.latitude)&&Math.abs(value.latitude)<90&&typeof value.longitude==='number'&&Number.isFinite(value.longitude)&&Math.abs(value.longitude)<=180&&typeof value.zone==='string'&&validZone(value.zone);
}
function cleanPlace(p:Place):Place{return {name:p.name,latitude:p.latitude,longitude:p.longitude,zone:p.zone};}
export function isBirthChart(value:unknown):value is BirthChart {
  return record(value)&&typeof value.id==='string'&&value.id.length>0&&value.id.length<=128&&typeof value.name==='string'&&value.name.trim().length>0&&value.name.length<=100&&typeof value.instant==='number'&&Number.isSafeInteger(value.instant)&&value.instant>=MIN_TIME&&value.instant<=MAX_TIME&&isPlace(value.place)&&validLocalDateTime(value.localDateTime)&&typeof value.timeUnknown==='boolean';
}
function cleanChart(c:BirthChart,id=c.id):BirthChart{return {id,name:c.name,instant:c.instant,localDateTime:c.localDateTime,place:cleanPlace(c.place),timeUnknown:c.timeUnknown};}
export function readCharts():BirthChart[] {
  const text=read(CHART_KEY);if(text===null)return [];
  try{
    const raw=JSON.parse(text);if(!Array.isArray(raw))throw new Error();
    const seen=new Set<string>(),charts:BirthChart[]=[];
    for(const c of raw)if(isBirthChart(c)&&!seen.has(c.id)){seen.add(c.id);charts.push(cleanChart(c));}
    if(charts.length!==raw.length)storageWarnings.push('Some saved birth charts could not be read. Import a backup to recover them.');
    return charts;
  }catch{storageWarnings.push('Saved birth charts could not be read. Import a backup to recover them.');return [];}
}
export function savePrefs(prefs:Prefs) {return save(PREF_KEY,prefs);}
export function saveCharts(charts:BirthChart[]) {return save(CHART_KEY,charts);}
function save(key:string,value:unknown) {try{localStorage.setItem(key,JSON.stringify(value));storageAvailable=true;return true;}catch{storageAvailable=false;return false;}}
export function parseBackup(text:string):BirthChart[] {
  let raw:unknown;try{raw=JSON.parse(text);}catch{throw new Error('This file is not a valid SkyTuner birth-chart backup.');}
  if(!record(raw)||raw.version!==1||!Array.isArray(raw.charts)||raw.charts.length>500||!raw.charts.every(isBirthChart))throw new Error('This file is not a valid SkyTuner birth-chart backup.');
  return raw.charts.map((c:BirthChart)=>cleanChart(c,crypto.randomUUID()));
}
export function shareLink(origin:string,instant:number,prefs:Prefs):string {
  const params=new URLSearchParams({t:new Date(Math.round(instant)).toISOString(),house:prefs.houseSystem,aspects:prefs.aspects?'1':'0',bodies:prefs.bodies.join(','),orb:String(prefs.skyOrb),tz:prefs.timeZone});
  if(prefs.place) {params.set('place',prefs.place.name);params.set('lat',String(prefs.place.latitude));params.set('lon',String(prefs.place.longitude));}
  return `${origin.split('#')[0].split('?')[0]}#${params}`;
}
export function readShare(hash:string,prefs:Prefs):{instant:number; prefs:Prefs}|null {
  if(hash.length>4096)return null;
  const params=new URLSearchParams(hash.replace(/^#/,''));
  if(!params.has('t')) return null;
  const instant=Date.parse(params.get('t')!);
  if(!Number.isFinite(instant)||instant<MIN_TIME||instant>MAX_TIME)return null;
  const zone=params.get('tz')??'UTC',timeZone=validZone(zone)?zone:'UTC';
  const place={name:params.get('place')??'Shared location',latitude:Number(params.get('lat')),longitude:Number(params.get('lon')),zone:timeZone};
  const coordinatesPresent=!!params.get('lat')?.trim()&&!!params.get('lon')?.trim();
  const sharedBodies=params.get('bodies'),orb=Number(params.get('orb'));
  return {instant,prefs:{...prefs,timeZone,place:coordinatesPresent&&isPlace(place)?place:null,houseSystem:params.get('house')==='W'?'W':'P',aspects:params.get('aspects')!=='0',bodies:sharedBodies!==null?bodies(sharedBodies.split(','),prefs.bodies):[...prefs.bodies],skyOrb:orb>=1&&orb<=10?orb:6}};
}
