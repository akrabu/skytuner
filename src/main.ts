import './style.css';
import { BODIES,STEPS,aspectsFor,escapeHtml as esc,positionLabel,type BirthChart,type ChartResult,type Place,type Position,type StepUnit } from './model.ts';
import { AmbiguousTime,MIN_TIME,MAX_TIME,clampTime,localInput,momentParts,playbackTime,resolveLocal,resolveEditedLocal,stepTime,tickLabel,validZone } from './time.ts';
import { isPlace,parseBackup,readCharts,readPrefs,readShare,saveCharts,savePrefs,shareLink,storageAvailable,storageWarnings } from './storage.ts';
import { DARK_COLORS,LIGHT_COLORS,wheelMarkup,type WheelView } from './wheel.ts';
import { brandMark,icon } from './icons.ts';
import { downloadText,exportWheel } from './export.ts';
import { APP_VERSION,AUTHOR_NAME,AUTHOR_URL,COPYRIGHT_YEAR } from './version.ts';

let prefs=readPrefs();
let charts=readCharts();
const shared=readShare(location.hash,prefs);
if(shared) prefs=shared.prefs;
let instant=shared?.instant??Date.now(),live=!shared,play:1|-1|null=null;
let playAnchor=instant,playStart=performance.now();
let activeChartId:string|null=null,focus:string|null=null,result:ChartResult|null=null;
let workerError='',context=0,resultContext=-1,busy=false,pending=false,requestId=0,inflightContext=0;
let navigationRevision=0,resultRevision=-1,inflightRevision=0;
let mobile=matchMedia('(max-width: 700px), (max-height: 500px) and (max-width: 1000px)').matches;
let scrub:{anchor:number;x:number;dx:number;pointer:number}|null=null;
let latestRequestTime=0,lastTimelineTime=0;
let toastTimer:ReturnType<typeof setTimeout>|null=null;
const colorScheme=matchMedia('(prefers-color-scheme: dark)');
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`
  <div class="app-shell">
    <header class="app-header">
      <a class="brand" href="/" aria-label="SkyTuner home">${brandMark}<span class="brand-copy"><span class="brand-name">SkyTuner<span class="brand-dot">.</span></span><span class="tagline">Yesterday’s transits. Tomorrow’s hits.</span></span></a>
      <div class="header-right"><span class="header-note">A DIFFERENT KIND OF TIME TRAVEL</span><nav aria-label="Chart tools"><button class="tool-button" data-action="charts" title="Birth charts">${icon('chart')}<span>Birth charts</span></button><button class="tool-button" data-action="share" title="Share and save image">${icon('share')}<span>Share</span></button><button class="icon-button" data-action="settings" title="Settings" aria-label="Settings">${icon('settings')}</button></nav></div>
    </header>
    <section class="moment-toolbar" aria-label="Selected moment">
      <div class="moment-main"><button id="now-button" class="live-pill" data-action="now" title="Return to the current moment"><span class="live-dot"></span><span id="now-label">LIVE NOW</span></button><button id="moment-button" class="moment-button" data-action="moment" aria-label="Change date and time"><span id="date-label"></span><span class="moment-divider"></span><span id="time-label"></span><span id="zone-label" class="zone-label"></span>${icon('chevron')}</button></div>
      <div class="place-line"><button class="location-button" data-action="location">${icon('pin')}<span id="location-label">Set location for houses</span>${icon('chevron')}</button><span class="config-divider">/</span><span id="configuration-label">Tropical · Placidus</span></div>
    </section>
    <main class="main-zone">
      <div class="wheel-stage" id="wheel-stage"><div class="sky-loading"><div class="loading-orbit">${brandMark}</div><p>Finding your place in time<span class="loading-dots">…</span></p><small>Loading the planetary ephemeris</small></div></div>
      <aside id="planet-detail" class="detail-card" aria-label="Selected planet" hidden></aside>
      <div id="house-message" class="house-message" hidden></div>
    </main>
    <section class="time-desk" aria-label="Time controls">
      <div class="wheel-caption"><span id="wheel-mode">THE SKY, RIGHT NOW</span><button class="text-button" data-action="positions">Positions ${icon('arrow')}</button></div>
      <div id="timeline" class="timeline" role="slider" tabindex="0" aria-label="Scrub through time" aria-valuemin="${MIN_TIME}" aria-valuemax="${MAX_TIME}" title="Drag right for later, left for earlier; use arrow keys for one step"><svg id="timeline-scale" viewBox="0 0 900 64" preserveAspectRatio="none" aria-hidden="true"></svg><span id="tuning-needle" class="tuning-needle"></span><span class="timeline-fade left"></span><span class="timeline-fade right"></span></div>
      <div class="transport-row"><label class="select-control step-control"><span class="sr-only">Time step</span><select id="step-select">${STEPS.map(s=>`<option value="${s.id}">${s.label}</option>`).join('')}</select>${icon('chevron')}</label><div class="playback-controls"><button class="transport-button" data-action="step-back" aria-label="Step backward" title="Step backward (←)">${icon('left')}</button><button id="reverse-button" class="transport-button play-button" data-action="reverse" aria-label="Play backward" title="Play backward">${icon('reverse')}</button><button id="forward-button" class="transport-button play-button forward" data-action="forward" aria-label="Play forward" title="Play forward (Space)">${icon('play')}</button><button class="transport-button" data-action="step-forward" aria-label="Step forward" title="Step forward (→)">${icon('right')}</button></div><label class="select-control speed-control"><span class="sr-only">Playback speed</span><select id="speed-select"><option value="0.25">0.25×</option><option value="1">1×</option><option value="4">4×</option></select>${icon('chevron')}</label></div>
      <div class="transport-hint"><span>DRAG TO TUNE THROUGH TIME</span><span id="playback-hint">One day per second at 1×</span></div>
    </section>
    <footer class="app-footer"><span class="copyright">SkyTuner v${APP_VERSION} · © ${COPYRIGHT_YEAR} <a href="${AUTHOR_URL}" target="_blank" rel="noopener noreferrer">${AUTHOR_NAME}</a></span><span class="footer-right"><span class="tiny-dot"></span> SWISS EPHEMERIS INSIDE <span class="footer-separator">·</span><button class="text-button" data-action="about">About</button><span class="footer-separator">·</span><button class="text-button" data-action="help">Keyboard shortcuts</button></span></footer>
  </div>
  <dialog id="panel" class="panel"><div id="panel-inner"></div></dialog>
  <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
  <input id="backup-file" type="file" accept="application/json,.json" hidden />`;
