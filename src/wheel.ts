import { BODIES,SIGNS,arrangeLabels,aspectsFor,escapeHtml,positionLabel,wrap,type ChartResult,type Position,type Prefs,type Aspect } from './model.ts';
export interface WheelColors {ink:string;muted:string;line:string;softLine:string;background:string;band:string;accent:string;natal:string;hard:string;soft:string;elements:string[]}
export const LIGHT_COLORS:WheelColors={ink:'#293e39',muted:'#687366',line:'#bfc6b9',softLine:'#dde1d6',background:'#f6f5f0',band:'#eeeee5',accent:'#216b59',natal:'#8d7084',hard:'#c77a65',soft:'#689ca4',elements:['#b76c55','#6e8f69','#b29b56','#678d9e']};
export const DARK_COLORS:WheelColors={ink:'#e1e7dc',muted:'#8e9b91',line:'#536259',softLine:'#313f38',background:'#15231e',band:'#1c2c24',accent:'#a1cdb3',natal:'#c1a6bb',hard:'#db9a85',soft:'#82b8c1',elements:['#d69b83','#a1b992','#cfbc80','#8cbbc9']};
export interface WheelView {result:ChartResult;prefs:Prefs;focus:string|null;mobile:boolean;colors:WheelColors}
const num=(n:number)=>n.toFixed(2);
export function wheelMarkup(view:WheelView):string {
  const {result,prefs,focus,mobile,colors:c}=view;
  const main=result.natal??result.sky;
  const base=main.ascendant??0;
  const polar=(longitude:number,r:number)=>{const a=(longitude-base)*Math.PI/180;return {x:500-r*Math.cos(a),y:500+r*Math.sin(a)};};
  const line=(a:number,r1:number,r2:number,stroke:string,width=1)=>{const p=polar(a,r1),q=polar(a,r2);return `<line x1="${num(p.x)}" y1="${num(p.y)}" x2="${num(q.x)}" y2="${num(q.y)}" stroke="${stroke}" stroke-width="${width}"/>`;};
  const visible=(p:Position)=>prefs.bodies.includes(p.id);
  const sky=result.sky.positions.filter(visible),natal=result.natal?.positions.filter(visible)??null;
  const aspects=prefs.aspects?aspectsFor(sky,natal,natal?prefs.natalOrb:prefs.skyOrb):[];
  const related=new Set<string>(focus?[focus]:[]);
  const keyA=(a:Aspect)=>`sky:${a.a.id}`,keyB=(a:Aspect)=>`${natal?'natal':'sky'}:${a.b.id}`;
  if(focus) for(const a of aspects) if(keyA(a)===focus||keyB(a)===focus){related.add(keyA(a));related.add(keyB(a));}
  let s=`<svg xmlns="http://www.w3.org/2000/svg" class="sky-wheel" viewBox="${natal?'0 0 1000 1000':'55 55 890 890'}" role="group" aria-label="${result.natal?'Natal chart with transits':'Planetary transit wheel'}" style="color:${c.ink};font-family:'DM Sans',sans-serif">`;
  s+=`<circle cx="500" cy="500" r="423" fill="${c.band}"/><circle cx="500" cy="500" r="367" fill="${c.background}"/><circle cx="500" cy="500" r="423" fill="none" stroke="${c.line}" stroke-width="1.2"/><circle cx="500" cy="500" r="367" fill="none" stroke="${c.line}" stroke-width="1.2"/>`;
  for(let degree=0;degree<360;degree++) s+=line(degree,367,degree%30===0?381:degree%10===0?379:degree%5===0?375:371,c.line,degree%10===0?1.3:.7);
  for(let i=0;i<12;i++) {
    const sign=SIGNS[i],p=polar(i*30+15,398);
    s+=line(i*30,380,423,c.line);
    s+=`<text x="${num(p.x)}" y="${num(p.y)}" text-anchor="middle" dominant-baseline="central" font-family="'Sky Symbols',sans-serif" font-size="${mobile?40:33}" fill="${c.elements[sign.element]}" aria-label="${sign.name}">${sign.glyph}︎</text>`;
  }
  if(main.cusps) for(let i=0;i<12;i++) {
    const long=main.cusps[i],next=main.cusps[(i+1)%12];
    s+=line(long,55,360,c.softLine,i%3===0?1.3:.8);
    const p=polar(long+wrap(next-long)/2,natal?245:258);
    s+=`<text x="${num(p.x)}" y="${num(p.y)}" font-size="${mobile?17:14}" text-anchor="middle" dominant-baseline="central" fill="${c.muted}">${i+1}</text>`;
  }
  s+=`<circle cx="500" cy="500" r="255" fill="none" stroke="${c.softLine}" stroke-width=".7"/>`;
  for(const aspect of aspects) {
    const emphasized=!focus||keyA(aspect)===focus||keyB(aspect)===focus;
    const a=polar(aspect.a.longitude,natal?283:265),b=polar(aspect.b.longitude,265);
    const color=aspect.kind==='soft'?c.soft:aspect.kind==='hard'?c.hard:c.accent;
    s+=`<line x1="${num(a.x)}" y1="${num(a.y)}" x2="${num(b.x)}" y2="${num(b.y)}" stroke="${color}" stroke-width="${focus&&emphasized?2:1.2}" opacity="${emphasized?(focus?.85:.53):.07}" ${aspect.angle===60?'stroke-dasharray="4 4"':aspect.angle===0?'stroke-dasharray="2 3"':''}/>`;
  }
  s+=`<circle cx="500" cy="500" r="4" fill="${c.line}"/><path d="M490 500h20m-10-10v20" stroke="${c.line}" stroke-width="1"/>`;
  if(main.ascendant!==null) {
    for(const [label,long] of [['ASC',main.ascendant],['MC',main.mc]] as [string,number|null][]) if(long!==null) {
      const p=polar(long,347);
      s+=line(long,355,432,c.ink,1.6);
      s+=`<text x="${num(p.x)}" y="${num(p.y)}" font-size="${mobile?17:13}" font-weight="600" text-anchor="middle" dominant-baseline="central" fill="${c.muted}">${label}</text>`;
    }
  }
  function drawBodies(bodies:Position[],layer:'sky'|'natal',r:number) {
    const placements=arrangeLabels(bodies,mobile?10:8);
    for(const p of bodies) {
      const body=BODIES.find(b=>b.id===p.id)!;
      const key=`${layer}:${p.id}`,active=focus===key,emphasized=!focus||related.has(key);
      const point=polar(placements.get(p.id)!,r),edge=polar(p.longitude,layer==='sky'&&natal?428:361);
      const end=polar(placements.get(p.id)!,layer==='sky'&&natal?r-23:r+25);
      const label=positionLabel(p.longitude),col=layer==='natal'?c.natal:natal?c.accent:c.ink;
      s+=`<g class="planet${active?' is-selected':''}" data-planet="${key}" role="button" tabindex="0" aria-label="${escapeHtml(`${layer==='natal'?'Natal ':''}${body.name}, ${label.text}${p.speed<0?', retrograde':''}`)}" opacity="${emphasized?1:.23}">`;
      s+=`<path d="M${num(edge.x)} ${num(edge.y)} L${num(end.x)} ${num(end.y)}" fill="none" stroke="${active?c.accent:c.line}" stroke-width="${active?1.7:.9}"/><circle cx="${num(edge.x)}" cy="${num(edge.y)}" r="2.6" fill="${col}"/>`;
      s+=`<circle class="planet-hit" cx="${num(point.x)}" cy="${num(point.y)}" r="${mobile?31:25}" fill="${active?c.band:'transparent'}" stroke="${active?c.accent:'none'}" stroke-width="1"/>`;
      s+=`<text class="body-symbol" x="${num(point.x)}" y="${num(point.y-2)}" font-family="'Sky Symbols',sans-serif" font-size="${mobile?(natal?34:43):(natal?28:33)}" fill="${col}" text-anchor="middle" dominant-baseline="central" pointer-events="none">${body.glyph}︎</text>`;
      if(!mobile) s+=`<text x="${num(point.x)}" y="${num(point.y+26)}" font-size="12" fill="${c.muted}" text-anchor="middle" pointer-events="none">${label.degree}°${String(label.minute).padStart(2,'0')}′</text>`;
      if(p.speed<0) s+=`<text x="${num(point.x+(mobile?22:19))}" y="${num(point.y-14)}" font-size="${mobile?15:11}" fill="${col}" pointer-events="none">℞</text>`;
      s+='</g>';
    }
  }
  if(natal){drawBodies(natal,'natal',309);drawBodies(sky,'sky',464);}else drawBodies(sky,'sky',311);
  s+='</svg>';
  return s;
}
