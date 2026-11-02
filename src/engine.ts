import { BODIES,wrap,type Chart,type HouseSystem,type Place } from './model.ts';
import {MIN_TIME,MAX_TIME} from './range.ts';
export interface SweModule { ccall:(name:string,returnType:string|null,argTypes:string[],args:unknown[])=>number; _malloc:(size:number)=>number; _free:(ptr:number)=>void; HEAPF64:Float64Array; HEAP32:Int32Array; UTF8ToString:(ptr:number)=>string; FS:{writeFile:(path:string,data:Uint8Array)=>void} }
export function calculateChart(module:SweModule,instant:number,place:Place|null,house:HouseSystem,unknown=false):Chart {
  if(!Number.isSafeInteger(instant)||instant<MIN_TIME||instant>MAX_TIME)throw new Error('Choose a moment between 1800 and 2399 UTC.');
  if(house!=='P'&&house!=='W')throw new Error('Choose Placidus or Whole Sign houses.');
  if(place&&(!Number.isFinite(place.latitude)||Math.abs(place.latitude)>=90||!Number.isFinite(place.longitude)||Math.abs(place.longitude)>180))throw new Error('The location coordinates are outside the supported range.');
  const call=(name:string,types:string[],args:unknown[])=>module.ccall(name,'number',types,args);
  const julian=instant/86400000+2440587.5;
  // Convert UTC to UT1 with Swiss Ephemeris' leap-second and Delta-T handling.
  const utcPtr=module._malloc(16),errPtr=module._malloc(256),d=new Date(instant);
  let jd=julian;
  try {
    const result=call('swe_utc_to_jd',Array(9).fill('number'),[d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()+d.getUTCMilliseconds()/1000,1,utcPtr,errPtr]);
    if(result<0) throw new Error(module.UTF8ToString(errPtr)||'The date could not be calculated.');
    jd=module.HEAPF64[utcPtr/8+1];
  }finally{module._free(utcPtr);module._free(errPtr);}
  const positions=[];
  for(const body of BODIES.filter(b=>b.swe>=0)) {
    const ptr=module._malloc(48),error=module._malloc(256);
    try {
      const flags=call('swe_calc_ut',['number','number','number','number','number'],[jd,body.swe,2|256,ptr,error]);
      if(flags<0) throw new Error(`${body.name}: ${module.UTF8ToString(error)||'calculation failed'}`);
      if((flags&2)!==2) throw new Error('The full planetary data did not load. Please reload the sky.');
      const longitude=wrap(module.HEAPF64[ptr/8]),speed=module.HEAPF64[ptr/8+3];
      if(!Number.isFinite(longitude)||!Number.isFinite(speed)) throw new Error('The calculation returned an invalid position.');
      positions.push({id:body.id,longitude,speed});
    }finally{module._free(ptr);module._free(error);}
  }
  const north=positions.find(p=>p.id==='northnode')!;
  positions.push({id:'southnode',longitude:wrap(north.longitude+180),speed:north.speed});
  let cusps:number[]|null=null,ascendant:number|null=null,mc:number|null=null,houseError:string|null=null;
  if(place&&!unknown) {
    const cuspPtr=module._malloc(13*8),anglesPtr=module._malloc(10*8);
    try {
      const status=call('swe_houses_ex',Array(7).fill('number'),[jd,0,place.latitude,place.longitude,house.charCodeAt(0),cuspPtr,anglesPtr]);
      ascendant=wrap(module.HEAPF64[anglesPtr/8]);mc=wrap(module.HEAPF64[anglesPtr/8+1]);
      if(status<0) houseError='Placidus houses are unavailable for this location and moment.';
      else cusps=Array.from(module.HEAPF64.slice(cuspPtr/8+1,cuspPtr/8+13));
      if(!Number.isFinite(ascendant)||!Number.isFinite(mc)||cusps?.some(c=>!Number.isFinite(c))){cusps=null;ascendant=null;mc=null;houseError='Houses and angles are unavailable for this location and moment.';}
    }finally{module._free(cuspPtr);module._free(anglesPtr);}
  }
  return {instant,positions,cusps,ascendant,mc,houseError};
}
