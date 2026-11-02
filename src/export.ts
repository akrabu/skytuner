import { escapeHtml,type BirthChart } from './model.ts';
import { wheelMarkup,type WheelView } from './wheel.ts';
import { momentParts } from './time.ts';
import { APP_VERSION,AUTHOR_NAME,COPYRIGHT_YEAR } from './version.ts';
function download(blob:Blob,name:string) {const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export function downloadText(text:string,name:string,type='application/json') {download(new Blob([text],{type}),name);}
async function fontData(path:string) {
  const response=await fetch(path);if(!response.ok) throw new Error('The export font could not be loaded. Try again.');
  const blob=await response.blob();return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});
}
export function exportSvg(view:WheelView,zone:string,place:string,natal:BirthChart|null,symbolFont:string,textFont:string) {
  const time=momentParts(view.result.sky.instant,zone),c=view.colors;
  const inner=wheelMarkup({...view,mobile:false,focus:null}).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
  const main=view.result.natal??view.result.sky;
  const location=main.cusps?(view.result.natal&&natal?`Natal houses: ${natal.place.name}`:place):`${natal?.timeUnknown?'Noon estimate · ':''}Zodiac wheel · houses unavailable`;
  const name=natal?.name.length&&natal.name.length>45?natal.name.slice(0,42)+'…':natal?.name;
  const caption=natal?`Natal chart${natal.timeUnknown?' (noon estimate)':''}: ${name} · Transits outside`:'Yesterday’s transits. Tomorrow’s hits.';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="2142" viewBox="0 0 1000 1190" style="font-family:'DM Sans',sans-serif"><style>@font-face{font-family:'Sky Symbols';src:url('${symbolFont}')}@font-face{font-family:'DM Sans';src:url('${textFont}')}</style><rect width="1000" height="1190" fill="${c.background}"/><text x="64" y="62" fill="${c.ink}" font-size="27" font-weight="600">SkyTuner</text><text x="64" y="93" fill="${c.muted}" font-size="14">${escapeHtml(`${time.date} · ${time.time} ${time.zone}`)}</text><text x="64" y="120" fill="${c.muted}" font-size="12">${escapeHtml((location||'Zodiac wheel · no houses').slice(0,110))}</text><g transform="translate(0 140)">${inner}</g><text x="64" y="1142" fill="${c.muted}" font-size="12">${escapeHtml(caption)}</text><text x="936" y="1165" fill="${c.muted}" font-size="11" text-anchor="end">Tropical${main.cusps?` · ${view.prefs.houseSystem==='P'?'Placidus':'Whole Sign'}`:' · No houses'}</text><text x="64" y="1165" fill="${c.muted}" font-size="11">${escapeHtml(`SkyTuner v${APP_VERSION} · © ${COPYRIGHT_YEAR} ${AUTHOR_NAME}`)}</text></svg>`;
}
export async function exportWheel(view:WheelView,zone:string,place:string,natal:BirthChart|null) {
  const [symbolFont,textFont]=await Promise.all([fontData('/fonts/sky-symbols.woff2'),fontData('/fonts/dm-sans.woff2')]);
  const svg=exportSvg(view,zone,place,natal,symbolFont,textFont);
  const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);
  try {
    const image=new Image();image.src=url;await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('The wheel image could not be created.'));});
    const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=2142;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image export is unavailable in this browser.');ctx.drawImage(image,0,0);
    const png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Image export failed.')),'image/png'));
    download(png,`SkyTuner-${new Date(view.result.sky.instant).toISOString().slice(0,10)}.png`);
  }finally{URL.revokeObjectURL(url);}
}