const $=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
const dialog=$<HTMLDialogElement>('#panel');
let worker:Worker|null=null,workerDead=false;
let workerTimer:ReturnType<typeof setTimeout>|null=null;
function activeChart(){return charts.find(c=>c.id===activeChartId)??null;}
function dark(){return prefs.theme==='dark'||(prefs.theme==='system'&&colorScheme.matches);}
function view():WheelView|null{return result?{result,prefs,focus,mobile,colors:dark()?DARK_COLORS:LIGHT_COLORS}:null;}
function persist(){if(!savePrefs(prefs)) storageNotice();}
function persistCharts(){const saved=saveCharts(charts);if(!saved)storageNotice();return saved;}
function storageNotice(){toast('Browser storage is unavailable. Changes will last for this visit; use a chart backup to keep them.');}
function applyTheme(){document.documentElement.dataset.theme=dark()?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark()?'#15231e':'#f6f5f0');}
function toast(message:string,action?:{label:string;run:()=>void}) {
  if(toastTimer) clearTimeout(toastTimer);
  const target=$('#toast');target.hidden=false;target.innerHTML=`<span>${esc(message)}</span>${action?`<button>${esc(action.label)}</button>`:''}`;
  if(action) target.querySelector('button')!.onclick=()=>{target.hidden=true;action.run();};
  toastTimer=setTimeout(()=>target.hidden=true,action?12000:5000);
}
function pause(){live=false;play=null;}
function setMoment(ms:number){pause();navigationRevision++;instant=clampTime(ms);requestChart();renderTransport();renderTimeline();}
function requestChart(){pending=true;if(!busy)dispatch();}
function failWorker(message:string){
  if(workerTimer)clearTimeout(workerTimer);workerTimer=null;
  worker?.terminate();worker=null;workerDead=true;busy=false;pending=false;
  pause();workerError=message;renderWheel();renderTransport();
}
function dispatch(){
  if(!pending||workerDead)return;
  try{
    if(!worker){worker=new Worker(new URL('./calculator.worker.ts',import.meta.url),{type:'module'});wireWorker(worker);}
    pending=false;busy=true;inflightContext=context;inflightRevision=navigationRevision;
    worker.postMessage({id:++requestId,instant:Math.round(instant),place:prefs.place,houseSystem:prefs.houseSystem,natal:activeChart()});
    workerTimer=setTimeout(()=>failWorker('The calculation engine took too long to respond. Check your connection and reload the sky.'),45000);
  }catch{failWorker('The calculation engine could not start. Please reload the sky.');}
}
function wireWorker(instance:Worker){instance.onmessage=(event)=>{
  if(instance!==worker||event.data.id!==requestId)return;
  if(workerTimer)clearTimeout(workerTimer);workerTimer=null;busy=false;
  if(event.data.type==='error'&&(inflightContext!==context||inflightRevision!==navigationRevision)){if(pending)dispatch();return;}
  if(event.data.type==='error'){
    workerError=event.data.message;pause();pending=false;renderWheel();renderTransport();return;
  }
  if(inflightContext===context&&inflightRevision===navigationRevision){result=event.data;resultContext=context;resultRevision=navigationRevision;workerError='';renderWheel();renderMoment();renderAvailability();}
  if(pending)dispatch();
};
instance.onerror=()=>{if(instance===worker)failWorker('The calculation engine could not start. Please reload the sky.');};}
function renderMoment(){
  const parts=momentParts(result?.sky.instant??instant,prefs.timeZone);
  $('#date-label').textContent=parts.date;$('#time-label').textContent=parts.time;$('#zone-label').textContent=parts.zone;
  $('#moment-button').setAttribute('aria-label',`Change date and time: ${parts.date}, ${parts.time} ${parts.zone}`);
  $('#location-label').textContent=prefs.place?.name??'Set location for houses';
  $('#configuration-label').textContent=`Tropical · ${prefs.houseSystem==='P'?'Placidus':'Whole Sign'}`;
  const chart=activeChart();
  $('#wheel-mode').textContent=chart?`${chart.timeUnknown?'NOON ESTIMATE · ':''}OUTER: TRANSITS / INNER: ${chart.name.toUpperCase()}`:live?'THE SKY, RIGHT NOW':'THE SKY, THEN & THERE';
  $('#wheel-mode').title=chart?`Natal houses and angles use ${chart.place.name}${chart.timeUnknown?' · Time unknown; noon estimate; no natal houses or angles':''}`:'Tap a planet to focus its aspects';
}
function renderTransport(){
  renderAvailability();
  $('#now-button').classList.toggle('is-browsing',!live);$('#now-label').textContent=live?'LIVE NOW':'BACK TO NOW';
  const reverse=$<HTMLButtonElement>('#reverse-button'),forward=$<HTMLButtonElement>('#forward-button');
  reverse.innerHTML=icon(play===-1?'pause':'reverse');forward.innerHTML=icon(play===1?'pause':'play');
  reverse.classList.toggle('is-playing',play===-1);forward.classList.toggle('is-playing',play===1);
  reverse.setAttribute('aria-label',play===-1?'Pause backward playback':'Play backward');forward.setAttribute('aria-label',play===1?'Pause forward playback':'Play forward');
  reverse.title=play===-1?'Pause backward playback':'Play backward';forward.title=play===1?'Pause forward playback (Space)':'Play forward (Space)';
  $<HTMLSelectElement>('#step-select').value=prefs.step;$<HTMLSelectElement>('#speed-select').value=String(prefs.speed);
  reverse.disabled=instant<=MIN_TIME;forward.disabled=instant>=MAX_TIME;
  $<HTMLButtonElement>('[data-action="step-back"]').disabled=instant<=MIN_TIME;$<HTMLButtonElement>('[data-action="step-forward"]').disabled=instant>=MAX_TIME;
  const label=STEPS.find(s=>s.id===prefs.step)!.label.replace('1 ','');
  $('#playback-hint').textContent=`${prefs.speed===.25?'¼':prefs.speed} ${label}${prefs.speed===1?'':'s'} per second${play===-1?' · reverse':''}`;
  renderMoment();
}
function renderAvailability(){
  $<HTMLButtonElement>('[data-action="share"]').disabled=!result||resultContext!==context||resultRevision!==navigationRevision||!!workerError;
  $<HTMLButtonElement>('[data-action="positions"]').disabled=!result||resultContext!==context||resultRevision!==navigationRevision||!!workerError;
}
function renderWheel(){
  const stage=$('#wheel-stage');
  const activeElement=document.activeElement as Element|null;
  const focusedPlanet=activeElement?.closest<HTMLElement>('[data-planet]')?.dataset.planet;
  const focusedDetail=activeElement?.closest<HTMLElement>('#planet-detail [data-action]')?.dataset.action;
  if(workerError){stage.innerHTML=`<div class="sky-loading error-state" role="alert">${icon('info')}<h2>The sky needs a moment.</h2><p>${esc(workerError)}</p><button class="primary-button" data-action="retry">Reload the sky</button></div>`;$('#planet-detail').hidden=true;$('#house-message').hidden=true;return;}
  const current=view();if(!current)return;
  stage.innerHTML=wheelMarkup(current);
  const houseError=(result!.natal??result!.sky).houseError;
  $('#house-message').hidden=!houseError;
  if(houseError)$('#house-message').innerHTML=`${esc(houseError)} <button class="text-button" data-action="whole-sign">Use Whole Sign</button>`;
  renderDetail();
  if(focusedPlanet){const replacement=stage.querySelector<SVGGElement>(`[data-planet="${focusedPlanet}"]`);if(replacement)replacement.focus({preventScroll:true});else $<HTMLButtonElement>('[data-action="positions"]').focus({preventScroll:true});}
  else if(focusedDetail)$('#planet-detail').querySelector<HTMLButtonElement>(`[data-action="${focusedDetail}"]`)?.focus({preventScroll:true});
}
function selectedPosition():{position:Position;layer:string}|null {
  if(!focus||!result)return null;
  const [layer,id]=focus.split(':');const chart=layer==='natal'?result.natal:result.sky;
  const position=chart?.positions.find(p=>p.id===id);return position?{position,layer}:null;
}
function selectedAspects(){
  if(!result||!focus)return [];
  const positions=result.sky.positions.filter(p=>prefs.bodies.includes(p.id));
  const natal=result.natal?.positions.filter(p=>prefs.bodies.includes(p.id))??null;
  return aspectsFor(positions,natal,natal?prefs.natalOrb:prefs.skyOrb).filter(a=>`sky:${a.a.id}`===focus||`${natal?'natal':'sky'}:${a.b.id}`===focus);
}
function renderDetail(){
  const selected=selectedPosition(),target=$('#planet-detail');target.hidden=!selected;
  if(!selected)return;
  const {position:p,layer}=selected,body=BODIES.find(b=>b.id===p.id)!,label=positionLabel(p.longitude),aspects=selectedAspects();
  target.innerHTML=`<div class="detail-top"><span class="detail-symbol">${body.glyph}︎</span><div><span class="eyebrow">${layer==='natal'?'NATAL POSITION':'TRANSITING'}</span><h2>${body.name}</h2></div><button class="icon-button" data-action="clear-focus" aria-label="Clear planet focus">${icon('close')}</button></div><div class="detail-position"><strong>${label.text}</strong><span>${p.speed<0?'Retrograde':'Direct'}</span></div><div class="mini-aspects">${aspects.slice(0,mobile?2:4).map(a=>{const other=`sky:${a.a.id}`===focus?a.b:a.a;return `<span><span class="aspect-symbol">${a.glyph}</span>${BODIES.find(b=>b.id===other.id)!.name}<small>${a.orb.toFixed(1)}°</small></span>`;}).join('')||'<p>No major aspects within the selected orb.</p>'}</div><button class="text-button detail-more" data-action="planet-aspects">${aspects.length?'View aspects & motion':'View motion'} ${icon('arrow')}</button>`;
}
function renderTimeline(){
  const svg=$<SVGElement & HTMLElement>('#timeline-scale');
  const width=$('#timeline').clientWidth||900,anchor=scrub?.anchor??instant,spacing=60;
  svg.setAttribute('viewBox',`0 0 ${width} 64`);
  let markup='';const count=Math.ceil(width/(spacing*2))+1;
  for(let i=-count;i<=count;i++){
    const tickTime=stepTime(anchor,prefs.step,i,prefs.timeZone);
    if((i<0&&tickTime===MIN_TIME)||(i>0&&tickTime===MAX_TIME))continue;
    const x=width/2+i*spacing;
    for(let j=0;j<5;j++){const sx=x+j*spacing/5;markup+=`<line x1="${sx}" y1="${j===0?22:29}" x2="${sx}" y2="37" class="${j===0?'major-tick':'minor-tick'}"/>`;}
    if(i%2===0||width>650)markup+=`<text x="${x}" y="57" text-anchor="middle">${esc(tickLabel(tickTime,prefs.step,prefs.timeZone))}</text>`;
  }
  svg.innerHTML=markup;
  $('#tuning-needle').style.transform=`translateX(${scrub?.dx??0}px)`;
  $('#timeline').setAttribute('aria-valuenow',String(Math.round(instant)));
  const parts=momentParts(instant,prefs.timeZone);$('#timeline').setAttribute('aria-valuetext',`${parts.date}, ${parts.time} ${parts.zone}`);
}
function togglePlayback(direction:1|-1){
  if(play===direction){play=null;renderTransport();return;}
  live=false;play=direction;navigationRevision++;playAnchor=instant;playStart=performance.now();requestChart();renderTransport();
}
function resetContext(){context++;focus=null;requestChart();renderTransport();}
function openPanel(title:string,subtitle:string,body:string,wide=false){
  $('#panel-inner').innerHTML=`<div class="panel-header"><div><span class="eyebrow">SKYTUNER</span><h1>${title}</h1>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="icon-button" data-action="close-panel" aria-label="Close panel">${icon('close')}</button></div><div class="panel-content">${body}</div>`;
  dialog.classList.toggle('wide',wide);if(!dialog.open)dialog.showModal();
}
function formError(form:HTMLElement,error:unknown){const target=form.querySelector<HTMLElement>('.form-error');if(target){target.hidden=false;target.textContent=error instanceof Error?error.message:'Please check the entered details.';}}
function addOccurrence(form:HTMLFormElement,error:AmbiguousTime){
  const field=form.querySelector<HTMLElement>('.occurrence-field')!;field.hidden=false;field.innerHTML=`<label>Which clock time?<select name="occurrence"><option value="reject">Choose an occurrence</option><option value="earlier">First occurrence (${esc(error.earlier)})</option><option value="later">Second occurrence (${esc(error.later)})</option></select></label>`;
}
function showRecordedOccurrence(form:HTMLFormElement,input:string,zone:string,recorded:number){
  try{resolveLocal(input,zone);}catch(error){if(error instanceof AmbiguousTime){addOccurrence(form,error);form.querySelector<HTMLSelectElement>('[name="occurrence"]')!.value=Math.abs(resolveLocal(input,zone,'earlier')-recorded)<1000?'earlier':'later';}}
}
function openMoment(){
  const original=result?.sky.instant??instant,originalZone=prefs.timeZone,input=localInput(original,originalZone);
  openPanel('Pick a moment.','A date is just another place to tune in.',`<form id="moment-form"><div class="form-grid"><label>Date<input required name="date" type="date" min="1799-12-31" max="2400-01-01" value="${esc(input.slice(0,10))}" /></label><label>Time<input required name="time" type="time" step="1" value="${esc(input.slice(11))}" /></label></div><label>Time zone or UTC offset<input name="zone" required value="${esc(prefs.timeZone)}" placeholder="America/New_York or -05:00" autocomplete="off" /></label><p class="field-note">The offset is calculated for your selected date. You can enter a recorded UTC offset for historical times.</p><div class="occurrence-field" hidden></div><p class="form-error" role="alert" hidden></p><div class="panel-actions"><button type="button" class="secondary-button" data-action="now">Use now</button><button class="primary-button" type="submit">Tune to this moment ${icon('arrow')}</button></div></form>`);
  const form=$<HTMLFormElement>('#moment-form');showRecordedOccurrence(form,input,originalZone,original);form.onsubmit=e=>{e.preventDefault();try{const f=new FormData(form),zone=String(f.get('zone')).trim();const ms=resolveEditedLocal(`${f.get('date')}T${f.get('time')}`,zone,original,originalZone,(f.get('occurrence')??'reject') as 'reject'|'earlier'|'later');prefs.timeZone=zone;persist();setMoment(ms);dialog.close();}catch(error){if(error instanceof AmbiguousTime)addOccurrence(form,error);formError(form,error);}};
}
function locationFields(place:Place|null){
  return `<div class="location-picker"><label>City or town<input class="city-search" type="search" placeholder="Search a place…" autocomplete="off" /></label><div class="location-results" hidden></div><div class="chosen-place" ${place?'':'hidden'}>${place?`${icon('pin')}<div><strong>${esc(place.name)}</strong><small>${place.latitude.toFixed(4)}°, ${place.longitude.toFixed(4)}° · ${esc(place.zone)}</small></div>`:''}</div><details class="manual-location"><summary>Enter coordinates & time zone manually</summary><div class="manual-fields"><label>Location name<input name="placeName" maxlength="160" value="${esc(place?.name??'')}" placeholder="Custom location" /></label><div class="form-grid"><label>Latitude<input name="latitude" type="number" min="-89.999999" max="89.999999" step="any" value="${place?.latitude??''}" placeholder="North + / South −" /></label><label>Longitude<input name="longitude" type="number" min="-180" max="180" step="any" value="${place?.longitude??''}" placeholder="East + / West −" /></label></div><label>Time zone or UTC offset<input name="placeZone" value="${esc(place?.zone??prefs.timeZone)}" placeholder="Europe/London or +00:00" /></label></div></details><p class="field-note attribution">City search by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> / <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a>. Only the city search text is sent.</p></div>`;
}
function mountLocation(container:HTMLElement,initial:Place|null){
  let chosen=initial,results:Place[]=[],timer:ReturnType<typeof setTimeout>|null=null,controller:AbortController|null=null;
  const search=container.querySelector<HTMLInputElement>('.city-search')!,list=container.querySelector<HTMLElement>('.location-results')!;
  search.oninput=()=>{
    if(timer)clearTimeout(timer);controller?.abort();
    const query=search.value.trim();list.hidden=query.length<3;if(query.length<3)return;
    list.innerHTML='<p>Looking for that place…</p>';
    timer=setTimeout(async()=>{
      if(!container.isConnected)return;
      const requestController=controller=new AbortController();
      const timeout=setTimeout(()=>requestController.abort('timeout'),12000);
      try{
        const response=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`,{signal:requestController.signal});
        if(!response.ok)throw new Error('City search is unavailable. Enter coordinates below instead.');
        const data=await response.json();
        if(!container.isConnected||search.value.trim()!==query)return;
        results=(Array.isArray(data.results)?data.results:[]).map((p:{name:string;admin1?:string;country?:string;latitude:number;longitude:number;timezone:string})=>({name:[p.name,p.admin1,p.country].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ').slice(0,160),latitude:p.latitude,longitude:p.longitude,zone:p.timezone})).filter(isPlace);
        list.innerHTML=results.length?results.map((p,i)=>`<button type="button" data-place-index="${i}">${icon('pin')}<span>${esc(p.name)}<small>${esc(p.zone)}</small></span></button>`).join(''):'<p>No matching place found. Try a nearby city or enter coordinates below.</p>';
      }catch(error){
        if(container.isConnected&&search.value.trim()===query&&((error as Error)?.name!=='AbortError'||requestController.signal.reason==='timeout'))list.innerHTML=`<p>${esc(requestController.signal.reason==='timeout'?'City search timed out. Try again or enter coordinates below.':error instanceof Error?error.message:'City search is unavailable. Use manual coordinates below.')}</p>`;
      }finally{clearTimeout(timeout);}
    },350);
  };
  list.onclick=e=>{
    const button=(e.target as Element).closest<HTMLElement>('[data-place-index]');if(!button)return;
    const selected=results[Number(button.dataset.placeIndex)];if(!selected)return;chosen=selected;
    const card=container.querySelector<HTMLElement>('.chosen-place')!;card.hidden=false;
    card.innerHTML=`${icon('pin')}<div><strong>${esc(chosen.name)}</strong><small>${chosen.latitude.toFixed(4)}°, ${chosen.longitude.toFixed(4)}° · ${esc(chosen.zone)}</small></div>`;
    const values:Record<string,string>={placeName:chosen.name,latitude:String(chosen.latitude),longitude:String(chosen.longitude),placeZone:chosen.zone};
    for(const [name,value] of Object.entries(values))container.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value=value;
    list.hidden=true;search.value='';(container.querySelector('.manual-location') as HTMLDetailsElement).open=false;
  };
  return ()=>{
    if((container.querySelector('.manual-location') as HTMLDetailsElement).open){
      const get=(name:string)=>container.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value.trim();
      const latText=get('latitude'),lonText=get('longitude'),latitude=Number(latText),longitude=Number(lonText),zone=get('placeZone');
      if(!latText||!lonText||!Number.isFinite(latitude)||Math.abs(latitude)>=90||!Number.isFinite(longitude)||Math.abs(longitude)>180)throw new Error('Enter a latitude between −90 and 90 and a longitude between −180 and 180.');
      if(!validZone(zone))throw new Error('Enter a valid IANA time zone or UTC offset.');
      return {name:get('placeName')||'Custom location',latitude,longitude,zone};
    }
    if(search.value.trim())throw new Error('Select a city from the results, or clear the search to keep the selected location.');
    if(!chosen)throw new Error('Choose a city, or enter coordinates and a time zone.');return chosen;
  };
}
function openLocation(){
  openPanel('Where in the world?','Your location sets the houses and local time.',`<form id="location-form">${locationFields(prefs.place)}<p class="form-error" role="alert" hidden></p><div class="panel-actions"><button type="button" class="secondary-button" data-action="clear-location">Zodiac only</button><button type="submit" class="primary-button">Set location ${icon('arrow')}</button></div></form>`);
  const form=$<HTMLFormElement>('#location-form'),read=mountLocation(form,prefs.place);
  form.onsubmit=e=>{e.preventDefault();try{prefs.place=read();prefs.timeZone=prefs.place.zone;persist();resetContext();renderTimeline();dialog.close();}catch(error){formError(form,error);}};
}
function openCharts(){
  openPanel('Your birth charts.','Saved in this browser, just for you.',`<div class="chart-list"><button class="chart-option ${!activeChartId?'selected':''}" data-action="sky-only">${icon('chart')}<span><strong>Sky only</strong><small>The planets, without a natal overlay</small></span>${!activeChartId?icon('check'):''}</button>${charts.map(c=>`<div class="saved-chart-row"><button class="chart-option ${activeChartId===c.id?'selected':''}" data-action="select-chart" data-id="${esc(c.id)}">${icon('chart')}<span><strong>${esc(c.name)}</strong><small>${esc(c.localDateTime.slice(0,10))} · ${esc(c.place.name)}${c.timeUnknown?' · Time unknown':''}</small></span>${activeChartId===c.id?icon('check'):''}</button><button class="icon-button" data-action="edit-chart" data-id="${esc(c.id)}" aria-label="Edit ${esc(c.name)}">${icon('edit')}</button><button class="icon-button" data-action="delete-chart" data-id="${esc(c.id)}" aria-label="Delete ${esc(c.name)}">${icon('trash')}</button></div>`).join('')}</div><button class="primary-button full-width" data-action="add-chart">${icon('plus')} Add a birth chart</button><div class="backup-row"><button class="text-button" data-action="export-backup">${icon('download')} Back up charts</button><button class="text-button" data-action="import-backup">Import backup</button></div><p class="field-note">A backup lets you move charts to another device or restore them after clearing your browser.</p>`);
}
function openBirthForm(existing:BirthChart|null=null){
  const birthInput=existing?.localDateTime??'1990-01-01T12:00';
  openPanel(existing?'Edit birth chart.':'A personal frequency.','Add a birth chart beneath the moving sky.',`<form id="birth-form"><label>Chart name<input name="name" maxlength="100" placeholder="A name you’ll recognize" value="${esc(existing?.name??'')}" /></label><div class="form-grid"><label>Birth date<input name="date" type="date" required min="1799-12-31" max="2400-01-01" value="${esc(birthInput.slice(0,10))}" /></label><label>Birth time<input name="time" type="time" step="1" required value="${esc(birthInput.slice(11,19))}" ${existing?.timeUnknown?'disabled':''} /></label></div><label class="checkbox-line"><input name="unknown" type="checkbox" ${existing?.timeUnknown?'checked':''} /><span>Birth time unknown</span></label><p class="field-note unknown-note" ${existing?.timeUnknown?'':'hidden'}>Uses a clearly marked noon estimate. Natal houses and angles are omitted.</p>${locationFields(existing?.place??null)}<div class="occurrence-field" hidden></div><p class="form-error" role="alert" hidden></p><div class="panel-actions"><button type="button" class="secondary-button" data-action="charts">Back</button><button type="submit" class="primary-button">${existing?'Save changes':'Save & show chart'} ${icon('arrow')}</button></div></form>`);
  const form=$<HTMLFormElement>('#birth-form'),read=mountLocation(form,existing?.place??null);
  if(existing)showRecordedOccurrence(form,birthInput,existing.place.zone,existing.instant);
  form.querySelector<HTMLInputElement>('[name="unknown"]')!.onchange=e=>{const checked=(e.target as HTMLInputElement).checked;form.querySelector<HTMLInputElement>('[name="time"]')!.disabled=checked;form.querySelector<HTMLElement>('.unknown-note')!.hidden=!checked;};
  form.onsubmit=e=>{e.preventDefault();try{
    const f=new FormData(form),place=read(),timeUnknown=f.has('unknown'),local=`${f.get('date')}T${timeUnknown?'12:00':f.get('time')}`;
    const occurrence=(f.get('occurrence')??'reject') as 'reject'|'earlier'|'later';
    const ms=existing?resolveEditedLocal(local,place.zone,existing.instant,existing.place.zone,occurrence):resolveLocal(local,place.zone,occurrence);
    const chart:BirthChart={id:existing?.id??crypto.randomUUID(),name:String(f.get('name')??'').trim()||`Birth chart ${charts.length+1}`,instant:ms,localDateTime:local,place,timeUnknown};
    charts=existing?charts.map(c=>c.id===chart.id?chart:c):[...charts,chart];activeChartId=chart.id;const saved=persistCharts();resetContext();dialog.close();if(saved)toast('Birth chart saved on this device.');
  }catch(error){if(error instanceof AmbiguousTime)addOccurrence(form,error);formError(form,error);}};
}
function installInstructions(){
  return `<section class="install-guide" aria-labelledby="install-heading"><h2 id="install-heading">Install SkyTuner</h2><p>Add SkyTuner to your Home Screen and open it like an app.</p><details class="install-steps"><summary>iPhone · Safari</summary><ol><li>Open <a href="https://skytuner.akrabu.app/" target="_blank" rel="noopener noreferrer">skytuner.akrabu.app</a> in <strong>Safari</strong>.</li><li>Tap <strong>Share</strong> (the square with an up arrow), then <strong>Add to Home Screen</strong>. Open Safari’s Page Menu first if Share is hidden. Scroll the share sheet, or use Edit Actions if Add to Home Screen is missing.</li><li>Leave <strong>Open as Web App</strong> on if shown, then tap <strong>Add</strong>.</li></ol><a class="install-help" href="https://support.apple.com/en-gb/guide/iphone/iphea86e5236/ios" target="_blank" rel="noopener noreferrer">Apple’s installation guide ↗</a></details><details class="install-steps"><summary>Android · Chrome</summary><ol><li>Open <a href="https://skytuner.akrabu.app/" target="_blank" rel="noopener noreferrer">skytuner.akrabu.app</a> in <strong>Chrome</strong>.</li><li>Tap <strong>More (⋮)</strong> → <strong>Install and create shortcut</strong> → <strong>Install</strong>. On older versions, choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.</li><li>Confirm the install prompt, then open SkyTuner from your Home Screen or app list.</li></ol><a class="install-help" href="https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&amp;hl=en" target="_blank" rel="noopener noreferrer">Google’s installation guide ↗</a></details><p class="install-note">If you’re inside another app’s browser, open this site in Safari or Chrome first. An internet connection is needed to open or reload SkyTuner and to search for cities.</p><p class="install-note">Saved charts missing after installation? In your browser, use <strong>Birth charts → Back up charts</strong>, then <strong>Import backup</strong> in the installed app.</p></section>`;
}
function openSettings(){
  openPanel('Make it your sky.','The essentials up front. Everything else, here.',`${installInstructions()}<form id="settings-form"><fieldset><legend>Appearance</legend><div class="segmented">${['system','light','dark'].map(t=>`<label><input type="radio" name="theme" value="${t}" ${prefs.theme===t?'checked':''}/><span>${t[0].toUpperCase()+t.slice(1)}</span></label>`).join('')}</div></fieldset><fieldset><legend>House system</legend><div class="segmented"><label><input type="radio" name="house" value="P" ${prefs.houseSystem==='P'?'checked':''}/><span>Placidus</span></label><label><input type="radio" name="house" value="W" ${prefs.houseSystem==='W'?'checked':''}/><span>Whole Sign</span></label></div></fieldset><fieldset><legend>Aspect lines</legend><label class="checkbox-line"><input name="aspects" type="checkbox" ${prefs.aspects?'checked':''}/><span>Show major aspects</span></label><div class="orb-control"><label for="sky-orb">Sky orb</label><input id="sky-orb" name="skyOrb" type="range" min="1" max="10" step="1" value="${prefs.skyOrb}"/><output id="sky-orb-output">${prefs.skyOrb}°</output></div><div class="orb-control"><label for="natal-orb">Transit-to-natal orb</label><input id="natal-orb" name="natalOrb" type="range" min="1" max="10" step="1" value="${prefs.natalOrb}"/><output id="natal-orb-output">${prefs.natalOrb}°</output></div><p class="field-note">Conjunctions, sextiles, squares, trines, and oppositions. Chiron and nodes use a maximum 3° orb.</p></fieldset><fieldset><legend>Planets & points</legend><div class="body-options">${BODIES.map(b=>`<label class="checkbox-line"><input type="checkbox" name="body" value="${b.id}" ${prefs.bodies.includes(b.id)?'checked':''}/><span class="option-glyph">${b.glyph}︎</span><span>${b.name}</span></label>`).join('')}</div></fieldset></form><div class="settings-footer"><button class="text-button" data-action="about">${icon('info')} About SkyTuner</button><button class="text-button" data-action="help">Keyboard shortcuts</button></div>`);
  const form=$<HTMLFormElement>('#settings-form');
  const update=()=>{const data=new FormData(form),oldHouse=prefs.houseSystem;prefs.theme=data.get('theme') as typeof prefs.theme;prefs.houseSystem=data.get('house') as typeof prefs.houseSystem;prefs.aspects=data.has('aspects');prefs.skyOrb=Number(data.get('skyOrb'));prefs.natalOrb=Number(data.get('natalOrb'));prefs.bodies=data.getAll('body').map(String);$('#sky-orb-output').textContent=`${prefs.skyOrb}°`;$('#natal-orb-output').textContent=`${prefs.natalOrb}°`;if(focus&&!prefs.bodies.includes(focus.split(':')[1]))focus=null;applyTheme();persist();if(oldHouse!==prefs.houseSystem)resetContext();else renderWheel();renderMoment();};
  form.oninput=update;form.onchange=update;
}
function openShare(){
  if(!result||resultContext!==context||resultRevision!==navigationRevision){toast('The chart is still updating. Try again in a moment.');return;}
  setMoment(result.sky.instant);
  const current={...view()!,prefs:{...prefs,bodies:[...prefs.bodies],place:prefs.place?{...prefs.place}:null}},chart=activeChart(),link=shareLink(location.origin,instant,prefs),parts=momentParts(instant,prefs.timeZone);
  openPanel('Keep this moment.','Some skies are worth coming back to.',`<div class="share-preview">${brandMark}<div><strong>${esc(parts.date)}</strong><span>${esc(parts.time)} ${esc(parts.zone)}</span><small>${esc(prefs.place?.name??'Zodiac wheel')}</small></div></div><button class="share-action" id="copy-link">${icon('copy')}<span><strong>Copy a link to this moment</strong><small>Opens the sky at this date, time, and location.</small></span>${icon('arrow')}</button><div class="copy-fallback" hidden><label>Share link<input id="share-url" readonly value="${esc(link)}" /></label></div><p class="field-note">Shared links include the selected location and display settings. Birth charts and names stay out of the link.</p><button class="share-action" id="save-image">${icon('download')}<span><strong>Save wheel as an image</strong><small>A crisp PNG with the date, time zone, and location.${chart?' Includes the displayed natal overlay.':''}</small></span>${icon('arrow')}</button>`);
  $('#copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(link);toast('Link copied. This moment is ready to share.');}catch{$('.copy-fallback').hidden=false;$<HTMLInputElement>('#share-url').select();toast('Select and copy the link below.');}};
  $('#save-image').onclick=async()=>{const button=$<HTMLButtonElement>('#save-image');button.disabled=true;try{await exportWheel(current,current.prefs.timeZone,current.prefs.place?.name??'',chart);toast('Your wheel image is ready.');}catch(error){toast(error instanceof Error?error.message:'The image could not be saved.');}finally{button.disabled=false;}};
}
function openPositions(){
  if(!result)return;
  const rows=(positions:Position[],layer:string)=>positions.filter(p=>prefs.bodies.includes(p.id)).map(p=>{const body=BODIES.find(b=>b.id===p.id)!,label=positionLabel(p.longitude);return `<button class="position-row" data-action="focus-position" data-planet-key="${layer}:${p.id}"><span class="position-glyph">${body.glyph}︎</span><strong>${body.name}</strong><span>${label.text}</span><small>${p.speed<0?'℞':''}</small></button>`;}).join('');
  openPanel('A closer look.','Select a body to focus its place in the wheel.',`<div class="positions-table"><span class="eyebrow">TRANSITING PLANETS</span>${rows(result.sky.positions,'sky')}${result.natal?`<span class="eyebrow natal-heading">NATAL POSITIONS${activeChart()?.timeUnknown?' · NOON ESTIMATE':''}</span>${rows(result.natal.positions,'natal')}`:''}</div>`);
}
function openPlanetAspects(){
  const selected=selectedPosition();if(!selected)return;
  const body=BODIES.find(b=>b.id===selected.position.id)!,aspects=selectedAspects();
  openPanel(body.name,`${selected.layer==='natal'?'Natal':'Transiting'} · ${positionLabel(selected.position.longitude).text}`,`<div class="motion-row"><span>Motion</span><strong>${selected.position.speed<0?'Retrograde':'Direct'} · ${Math.abs(selected.position.speed).toFixed(3)}° / day</strong></div><div class="aspect-table">${aspects.length?aspects.map(a=>{const isA=`sky:${a.a.id}`===focus,other=isA?a.b:a.a,otherBody=BODIES.find(b=>b.id===other.id)!;return `<div class="aspect-row"><span class="aspect-symbol">${a.glyph}</span><div><strong>${a.name} ${otherBody.name}</strong><small>${result?.natal?(isA?'Natal':'Transiting')+' · ':''}${a.phase}</small></div><span>${a.orb.toFixed(2)}°</span></div>`;}).join(''):'<p class="empty-note">No major aspects within the selected orb.</p>'}</div>`);
}
function openAbout(){
  openPanel('A little perspective.','Yesterday’s transits. Tomorrow’s hits.',`<div class="prose"><p>SkyTuner is a quiet place to watch the planets, explore another moment, or place the moving sky around a birth chart. Inspired by the simplicity of Planetwatcher.</p><h2>Your charts stay with you.</h2><p>Birth details and calculations stay in your browser. Saved charts belong to this browser on this device. Use a backup to keep a copy. City searches send the search text to Open-Meteo; share links include the location you choose.</p><h2>Under the wheel.</h2><p>Tropical, geocentric apparent positions calculated with Swiss Ephemeris 2.10.03, using bundled ephemeris files for 1800–2399. House systems: Placidus and Whole Sign. True lunar nodes; South Node opposite North Node.</p><p>Dates use the Gregorian calendar. Civil-time conversions use the browser’s time-zone database; historical records and future rules may need a manual UTC offset.</p><h2>Open by design.</h2><p>SkyTuner v${APP_VERSION} · © ${COPYRIGHT_YEAR} <a href="${AUTHOR_URL}" target="_blank" rel="noopener noreferrer">${AUTHOR_NAME}</a></p><p>SkyTuner is free software under AGPL-3.0-or-later. The source download includes the app, calculation source, license notices, and build instructions.</p><p><a href="https://github.com/akrabu/skytuner" target="_blank" rel="noopener noreferrer">Source on GitHub</a></p><a class="primary-button" href="/source/SkyTuner-source.zip" download="SkyTuner-v${APP_VERSION}-source.zip">${icon('download')} Download source code</a><p class="credits"><a href="https://www.astro.com/swisseph/" target="_blank" rel="noreferrer">Swiss Ephemeris</a> · <a href="https://github.com/prolaxu/swisseph-wasm" target="_blank" rel="noreferrer">WASM port</a> · <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> / <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a><br/>DM Sans, Space Grotesk, and Noto Sans Symbols 2 · SIL Open Font License.</p></div>`);
}
function openHelp(){openPanel('A few shortcuts.','Keep your hands on the dial.',`<div class="shortcut-list"><div><span>Step backward / forward</span><span><kbd>←</kbd> <kbd>→</kbd></span></div><div><span>Ten steps at once</span><span><kbd>Shift</kbd> + <kbd>← / →</kbd></span></div><div><span>Play forward / pause</span><kbd>Space</kbd></div><div><span>Return to live time</span><kbd>N</kbd></div><div><span>Close a panel / clear focus</span><kbd>Esc</kbd></div></div><p class="field-note">Drag the time ruler right to move forward, left to rewind. Change its scale with the time-step menu. Shortcuts pause while you’re entering details.</p>`);}

document.addEventListener('click',event=>{
  const target=(event.target as Element).closest<HTMLElement>('[data-action],[data-planet]');if(!target)return;
  if(target.dataset.planet){focus=focus===target.dataset.planet?null:target.dataset.planet;renderWheel();return;}
  const id=target.dataset.id;
  switch(target.dataset.action){
    case 'now':live=true;play=null;navigationRevision++;instant=Date.now();requestChart();renderTransport();renderTimeline();if(dialog.open)dialog.close();history.replaceState(null,'',location.pathname);break;
    case 'step-back':setMoment(stepTime(instant,prefs.step,-1,prefs.timeZone));break;
    case 'step-forward':setMoment(stepTime(instant,prefs.step,1,prefs.timeZone));break;
    case 'reverse':togglePlayback(-1);break;
    case 'forward':togglePlayback(1);break;
    case 'moment':openMoment();break;
    case 'location':openLocation();break;
    case 'settings':openSettings();break;
    case 'charts':openCharts();break;
    case 'share':openShare();break;
    case 'about':openAbout();break;
    case 'help':openHelp();break;
    case 'positions':openPositions();break;
    case 'planet-aspects':openPlanetAspects();break;
    case 'close-panel':dialog.close();break;
    case 'clear-focus':focus=null;renderWheel();break;
    case 'whole-sign':prefs.houseSystem='W';persist();resetContext();break;
    case 'clear-location':prefs.place=null;persist();resetContext();dialog.close();break;
    case 'sky-only':activeChartId=null;resetContext();dialog.close();break;
    case 'select-chart':activeChartId=id!;resetContext();dialog.close();break;
    case 'add-chart':openBirthForm();break;
    case 'edit-chart':openBirthForm(charts.find(c=>c.id===id)??null);break;
    case 'delete-chart':{const removed=charts.find(c=>c.id===id);if(!removed)break;charts=charts.filter(c=>c.id!==id);if(activeChartId===id){activeChartId=null;resetContext();}const saved=persistCharts();openCharts();toast(saved?'Birth chart removed.':'Removed for this visit; browser storage is unavailable.',{label:'Undo',run:()=>{charts.push(removed);persistCharts();if(dialog.open)openCharts();}});break;}
    case 'focus-position':focus=target.dataset.planetKey!;dialog.close();renderWheel();break;
    case 'export-backup':downloadText(JSON.stringify({version:1,charts},null,2),'SkyTuner-birth-charts.json');break;
    case 'import-backup':$<HTMLInputElement>('#backup-file').click();break;
    case 'retry':workerError='';workerDead=false;requestChart();if(!workerError)toast('Reloading the sky…');break;
  }
});
$<HTMLInputElement>('#backup-file').onchange=async e=>{const input=e.target as HTMLInputElement,file=input.files?.[0];if(!file)return;try{if(file.size>2_000_000)throw new Error('Choose a chart backup smaller than 2 MB.');const imported=parseBackup(await file.text());charts.push(...imported);const saved=persistCharts();openCharts();if(saved)toast(`${imported.length} birth chart${imported.length===1?'':'s'} imported.`);}catch(error){toast(error instanceof Error?error.message:'The backup could not be read.');}input.value='';};
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
$<HTMLSelectElement>('#step-select').onchange=e=>{prefs.step=(e.target as HTMLSelectElement).value as StepUnit;persist();if(play){playAnchor=instant;playStart=performance.now();}renderTimeline();renderTransport();};
$<HTMLSelectElement>('#speed-select').onchange=e=>{prefs.speed=Number((e.target as HTMLSelectElement).value);persist();if(play){playAnchor=instant;playStart=performance.now();}renderTransport();};
const timeline=$('#timeline');
timeline.addEventListener('pointerdown',event=>{if(event.button!==0)return;pause();scrub={anchor:instant,x:event.clientX,dx:0,pointer:event.pointerId};timeline.setPointerCapture(event.pointerId);timeline.classList.add('is-scrubbing');renderTransport();});
timeline.addEventListener('pointermove',event=>{if(!scrub)return;navigationRevision++;scrub.dx=Math.max(-timeline.clientWidth/2+12,Math.min(timeline.clientWidth/2-12,event.clientX-scrub.x));const steps=scrub.dx/60,whole=steps<0?Math.ceil(steps):Math.floor(steps),fraction=steps-whole;const a=stepTime(scrub.anchor,prefs.step,whole,prefs.timeZone),b=stepTime(scrub.anchor,prefs.step,whole+(fraction<0?-1:1),prefs.timeZone);instant=clampTime(a+(b-a)*Math.abs(fraction));$('#tuning-needle').style.transform=`translateX(${scrub.dx}px)`;requestChart();});
function finishScrub(){if(!scrub)return;scrub=null;timeline.classList.remove('is-scrubbing');renderTimeline();renderTransport();}
timeline.addEventListener('pointerup',finishScrub);timeline.addEventListener('pointercancel',finishScrub);
document.addEventListener('keydown',event=>{
  const target=event.target as Element;
  if(target.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(dialog.open)return;
  if((event.key==='Enter'||event.key===' ')&&target.closest('[data-planet]')){event.preventDefault();const p=target.closest<HTMLElement>('[data-planet]')!.dataset.planet!;focus=focus===p?null:p;renderWheel();document.querySelector<SVGGElement>(`[data-planet="${p}"]`)?.focus({preventScroll:true});return;}
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();setMoment(stepTime(instant,prefs.step,(event.key==='ArrowRight'?1:-1)*(event.shiftKey?10:1),prefs.timeZone));}
  else if(target.closest('#timeline')&&(event.key==='ArrowUp'||event.key==='ArrowDown')){event.preventDefault();setMoment(stepTime(instant,prefs.step,(event.key==='ArrowUp'?1:-1)*(event.shiftKey?10:1),prefs.timeZone));}
  else if(target.closest('#timeline')&&(event.key==='Home'||event.key==='End')){event.preventDefault();setMoment(event.key==='Home'?MIN_TIME:MAX_TIME);}
  else if(event.code==='Space'&&!target.closest('button')){event.preventDefault();if(play){play=null;renderTransport();}else togglePlayback(1);}
  else if(event.key.toLowerCase()==='n'){$<HTMLButtonElement>('#now-button').click();}
  else if(event.key==='Escape'){focus=null;renderWheel();}
});
colorScheme.addEventListener('change',()=>{applyTheme();renderWheel();});
let resizeTimer:ReturnType<typeof setTimeout>;
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{mobile=matchMedia('(max-width: 700px), (max-height: 500px) and (max-width: 1000px)').matches;renderWheel();renderTimeline();},100);});
window.addEventListener('hashchange',()=>{const incoming=readShare(location.hash,prefs);if(incoming){prefs=incoming.prefs;activeChartId=null;context++;setMoment(incoming.instant);renderTransport();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&play){play=null;renderTransport();}});
function frame(now:number){
  if(!document.hidden&&!workerError){
    const interval=live?1000:50;
    if((live||play)&&now-latestRequestTime>=interval){
      latestRequestTime=now;
      instant=live?Date.now():playbackTime(playAnchor,(now-playStart)/1000,prefs.speed,play!,prefs.step,prefs.timeZone);
      if(instant===MIN_TIME||instant===MAX_TIME){play=null;renderTransport();toast('You’ve reached the edge of the 1800–2399 ephemeris.');}
      requestChart();
    }
    if(!scrub&&now-lastTimelineTime>250){lastTimelineTime=now;renderTimeline();}
  }
  requestAnimationFrame(frame);
}
applyTheme();renderMoment();renderTransport();renderTimeline();requestChart();requestAnimationFrame(frame);
if(!storageAvailable)setTimeout(storageNotice,1000);
else if(storageWarnings.length)setTimeout(()=>toast(storageWarnings.join(' ')),1000);
if(shared)setTimeout(()=>toast('You’re viewing a shared moment. Select Back to now to return to live time.'),1200);
