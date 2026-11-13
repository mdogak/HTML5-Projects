import {jawPose, drawHippo, paintPond} from './avatar.mjs';
import {biteBonus,mouthPoint,caught} from './physics.mjs';
const $=s=>document.querySelector(s),video=$('video'),canvas=$('canvas'),ctx=canvas.getContext('2d'),start=$('#start'),badge=$('#state'),cover=$('#cover');
const avatarMode=new URLSearchParams(location.search).get('view')!=='camera';
document.body.classList.toggle('avatarMode',avatarMode);
const switcher=$('#switch');
switcher.href=avatarMode?'?view=camera':'?view=hippo';
switcher.textContent=avatarMode?'Play camera-view version →':'Play hippo version →';
let scenery;
function background(w,h){
 if(!scenery||scenery.width!==w||scenery.height!==h){
   scenery=document.createElement('canvas');scenery.width=w;scenery.height=h;paintPond(scenery.getContext('2d'),w,h)
 }
 ctx.drawImage(scenery,0,0)
}
if(avatarMode){
 $('#edition').textContent='◉   HIPPO VIEW';
 $('#hint').textContent='FRONT CAMERA  /  FACE CONTROL';
 $('#message').textContent='Move your head to steer your hippo. Open wide to catch a marble.';
 const portrait=$('#portrait'),pc=portrait.getContext('2d');
 drawHippo(pc,{x:120,y:156,scale:1.5,gap:55,open:true});
}
let payoutUntil=0;
let model,stream,playing=false,session=0,raf,balls,labels,mouth,closed,score,time,spawn,last,frameTime,inferTime,seen,catches;
const colors=['#ffbf58','#a4e4ce','#eca4ba','#baa3ef'];
function cleanup(){playing=false;session++;cancelAnimationFrame(raf);stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;$('#end').hidden=true;$('.hud').hidden=badge.hidden=true;cover.hidden=false;start.disabled=false}
function finish(message){cleanup();$('#message').textContent=message;start.textContent='▶   Play again'}
function completed(){finish('Round complete! '+score+' points · '+catches+' marble'+(catches===1?'':'s')+' caught.')}
function enterFullscreen(){
 document.body.classList.add('immersive');
 const request=document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen;
 if(request){try{Promise.resolve(request.call(document.documentElement)).catch(()=>{})}catch{}}
}
function leaveFullscreen(){
 document.body.classList.remove('immersive');
 const exit=document.exitFullscreen||document.webkitExitFullscreen;
 if((document.fullscreenElement||document.webkitFullscreenElement)&&exit)Promise.resolve(exit.call(document)).catch(()=>{});
}
$('#fullscreen').onclick=enterFullscreen;
$('#restore').onclick=leaveFullscreen;
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)document.body.classList.remove('immersive')});
async function begin(){enterFullscreen();let token=++session;start.disabled=true;$('#end').hidden=false;$('#message').textContent='Allow front-camera access to enter the pond.';
 try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera access is unavailable. Open this page in a browser with camera support.');
 const camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'},width:{ideal:640},height:{ideal:480}},audio:false});if(token!==session){camera.getTracks().forEach(t=>t.stop());return}stream=camera;video.srcObject=stream;await video.play();if(token!==session)return;
 $('#message').textContent='Loading face tracking…';if(!model){const {FilesetResolver,FaceLandmarker}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/vision_bundle.mjs');const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm');if(token!==session)return;const loaded=await FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'},runningMode:'VIDEO',numFaces:1});if(token!==session){loaded.close();return}model=loaded}
 playing=true;balls=[];labels=[];mouth=null;closed=0;score=0;time=60;spawn=.4;seen=false;catches=0;last=performance.now();frameTime=-1;inferTime=-1000;cover.hidden=true;$('.hud').hidden=badge.hidden=false;$('#points').textContent=0;$('#time').textContent=60;$('#detected').textContent='Find your face';$('#bank').textContent='';$('#fill').style.width='0%';$('#payout').textContent='';payoutUntil=0;stream.getVideoTracks()[0].onended=()=>{if(playing)finish('Camera disconnected. Start again to reconnect.')};raf=requestAnimationFrame(tick)
 }catch(e){if(token!==session)return;finish(e.name==='NotAllowedError'?'Camera access was denied. Allow the camera in your browser settings, then try again.':e.name==='NotFoundError'?'No camera found. Open this game on a device with a front camera.':'Could not start the camera or face tracker. '+e.message)}}
