const el=id=>document.getElementById(id);
const pack=[
 ['Ash','Birch Hollow',[.95,.4]],
 ['Juniper','Silver Creek',[.38,.38,1.1]],
 ['Flint','Granite Pass',[1.05,.4,.42]],
 ['Willow','Glacier Lake',[.42,1.05,.42]],
 ['Luna','Moonrise Summit',[.95,.36,.36,1.2]]
];
let session=0,mode,phase='home',round=0,points=0,notes=[],began=null,lastEnd=0,held=false,voiceOpen=false,mouth=0,shown=0,model,modelPromise,ctx,recording,bufferPromise,analyser,wave,streams=[],micSource,version=0,playing=new Set(),liveCall=null,lastVideo=-1,seen=-Infinity,noise=.008,lastInfer=0,base=0,lastFrame=0,responseStart=0,artReady=false;
const art=el('art'),pup=new Image();pup.src='pup.webp';
const canvas=document.createElement('canvas');canvas.style.cssText='position:absolute;inset:0;margin:auto;max-width:100%;height:100%;width:100%;object-fit:contain;z-index:-2;pointer-events:none';canvas.hidden=true;art.after(canvas);
const brush=canvas.getContext('2d');
// Coordinates in the artwork, normalized so the rig scales with its portrait.
const face={cx:.496,y:.432,rx:.13,ry:.091};
function paint(open){if(!artReady)return;const w=canvas.width,h=canvas.height;brush.drawImage(pup,0,0,w,h);let cx=w*face.cx,y=h*face.y,rx=w*face.rx,ry=h*face.ry;
 // Warp narrow strips around the muzzle. The cheek edges and upper lip stay pinned.
 for(let x=-rx;x<rx;x+=2){let weight=Math.exp(-Math.pow(x/(rx*.6),4)),closed=(1-open)*.96*weight;let start=y,chin=y+ry,bottom=y+ry*2,compressed=ry*(1-closed),sx=cx+x;
 brush.drawImage(pup,sx,start,2,ry,sx,start,2,compressed+.5);brush.drawImage(pup,sx,chin,2,ry,sx,start+compressed,2,bottom-start-compressed+.5)}}
