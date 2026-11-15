const el=id=>document.getElementById(id);
const pack=[
 ['Ash','Birch Hollow',[3.7]],
 ['Juniper','Silver Creek',[2.9]],
 ['Flint','Granite Pass',[2.3,1.65]],
 ['Willow','Glacier Lake',[1.6,3.2]],
 ['Luna','Moonrise Summit',[3.6,2.4]]
];
let session=0,mode,phase='home',round=0,points=0,notes=[],began=null,lastEnd=0,held=false,voiceOpen=false,mouth=0,shown=0,model,modelPromise,ctx,recording,bufferPromise,analyser,wave,streams=[],micSource,version=0,playing=new Set(),liveCall=null,lastVideo=-1,seen=-Infinity,noise=.004,lastInfer=0,base=0,lastFrame=0,responseStart=0,artReady=false;
const art=el('art'),pup=new Image();pup.src='pup.webp';
const canvas=document.createElement('canvas');canvas.style.cssText='position:absolute;inset:0;margin:auto;max-width:100%;height:100%;width:100%;object-fit:contain;z-index:-2;pointer-events:none';canvas.hidden=true;art.after(canvas);
const brush=canvas.getContext('2d');
// Coordinates in the artwork, normalized so the rig scales with its portrait.
const face={cx:.496,y:.432,rx:.13,ry:.091};
function paint(open){if(!artReady)return;const w=canvas.width,h=canvas.height;brush.drawImage(pup,0,0,w,h);let cx=w*face.cx,y=h*face.y,rx=w*face.rx,ry=h*face.ry;
 // Warp narrow strips around the muzzle. The cheek edges and upper lip stay pinned.
 for(let x=-rx;x<rx;x+=2){let weight=Math.exp(-Math.pow(x/(rx*.6),4)),closed=(1-open)*.96*weight;let start=y,chin=y+ry,bottom=y+ry*2,compressed=ry*(1-closed),sx=cx+x;
 brush.drawImage(pup,sx,start,2,ry,sx,start,2,compressed+.5);brush.drawImage(pup,sx,chin,2,ry,sx,start+compressed,2,bottom-start-compressed+.5)}
 drawPack(w,h);}
