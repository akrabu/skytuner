import { Temporal } from '@js-temporal/polyfill';
import type { StepUnit } from './model.ts';
import {MIN_TIME,MAX_TIME} from './range.ts';
export {MIN_TIME,MAX_TIME} from './range.ts';
export const clampTime=(ms:number)=>Math.max(MIN_TIME,Math.min(MAX_TIME,ms));
export function validZone(zone:string) {try{Temporal.Now.zonedDateTimeISO(zone);return true;}catch{return false;}}
export function zoned(ms:number,zone:string) {return Temporal.Instant.fromEpochMilliseconds(Math.round(ms)).toZonedDateTimeISO(zone);}
export function localInput(ms:number,zone:string) {return zoned(ms,zone).toPlainDateTime().toString({smallestUnit:'second'});}
export function validLocalDateTime(value:unknown):value is string {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value))return false;
  try{const d=Temporal.PlainDateTime.from(value);return d.year>=1799&&d.year<=2400;}catch{return false;}
}
export class AmbiguousTime extends Error {
  earlier:string;
  later:string;
  constructor(earlier:string,later:string) {super('This clock time happens twice. Choose which occurrence you mean.');this.earlier=earlier;this.later=later;}
}
export function resolveLocal(input:string,zone:string,occurrence:'reject'|'earlier'|'later'='reject') {
  if(!validZone(zone)) throw new Error('Enter an IANA time zone (such as America/New_York) or a UTC offset (such as -05:00).');
  const plain=Temporal.PlainDateTime.from(input);
  const earlier=plain.toZonedDateTime(zone,{disambiguation:'earlier'});
  const later=plain.toZonedDateTime(zone,{disambiguation:'later'});
  if(!earlier.toPlainDateTime().equals(plain)||!later.toPlainDateTime().equals(plain)) throw new Error('This clock time did not exist because the clocks moved forward. Choose a time before or after the change.');
  if(earlier.epochMilliseconds!==later.epochMilliseconds && occurrence==='reject') throw new AmbiguousTime(earlier.offset,later.offset);
  const result=occurrence==='later'?later:earlier;
  if(result.epochMilliseconds<MIN_TIME||result.epochMilliseconds>MAX_TIME) throw new Error('Choose a moment between 1800 and 2399.');
  return result.epochMilliseconds;
}
export function stepTime(ms:number,unit:StepUnit,count:number,zone:string) {
  if(unit==='minute'||unit==='hour') return clampTime(ms+count*(unit==='minute'?60000:3600000));
  const duration=unit==='day'?{days:count}:unit==='week'?{weeks:count}:unit==='month'?{months:count}:{years:count};
  return clampTime(zoned(ms,zone).add(duration).epochMilliseconds);
}
// Preserve a recorded instant when only its chart name or display options change.
export function resolveEditedLocal(input:string,zone:string,originalInstant:number,originalZone:string,occurrence:'reject'|'earlier'|'later'='reject') {
  const unchanged=zone===originalZone&&Temporal.PlainDateTime.from(input).equals(Temporal.PlainDateTime.from(localInput(originalInstant,zone)));
  if(unchanged&&occurrence==='reject')return originalInstant;
  const resolved=resolveLocal(input,zone,occurrence);
  return unchanged&&Math.floor(resolved/1000)===Math.floor(originalInstant/1000)?originalInstant:resolved;
}
export function playbackTime(anchor:number,elapsedSeconds:number,speed:number,direction:1|-1,unit:StepUnit,zone:string) {
  const progress=Math.max(0,elapsedSeconds)*speed;
  const whole=Math.floor(progress), fraction=progress-whole;
  const a=stepTime(anchor,unit,whole*direction,zone), b=stepTime(anchor,unit,(whole+1)*direction,zone);
  return clampTime(a+(b-a)*fraction);
}
export function momentParts(ms:number,zone:string) {
  const date=new Date(ms);
  const offsetZone=/^[+-]/.test(zone);
  if(offsetZone) {
    const z=zoned(ms,zone);
    return {date:`${z.toPlainDate().toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric'})}`,time:`${String(z.hour).padStart(2,'0')}:${String(z.minute).padStart(2,'0')}:${String(z.second).padStart(2,'0')}`,zone:`UTC${zone}`};
  }
  return {date:new Intl.DateTimeFormat('en-US',{timeZone:zone,month:'short',day:'numeric',year:'numeric'}).format(date),time:new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date),zone:new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'short'}).formatToParts(date).find(p=>p.type==='timeZoneName')?.value??zone};
}
export function tickLabel(ms:number,unit:StepUnit,zone:string) {
  const z=zoned(ms,zone);
  if(unit==='minute'||unit==='hour') return `${String(z.hour).padStart(2,'0')}:${String(z.minute).padStart(2,'0')}`;
  if(unit==='year') return String(z.year);
  if(unit==='month') return z.toPlainDate().toLocaleString('en-US',{month:'short',year:'numeric'});
  return z.toPlainDate().toLocaleString('en-US',{month:'short',day:'numeric'});
}
