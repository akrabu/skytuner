export type HouseSystem = 'P' | 'W';
export type Theme = 'system' | 'light' | 'dark';
export type StepUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
export interface Place { name: string; latitude: number; longitude: number; zone: string }
export interface BirthChart { id: string; name: string; instant: number; localDateTime: string; place: Place; timeUnknown: boolean }
export interface Position { id: string; longitude: number; speed: number }
export interface Chart { instant: number; positions: Position[]; cusps: number[] | null; ascendant: number | null; mc: number | null; houseError: string | null }
export interface ChartRequest { id: number; instant: number; place: Place | null; houseSystem: HouseSystem; natal: BirthChart | null }
export interface ChartResult { id: number; sky: Chart; natal: Chart | null }
export interface Prefs { theme: Theme; houseSystem: HouseSystem; aspects: boolean; bodies: string[]; skyOrb: number; natalOrb: number; step: StepUnit; speed: number; timeZone: string; place: Place | null }
export const BODIES = [
  {id:'sun',name:'Sun',glyph:'☉',swe:0}, {id:'moon',name:'Moon',glyph:'☽',swe:1},
  {id:'mercury',name:'Mercury',glyph:'☿',swe:2}, {id:'venus',name:'Venus',glyph:'♀',swe:3},
  {id:'mars',name:'Mars',glyph:'♂',swe:4}, {id:'jupiter',name:'Jupiter',glyph:'♃',swe:5},
  {id:'saturn',name:'Saturn',glyph:'♄',swe:6}, {id:'uranus',name:'Uranus',glyph:'♅',swe:7},
  {id:'neptune',name:'Neptune',glyph:'♆',swe:8}, {id:'pluto',name:'Pluto',glyph:'♇',swe:9},
  {id:'chiron',name:'Chiron',glyph:'⚷',swe:15}, {id:'northnode',name:'North Node',glyph:'☊',swe:11},
  {id:'southnode',name:'South Node',glyph:'☋',swe:-1},
] as const;
export const SIGNS = [
  {name:'Aries',glyph:'♈',element:0}, {name:'Taurus',glyph:'♉',element:1},
  {name:'Gemini',glyph:'♊',element:2}, {name:'Cancer',glyph:'♋',element:3},
  {name:'Leo',glyph:'♌',element:0}, {name:'Virgo',glyph:'♍',element:1},
  {name:'Libra',glyph:'♎',element:2}, {name:'Scorpio',glyph:'♏',element:3},
  {name:'Sagittarius',glyph:'♐',element:0}, {name:'Capricorn',glyph:'♑',element:1},
  {name:'Aquarius',glyph:'♒',element:2}, {name:'Pisces',glyph:'♓',element:3},
] as const;
export const DEFAULT_PREFS: Prefs = {theme:'system',houseSystem:'P',aspects:true,bodies:BODIES.map(b=>b.id),skyOrb:6,natalOrb:3,step:'day',speed:1,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',place:null};
export const STEPS: {id:StepUnit;label:string;short:string}[] = [
  {id:'minute',label:'1 minute',short:'1 min'}, {id:'hour',label:'1 hour',short:'1 hour'},
  {id:'day',label:'1 day',short:'1 day'}, {id:'week',label:'1 week',short:'1 week'},
  {id:'month',label:'1 month',short:'1 month'}, {id:'year',label:'1 year',short:'1 year'}
];
export const wrap = (x:number) => ((x % 360) + 360) % 360;
export const distance = (a:number,b:number) => Math.abs(((a-b+540)%360+360)%360-180);
export const escapeHtml = (s:string) => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function positionLabel(longitude:number) {
  const minutes = Math.round(wrap(longitude)*60) % 21600;
  const sign = SIGNS[Math.floor(minutes/1800)];
  return {sign, degree:Math.floor(minutes%1800/60),minute:minutes%60,text:`${Math.floor(minutes%1800/60)}°${String(minutes%60).padStart(2,'0')}′ ${sign.name}`};
}
export interface Aspect { a:Position; b:Position; name:string; glyph:string; angle:number; orb:number; kind:'soft'|'hard'|'conjunction'; applying:boolean; phase:'Applying'|'Separating'|'Exact'|'Stationary' }
const ASPECTS = [
  {angle:0,name:'Conjunction',glyph:'☌',kind:'conjunction'},
  {angle:60,name:'Sextile',glyph:'⚹',kind:'soft'},
  {angle:90,name:'Square',glyph:'□',kind:'hard'},
  {angle:120,name:'Trine',glyph:'△',kind:'soft'},
  {angle:180,name:'Opposition',glyph:'☍',kind:'hard'},
] as const;
export function aspectsFor(sky:Position[], natal:Position[]|null, maxOrb:number):Aspect[] {
  const found:Aspect[]=[];
  for(let i=0;i<sky.length;i++) for(let j=natal?0:i+1;j<(natal??sky).length;j++) {
    const a=sky[i], b=(natal??sky)[j];
    if(!natal && [a.id,b.id].every(id=>id.endsWith('node'))) continue;
    const separation=distance(a.longitude,b.longitude);
    const limit=(a.id==='chiron'||b.id==='chiron'||a.id.endsWith('node')||b.id.endsWith('node'))?Math.min(maxOrb,3):maxOrb;
    for(const aspect of ASPECTS) {
      const orb=Math.abs(separation-aspect.angle);
      if(orb<=limit) {
        const signed=wrap(a.longitude-b.longitude+180)-180;
        const separationSpeed=Math.sign(signed)*(a.speed-(natal?0:b.speed));
        const applying=(separation-aspect.angle)*separationSpeed<0;
        const phase=orb<1/3600?'Exact':Math.abs(separationSpeed)<1e-9?'Stationary':applying?'Applying':'Separating';
        found.push({a,b,...aspect,orb,applying,phase});
      }
    }
  }
  return found.sort((a,b)=>a.orb-b.orb);
}
// Start after the largest gap so a cluster crossing 0° remains a single cluster.
export function arrangeLabels(positions:Position[], minGap=8):Map<string,number> {
  if(!positions.length) return new Map();
  const sorted=[...positions].sort((a,b)=>a.longitude-b.longitude);
  let start=0, gap=-1;
  for(let i=0;i<sorted.length;i++) {const g=wrap(sorted[(i+1)%sorted.length].longitude-sorted[i].longitude);if(g>gap){gap=g;start=(i+1)%sorted.length;}}
  const ordered=sorted.slice(start).concat(sorted.slice(0,start));
  const raw=ordered.map(p=>p.longitude<ordered[0].longitude?p.longitude+360:p.longitude);
  const adjusted=[...raw];
  for(let n=0;n<3;n++) {
    for(let i=1;i<adjusted.length;i++) adjusted[i]=Math.max(adjusted[i],adjusted[i-1]+minGap);
    const offset=adjusted.reduce((sum,x,i)=>sum+x-raw[i],0)/adjusted.length;
    for(let i=0;i<adjusted.length;i++) adjusted[i]-=offset;
  }
  return new Map(ordered.map((p,i)=>[p.id,wrap(adjusted[i])]));
}