pup.onload=()=>{canvas.width=pup.naturalWidth;canvas.height=pup.naturalHeight;artReady=true;paint(0)};
function stopSounds(){for(let src of playing){try{src.stop()}catch{}}playing.clear();liveCall=null}
function sound(duration,pitch=1,volume=.8){if(!recording||!ctx)return;let s=ctx.createBufferSource(),g=ctx.createGain(),t=ctx.currentTime;s.buffer=recording;s.playbackRate.value=pitch;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(volume,t+.04);g.gain.setValueAtTime(volume,t+Math.max(.05,duration-.1));g.gain.exponentialRampToValueAtTime(.001,t+duration);s.connect(g).connect(ctx.destination);playing.add(s);s.onended=()=>{playing.delete(s);s.disconnect();g.disconnect()};s.start(t,0);s.stop(t+duration);return s}
let movie=null,savedFile=null,movieURL='';
let firstHowlTime;
function movieTimestamp(date){
 const pad=n=>String(n).padStart(2,'0');
 return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+'_'+[date.getHours(),date.getMinutes(),date.getSeconds()].map(pad).join('-');
}
function movieStatus(message){el('movieStatus').textContent=message}
function discardMovie(){
 if(movie){movie.onstop=null;if(movie.state!=='inactive')movie.stop();movie=null}
 if(movieURL)URL.revokeObjectURL(movieURL);movieURL='';savedFile=null;el('saveMovie').hidden=true;movieStatus('');
}
function usableTrack(t){return t.readyState==='live'&&t.enabled&&!t.muted}
function prepareMovie(){
 if(!el('film').checked)return;
 const capture=streams.find(s=>s.getVideoTracks().some(usableTrack)&&s.getAudioTracks().some(usableTrack));
 if(!capture||!window.MediaRecorder){movieStatus('Recording unavailable. Allow both the microphone and camera, then restart to record.');return}
 try{
  const type=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/webm;codecs=vp8,opus','video/mp4','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  const rec=new MediaRecorder(capture,type?{mimeType:type}:undefined),chunks=[];
  movie=rec;rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  rec.onerror=()=>movieStatus('Selfie recording interrupted.');
  rec.onstop=()=>{if(movie!==rec)return;
   const blob=new Blob(chunks,{type:rec.mimeType||chunks[0]?.type||'video/mp4'});
   if(!blob.size){movieStatus('No video was captured.');return}
   savedFile=new File([blob],'My-wolf-howls_'+movieTimestamp(firstHowlTime)+'.'+(blob.type.includes('webm')?'webm':'mp4'),{type:blob.type});
   movieURL=URL.createObjectURL(savedFile);el('saveMovie').hidden=false;movieStatus('Your howl video is ready.');
  };
  movieStatus('Selfie video + microphone ready');
 }catch{movieStatus('Selfie recording unavailable in this browser.')}
}
function recordHowl(){if(!movie)return;if(!movie.stream.getAudioTracks().some(usableTrack)){movieStatus('Microphone interrupted. Check your microphone before recording.');return}try{if(movie.state==='inactive'){movie.start();firstHowlTime=new Date()}else if(movie.state==='paused')movie.resume();movieStatus('● Recording your howl')}catch{movieStatus('Could not start selfie recording.')}}
function pauseMovie(){if(movie?.state==='recording'){movie.pause();movieStatus('Selfie recording paused')}}
function releaseDevices(){streams.forEach(s=>s.getTracks().forEach(t=>t.stop()));streams=[];el('cam').srcObject=null;analyser=null;micSource?.disconnect();micSource=null}
function finishMovie(){if(movie&&movie.state!=='inactive'){movieStatus('Preparing your video…');const token=session;movie.addEventListener('stop',()=>{if(token===session)releaseDevices()},{once:true});movie.stop()}else releaseDevices()}
el('saveMovie').onclick=async()=>{
 if(!savedFile)return;
 try{if(navigator.canShare?.({files:[savedFile]})){await navigator.share({files:[savedFile]});return}}catch(e){if(e.name==='AbortError')return}
 const link=document.createElement('a');link.href=movieURL;link.download=savedFile.name;document.body.append(link);link.click();link.remove();
};
function cleanup(){discardMovie();session++;version++;stopSounds();streams.forEach(s=>s.getTracks().forEach(t=>t.stop()));streams=[];micSource?.disconnect();micSource=null;analyser=null;el('cam').srcObject=null;held=voiceOpen=false;mouth=0;seen=-Infinity;lastVideo=-1}
function home(){cleanup();phase='home';canvas.hidden=true;joined.clear();art.hidden=false;el('intro').hidden=false;el('play').hidden=el('top').hidden=true}
function buttons(next='',repeat=false,hold=false){el('next').hidden=!next;el('next').textContent=next;el('repeat').hidden=!repeat;el('hold').hidden=!hold}
function text(title,message){el('title').textContent=title;el('message').textContent=message}
function badge(){el('tracking').textContent=mode==='touch'?'Touch':mode==='quiet'?'Quiet · camera':analyser?'Mic on':'Mic unavailable'}
async function stream(constraints,token){const s=await navigator.mediaDevices.getUserMedia(constraints);if(token!==session){s.getTracks().forEach(t=>t.stop());throw Error('cancelled')}streams.push(s);return s}
async function camera(token,s){const v=el('cam');v.srcObject=s;await v.play();if(!modelPromise)modelPromise=(async()=>{const root='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304',lib=await import(root+'/vision_bundle.mjs'),files=await lib.FilesetResolver.forVisionTasks(root+'/wasm');return lib.FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'},numFaces:1,runningMode:'VIDEO'})})().catch(e=>{modelPromise=null;throw e});model=await modelPromise}
function mic(s){micSource=ctx.createMediaStreamSource(s);analyser=ctx.createAnalyser();analyser.fftSize=1024;wave=new Float32Array(1024);micSource.connect(analyser)}
async function start(choice){cleanup();let token=session;mode=choice;phase='setup';round=points=0;noise=.004;el('intro').hidden=true;art.hidden=true;canvas.hidden=false;el('play').hidden=el('top').hidden=false;el('pack').replaceChildren();joined.clear();paint(0);el('beats').replaceChildren();el('location').textContent='High country';el('wolf').textContent='The pack';text('Entering the valley','Allow camera access for the puppy’s muzzle. Mic mode also listens for your howl.');buttons();badge();
try{ctx??=new (window.AudioContext||window.webkitAudioContext)();await ctx.resume();bufferPromise??=fetch('yellowstone.mp3').then(r=>r.arrayBuffer()).then(b=>ctx.decodeAudioData(b)).catch(e=>{bufferPromise=null;throw e});recording=await bufferPromise}catch{if(token===session){text('Audio unavailable','Return home and try again to load the recorded wolf calls.')}return}
if(token!==session)return;
const filming=el('film').checked,video={facingMode:'user',width:{ideal:720}},audio={echoCancellation:true,noiseSuppression:false,autoGainControl:true};
if(choice!=='touch'||filming){
 let capture;
 try{capture=await stream({video,audio:filming||choice==='voice'?audio:false},token)}catch{
  if(token!==session)return;
  try{capture=await stream(choice==='voice'?{audio}:{video},token)}catch{}
 }
 if(token!==session)return;
 if(capture?.getAudioTracks().length)mic(capture);
 if(capture?.getVideoTracks().length)try{await camera(token,capture)}catch{}
}
if(token!==session)return;if(choice==='quiet'&&(!model||!el('cam').srcObject?.active))mode='touch';if(choice==='voice'&&!analyser)mode=model&&el('cam').srcObject?.active?'quiet':'touch';prepareMovie();badge();listen()}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let activeBeat=null;
function fillBeat(index,fraction){
 const bar=el('beats').children[index];
 if(bar)bar.style.setProperty('--fill',Math.min(1,Math.max(0,fraction)).toFixed(3));
}
function beginBeat(index,now){
 activeBeat={index,start:now,duration:pack[round][2][index]*1000};
 fillBeat(index,0);
}
function clearBars(){
 activeBeat=null;
 Array.from(el('beats').children).forEach((_,index)=>fillBeat(index,0));
}
const joined=new Set();
const positions=[[20,68,26],[80,68,26],[9,46,15],[91,46,15],[74,31,13]];
const wolfImages=positions.map((_,i)=>{
 const img=new Image();img.onload=()=>paint(shown);img.src='wolf-'+i+'.webp';return img;
});
function drawPack(w,h){
 for(const i of [4,2,3,0,1]){
  const img=wolfImages[i];if(!joined.has(i)||!img.naturalWidth)continue;
  const [left,feet,width]=positions[i],dw=w*width/100,dh=dw*img.naturalHeight/img.naturalWidth;
  brush.drawImage(img,w*left/100-dw/2,h*feet/100-dh,dw,dh);
 }
}
function recruit(i){joined.add(i);paint(shown)}
async function listen(){let serial=++version;stopSounds();
if(ctx.state!=='running'){
 phase='audioPaused';text('Enable wolf audio','Tap below to hear the call.');buttons('Play wolf call');return
}el('beats').hidden=false;activeBeat=null;phase='listen';held=false;began=null;notes=[];const [name,place,pattern]=pack[round];el('wolf').textContent=name+' · '+place;el('location').textContent=joined.size+' / '+pack.length+' wolves';el('beats').replaceChildren(...pattern.map(d=>{let i=document.createElement('i');i.style.flex=d;return i}));text('Listen to '+name,'Watch the gold bars for the length of each howl.');buttons();await wait(450);
for(let i=0;i<pattern.length;i++){if(serial!==version)return;beginBeat(i,performance.now());sound(pattern[i],1);await wait(pattern[i]*1000);if(serial!==version)return;fillBeat(i,1);activeBeat=null;await wait(340)}
if(serial!==version)return;clearBars();phase='answer';responseStart=performance.now();voiceOpen=false;lastEnd=0;text('Your turn',mode==='voice'?'Follow the gold bars with your howl. You can take a breath between calls.':mode==='quiet'?'Open your mouth for a howl, then close it to welcome the wolf.':'Hold the button for a howl, then release it to welcome the wolf.');el('message').textContent+=' Tap Done howling when you finish.';buttons('',true,true)}
function evaluate(){
 if(phase!=='answer'||!notes.length)return;
 const duration=notes.reduce((sum,n)=>sum+n.length,0),target=pack[round][2].reduce((sum,d)=>sum+d,0);
 const bonus=Math.round(50*Math.min(1,duration/target,target/duration));
 activeBeat=null;phase='transition';el('beats').hidden=true;buttons();pauseMovie();
 if(duration>=.22){
  points+=50+bonus;recruit(round);const member=document.createElement('span');member.textContent=pack[round][0];el('pack').append(member);
  text(pack[round][0]+' joins the pack!',(50+bonus)+' rhythm points');
 }else{text(pack[round][0]+' slips away','Try a slightly longer howl for the next wolf.')}
 el('location').textContent=joined.size+' / 5 wolves';
 buttons(round===pack.length-1?'Finish':'Next wolf');
}
let lastSignal=0;
function replyBars(seconds){
 for(const [i,duration] of pack[round][2].entries()){
  fillBeat(i,seconds/duration);seconds-=duration;
 }
}
let voicedSeconds=0,previousFrame=null,wasVoicing=false;
function input(on,now){
 if(phase!=='answer')return;
 if(began===null){
  if(!on)return;
  began=now;voicedSeconds=0;previousFrame=now;wasVoicing=false;recordHowl();
  buttons('Done howling',false,true);el('title').textContent='Your howl';
  el('message').textContent='Take a breath or keep going. Tap Done howling when you finish.';
 }
 if(on&&wasVoicing)voicedSeconds+=Math.min(.15,(now-previousFrame)/1000);
 previousFrame=now;
 if(on&&!wasVoicing&&!movie&&(mode!=='voice'||held))liveCall=sound(recording?.duration||4,1,.5);
 if(!on&&wasVoicing&&liveCall){try{liveCall.stop()}catch{}liveCall=null}
 wasVoicing=on;
 replyBars(voicedSeconds);
}
function submitReply(){
 if(phase!=='answer'||began===null)return;
 notes=[{length:voicedSeconds}];began=null;held=false;
 if(liveCall){try{liveCall.stop()}catch{}liveCall=null}
 evaluate();
}
function finale(){phase='final';began=null;lastEnd=performance.now();el('beats').hidden=true;buttons('Play again');text('Your pack is home',joined.size+' of 5 wolves joined · '+points+' rhythm points.');el('wolf').textContent=Array.from(joined,i=>pack[i][0]).join(' · ');finishMovie();sound(3.4,.83,.5)}
el('next').onclick=()=>{if(phase==='answer')submitReply();else if(phase==='audioPaused'){ctx.resume().then(listen).catch(()=>text('Audio paused','Tap Play wolf call to retry.'))}else if(phase==='transition'){if(round===pack.length-1)finale();else{round++;listen()}}else if(phase==='final')home()};el('home').onclick=home;el('repeat').onclick=()=>{pauseMovie();listen()};for(let m of ['voice','quiet','touch'])el(m).onclick=()=>start(m);
el('hold').onpointerdown=e=>{e.preventDefault();el('hold').setPointerCapture(e.pointerId);held=true;};
el('hold').onlostpointercapture=()=>held=false;window.addEventListener('pagehide',home);
function frame(now){if(activeBeat&&(phase==='listen'||phase==='answer'))fillBeat(activeBeat.index,((phase==='answer'?lastSignal:now)-activeBeat.start)/activeBeat.duration);if(phase!=='home'){const video=el('cam');if(model&&video.readyState>=2&&now-lastInfer>75&&video.currentTime!==lastVideo){lastInfer=now;lastVideo=video.currentTime;try{let p=model.detectForVideo(video,now).faceLandmarks[0];if(p){mouth=Math.min(1,Math.max(0,(Math.hypot(p[13].x-p[14].x,p[13].y-p[14].y)/Math.max(.001,Math.hypot(p[33].x-p[263].x,p[33].y-p[263].y))-.018)*4.8));seen=now}}catch{}}
let visible=now-seen<450;if(!visible)mouth=0;let rms=0;if(analyser){analyser.getFloatTimeDomainData(wave);for(let v of wave)rms+=v*v;rms=Math.sqrt(rms/wave.length);if(!voiceOpen&&phase==='answer'&&rms<.025)noise=.97*noise+.03*rms;voiceOpen=rms>Math.max(voiceOpen?.006:.011,noise*(voiceOpen?1.3:1.75))}
if(phase==='answer'){if(now-responseStart>4500&&!notes.length&&began===null)el('message').textContent='Try a relaxed “awoooo,” or press and release Hold to howl.';if(now-responseStart>600&&now-seen>1200&&mode==='quiet')el('tracking').textContent='Face the camera or hold';else if(mode==='voice'&&!visible)el('tracking').textContent='Mic · face camera for muzzle';else badge();input(held||(mode==='voice'?voiceOpen:mode==='quiet'&&mouth>(began===null?.29:.19)),now)}
if(phase==='final'){const call=held||(mode==='voice'?voiceOpen:mode==='quiet'&&mouth>.3);if(call&&began===null&&now-lastEnd>700){began=now;sound(2.1,1.14,.48);sound(2.8,.82,.36)}else if(!call&&began!==null){began=null;lastEnd=now}}const wanted=held?1:visible?mouth:mode==='voice'&&voiceOpen?.85:0;shown+=(wanted-shown)*.42;if(now-lastFrame>35&&Math.abs(shown-base)>.009){paint(shown);base=shown;lastFrame=now}}
requestAnimationFrame(frame)}requestAnimationFrame(frame)
