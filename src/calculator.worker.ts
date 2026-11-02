import { calculateChart,type SweModule } from './engine.ts';
import type { Chart,ChartRequest } from './model.ts';
let modulePromise:Promise<SweModule>|null=null;
let natalCache:{key:string;chart:Chart}|null=null;
const loadedBlocks=new Set<string>();
async function initialize() {
  const base=new URL('/vendor/swisseph/',self.location.origin).href;
  const factory=(await import(/* @vite-ignore */ `${base}swisseph.js`)).default;
  const module=await factory({locateFile:(path:string)=>`${base}${path}`}) as SweModule;
  module.ccall('swe_set_ephe_path',null,['string'],['/sweph']);
  loadedBlocks.clear();natalCache=null;
  return module;
}
async function ensureBoundaryData(module:SweModule,instant:number) {
  const year=new Date(instant).getUTCFullYear(),block=year<=1800?'12':year>=2399?'24':null;
  if(!block||loadedBlocks.has(block))return;
  await Promise.all(['sepl','semo','seas'].map(async kind=>{
    const name=`${kind}_${block}.se1`,response=await fetch(`/vendor/swisseph/${name}`);
    if(!response.ok)throw new Error('Additional data for this boundary date could not be loaded. Please try again.');
    module.FS.writeFile(`/sweph/${name}`,new Uint8Array(await response.arrayBuffer()));
  }));
  loadedBlocks.add(block);
}
self.onmessage=async(event:MessageEvent<ChartRequest>)=>{
  const request=event.data;
  try {
    modulePromise??=initialize();
    const module=await modulePromise;
    await ensureBoundaryData(module,request.instant);
    if(request.natal)await ensureBoundaryData(module,request.natal.instant);
    const sky=calculateChart(module,request.instant,request.place,request.houseSystem);
    let natal:Chart|null=null;
    if(request.natal) {
      const key=JSON.stringify([request.natal,request.houseSystem]);
      if(natalCache?.key!==key) natalCache={key,chart:calculateChart(module,request.natal.instant,request.natal.place,request.houseSystem,request.natal.timeUnknown)};
      natal=natalCache!.chart;
    }
    self.postMessage({type:'chart',id:request.id,sky,natal});
  }catch(error){modulePromise=null;self.postMessage({type:'error',id:request.id,message:error instanceof Error?error.message:'The sky could not be loaded.'});}
};