function track(w,h,now){if(video.readyState<2||!video.videoWidth){mouth=null;return}if(video.currentTime===frameTime||now-inferTime<65)return;frameTime=video.currentTime;inferTime=now;const lm=model.detectForVideo(video,now).faceLandmarks[0];if(!lm){mouth=null;return}
 const [l,r,t,b]=[78,308,13,14].map(i=>mouthPoint(lm[i],w,h,video.videoWidth,video.videoHeight)),width=Math.hypot(l.x-r.x,l.y-r.y),gap=Math.hypot(t.x-b.x,t.y-b.y);
 mouth={x:(t.x+b.x)/2,y:(t.y+b.y)/2,width,gap,angle:Math.atan2(r.y-l.y,r.x-l.x),open:gap/width>(mouth?.open ? .135 : .19)};seen=true}
function tick(now){if(!playing)return;const dt=Math.min(.1,(now-last)/1000);last=now;let w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;balls=[]}ctx.clearRect(0,0,w,h);try{track(w,h,now)}catch{finish('Tracking stopped. Restart the round to reload your camera.');model?.close();model=null;return}
 if(now-inferTime>500)mouth=null;
 const target=avatarMode?jawPose(mouth,w,h):mouth;
 if(avatarMode){background(w,h);drawHippo(ctx,target)}
 if(mouth){time-=dt;spawn-=dt;if(time<=0){completed();return}if(!mouth.open)closed=Math.min(2.5,closed+dt);
 if(spawn<=0){const r=Math.max(8,Math.min(15,w*.022));balls.push({x:r+(w-2*r)*(.08+Math.random()*.84),y:-r,r,speed:h*(.24+Math.random()*.09),color:colors[Math.floor(Math.random()*4)]});spawn=.75+Math.random()*.55}}
 for(let i=balls.length-1;i>=0;i--){let ball=balls[i],old=ball.y;if(mouth)ball.y+=ball.speed*dt;const hit=caught(ball,old,target);if(hit||ball.y-ball.r>h){const delta=hit?10+biteBonus(closed):-2;score+=delta;if(hit){const bonus=biteBonus(closed);$('#payout').textContent='Catch +10 · Bonus +'+bonus;payoutUntil=now+1600;closed=0;catches++}labels.push({x:ball.x,y:hit?ball.y:h-24,t:1,text:delta>0?'+'+delta:String(delta)});balls.splice(i,1);continue}
 ctx.fillStyle=ball.color;ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#24483b';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fffc';ctx.beginPath();ctx.arc(ball.x-ball.r*.32,ball.y-ball.r*.35,ball.r*.24,0,Math.PI*2);ctx.fill()}
 const banked=biteBonus(closed);
 $('#detected').textContent=!mouth?(seen?'Tracking paused · face the camera':'Look at the camera to begin'):mouth.open?'Mouth open':banked===5?'Mouth closed · fully charged':'Mouth closed · charging';
 $('#fill').style.width=(closed/2.5*100)+'%';
 $('#bank').textContent='Next catch bonus: +'+banked+' / 5';
 if(payoutUntil && now>=payoutUntil){$('#payout').textContent='';payoutUntil=0}
 if(mouth&&!avatarMode){ctx.strokeStyle=mouth.open?'#93ffbc':'#ffd67c';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(mouth.x,mouth.y,mouth.width/2,Math.max(3,mouth.gap/2),mouth.angle,0,Math.PI*2);ctx.stroke()}
 labels=labels.filter(v=>v.t>0);ctx.font='bold 26px system-ui';ctx.textAlign='center';for(const v of labels){v.t-=dt;v.y-=dt*25;ctx.strokeStyle='#264b3b';ctx.lineWidth=4;ctx.strokeText(v.text,v.x,v.y);ctx.fillStyle='#fff5ca';ctx.fillText(v.text,v.x,v.y)}$('#points').textContent=score;$('#time').textContent=Math.ceil(time);raf=requestAnimationFrame(tick)}
start.onclick=begin;$('#end').onclick=()=>playing?completed():finish('Camera startup canceled.');window.addEventListener('pagehide',cleanup);document.addEventListener('visibilitychange',()=>{if(document.hidden&&(playing||start.disabled))finish('Round ended when the game went into the background. Final score: '+(score||0)+'.')})