pup.onload=()=>{canvas.width=pup.naturalWidth;canvas.height=pup.naturalHeight;artReady=true;paint(0)};
const sample=new Audio('denali.mp3');
sample.preload='auto';
let sampleTimer;
el('test').onclick=async()=>{
 clearTimeout(sampleTimer);
 sample.currentTime=0;
 try{await sample.play();el('test').textContent='Playing wolf call…';sampleTimer=setTimeout(()=>sample.pause(),2100)}
 catch{el('test').textContent='Retry sound test'}
};
sample.onpause=()=>el('test').textContent='Test wolf sound';
function stopSounds(){for(let src of playing){try{src.stop()}catch{}}playing.clear();liveCall=null}
function sound(duration,pitch=1,volume=.8){if(!recording||!ctx)return;let s=ctx.createBufferSource(),g=ctx.createGain(),t=ctx.currentTime;s.buffer=recording;s.playbackRate.value=pitch;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(volume,t+.04);g.gain.setValueAtTime(volume,t+Math.max(.05,duration-.1));g.gain.exponentialRampToValueAtTime(.001,t+duration);s.connect(g).connect(ctx.destination);playing.add(s);s.onended=()=>{playing.delete(s);s.disconnect();g.disconnect()};s.start(t,.08);s.stop(t+duration);return s}
function cleanup(){session++;version++;stopSounds();streams.forEach(s=>s.getTracks().forEach(t=>t.stop()));streams=[];micSource?.disconnect();micSource=null;analyser=null;el('cam').srcObject=null;held=voiceOpen=false;mouth=0;seen=-Infinity;lastVideo=-1}
function home(){cleanup();phase='home';canvas.hidden=true;art.hidden=false;el('intro').hidden=false;el('play').hidden=el('top').hidden=true}
function buttons(next='',repeat=false,hold=false){el('next').hidden=!next;el('next').textContent=next;el('repeat').hidden=!repeat;el('hold').hidden=!hold}
function text(title,message){el('title').textContent=title;el('message').textContent=message}
function badge(){el('tracking').textContent=mode==='touch'?'Touch':mode==='quiet'?'Quiet · camera':analyser?'Mic on':'Mic unavailable'}
async function stream(constraints,token){const s=await navigator.mediaDevices.getUserMedia(constraints);if(token!==session){s.getTracks().forEach(t=>t.stop());throw Error('cancelled')}streams.push(s);return s}
async function camera(token){let s=await stream({video:{facingMode:'user',width:{ideal:480}},audio:false},token);const v=el('cam');v.srcObject=s;await v.play();if(!modelPromise)modelPromise=(async()=>{const root='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304',lib=await import(root+'/vision_bundle.mjs'),files=await lib.FilesetResolver.forVisionTasks(root+'/wasm');return lib.FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'},numFaces:1,runningMode:'VIDEO'})})().catch(e=>{modelPromise=null;throw e});model=await modelPromise}
async function mic(token){let s=await stream({audio:{echoCancellation:true,noiseSuppression:true},video:false},token);micSource=ctx.createMediaStreamSource(s);analyser=ctx.createAnalyser();analyser.fftSize=1024;wave=new Float32Array(1024);micSource.connect(analyser)}
async function start(choice){sample.pause();cleanup();let token=session;mode=choice;phase='setup';round=points=0;noise=.008;el('intro').hidden=true;art.hidden=true;canvas.hidden=false;el('play').hidden=el('top').hidden=false;el('pack').replaceChildren();el('beats').replaceChildren();el('location').textContent='High country';el('wolf').textContent='The pack';text('Entering the valley','Allow camera access for the puppy’s muzzle. Mic mode also listens for your howl.');buttons();badge();
try{ctx??=new (window.AudioContext||window.webkitAudioContext)();await ctx.resume();bufferPromise??=fetch('denali.mp3').then(r=>r.arrayBuffer()).then(b=>ctx.decodeAudioData(b)).catch(e=>{bufferPromise=null;throw e});recording=await bufferPromise}catch{if(token===session){text('Audio unavailable','Return home and try again to load the recorded wolf calls.')}return}
if(token!==session)return;
// Sequential device requests keep the permission prompts legible on mobile.
if(choice==='voice')try{await mic(token)}catch{}
if(token!==session)return;if(choice!=='touch')try{await camera(token)}catch{}
if(token!==session)return;if(choice==='quiet'&&(!model||!el('cam').srcObject?.active))mode='touch';if(choice==='voice'&&!analyser)mode=model&&el('cam').srcObject?.active?'quiet':'touch';badge();listen()}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function light(i){Array.from(el('beats').children).forEach((b,j)=>b.classList.toggle('on',i===j))}
async function listen(){let serial=++version;stopSounds();
if(ctx.state!=='running'){
 phase='audioPaused';text('Enable wolf audio','Tap below to hear the call.');buttons('Play wolf call');return
}phase='listen';held=false;began=null;notes=[];const [name,place,pattern]=pack[round];el('wolf').textContent=name+' · '+place;el('location').textContent=round+' / '+pack.length+' wolves';el('beats').replaceChildren(...pattern.map(d=>{let i=document.createElement('i');i.style.flex=d;return i}));text('Listen to '+name,'Watch the gold bars for the length of each howl.');buttons();await wait(450);
for(let i=0;i<pattern.length;i++){if(serial!==version)return;light(i);sound(pattern[i],1.03-round*.036);await wait(pattern[i]*1000);if(serial!==version)return;light(-1);await wait(340)}
if(serial!==version)return;phase='answer';responseStart=performance.now();voiceOpen=false;lastEnd=0;text('Your turn',mode==='voice'?'Howl the same long and short notes, leaving a little silence between them.':mode==='quiet'?'Open and close your mouth to answer.':'Hold and release the button for each note.');buttons('',true,true)}
function evaluate(){phase='result';light(-1);let target=pack[round][2],quality=notes.reduce((sum,n,i)=>sum+Math.exp(-1.8*Math.abs(Math.log(n.length/target[i]))),0)/target.length;
let timing=notes.slice(1).reduce((sum,n)=>sum+Math.min(1,.34/n.gap,n.gap/.34),0)/(notes.length-1||1);let score=Math.round(100*(quality*.85+.15*timing));
if(score>=58){points+=score;const member=document.createElement("span");member.textContent=pack[round][0];el("pack").append(member);text(pack[round][0]+' joins the pack!',score+' rhythm points · '+(round+1)+' of 5 wolves found.');phase='wonRound';sound(1.5,.93,.58);el('location').textContent=(round+1)+' / 5 wolves';buttons(round===4?'Lead the pack howl':'Find the next wolf')}else{text('A distant reply…','Listen once more. Hold the long calls, then give the short ones a quick “woo.”');buttons('Try again')}}
function input(on,now){if(phase!=='answer')return;if(on&&began===null){began=now;light(notes.length);if(mode!=='voice'||held)liveCall=sound(3.8,1.15,.5)}
if(!on&&began!==null){let n=(now-began)/1000,gap=(began-lastEnd)/1000;began=null;if(liveCall){try{liveCall.stop()}catch{}liveCall=null}light(-1);if(n<.12)return;notes.push({length:n,gap});lastEnd=now;if(notes.length===pack[round][2].length)evaluate()}}
async function finale(){phase='final';began=null;lastEnd=performance.now();buttons('Play again');text('Five voices. One pack.',points+' rhythm points. Howl again or hold the button to lead the chorus.');el('wolf').textContent='Ash · Juniper · Flint · Willow · Luna';buttons('Play again',false,true);sound(3.4,.83,.5)}
el('next').onclick=()=>{if(phase==='audioPaused'){ctx.resume().then(listen).catch(()=>text('Audio paused','Tap Play wolf call to retry.'))}else if(phase==='result')listen();else if(phase==='wonRound'){if(round===4)finale();else{round++;listen()}}else if(phase==='final')home()};el('home').onclick=home;el('repeat').onclick=listen;for(let m of ['voice','quiet','touch'])el(m).onclick=()=>start(m);
el('hold').onpointerdown=e=>{e.preventDefault();el('hold').setPointerCapture(e.pointerId);held=true;};
el('hold').onlostpointercapture=()=>held=false;window.addEventListener('pagehide',home);
function frame(now){if(phase!=='home'){const video=el('cam');if(model&&video.readyState>=2&&now-lastInfer>75&&video.currentTime!==lastVideo){lastInfer=now;lastVideo=video.currentTime;try{let p=model.detectForVideo(video,now).faceLandmarks[0];if(p){mouth=Math.min(1,Math.max(0,(Math.hypot(p[13].x-p[14].x,p[13].y-p[14].y)/Math.max(.001,Math.hypot(p[33].x-p[263].x,p[33].y-p[263].y))-.018)*4.8));seen=now}}catch{}}
let visible=now-seen<450;if(!visible)mouth=0;let rms=0;if(analyser){analyser.getFloatTimeDomainData(wave);for(let v of wave)rms+=v*v;rms=Math.sqrt(rms/wave.length);if(!voiceOpen&&phase==='answer'&&rms<.025)noise=.97*noise+.03*rms;voiceOpen=rms>Math.max(voiceOpen?.012:.021,noise*(voiceOpen?1.8:3))}
if(phase==='answer'){if(now-responseStart>600&&now-seen>1200&&mode==='quiet')el('tracking').textContent='Face the camera or hold';else if(mode==='voice'&&!visible)el('tracking').textContent='Mic · face camera for muzzle';else badge();input(held||(mode==='voice'?voiceOpen:mode==='quiet'&&mouth>(began===null?.29:.19)),now)}
if(phase==='final'){const call=held||(mode==='voice'?voiceOpen:mode==='quiet'&&mouth>.3);if(call&&began===null&&now-lastEnd>700){began=now;sound(2.1,1.14,.48);sound(2.8,.82,.36)}else if(!call&&began!==null){began=null;lastEnd=now}}const wanted=held?1:visible?mouth:mode==='voice'&&voiceOpen?.85:0;shown+=(wanted-shown)*.42;if(now-lastFrame>35&&Math.abs(shown-base)>.009){paint(shown);base=shown;lastFrame=now}}
requestAnimationFrame(frame)}requestAnimationFrame(frame)
