// The drawing and hit test share one jaw pose, measured in canvas pixels.
export function jawPose(face,w,h){
  const scale=Math.min(w*.0038,h*.00245,1.75);
  const x=face?Math.max(28*scale,Math.min(w-28*scale,(face.x-w/2)*1.22+w/2)):w/2;
  const y=face?Math.max(96*scale,Math.min(h-43*scale,face.y)):h*.64;
  const amount=face?.open?Math.min(1,Math.max(.18,(face.gap/face.width-.1)*2.1)):0;
  return {x,y,width:91*scale,gap:(2+amount*56)*scale,open:!!face?.open,angle:0,scale,amount};
}
function oval(c,x,y,rx,ry,fill,rotate=0){
  c.beginPath();c.ellipse(x,y,rx,ry,rotate,0,2*Math.PI);c.fillStyle=fill;c.fill()
}
function skin(c,x,y,r,light,dark){
  const g=c.createRadialGradient(x-r*.31,y-r*.46,r*.09,x,y,r);
  g.addColorStop(0,light);g.addColorStop(1,dark);return g
}
export function drawHippo(c,p){
  c.save();c.translate(p.x,p.y);c.scale(p.scale,p.scale);
  const half=p.gap/(2*p.scale),top=-half,bottom=half;
  const hide=skin(c,-4,-28,90,'#c1a8bb','#6f617d');
  oval(c,0,40,61,39,skin(c,0,30,65,'#ac96a6','#685d76'));
  oval(c,0,-13,62,56,hide);
  for(const side of [-1,1]){
    oval(c,side*49,top-46,13,19,'#796b81',side*.65);
    oval(c,side*50,top-48,7,11,'#bb91a4',side*.65);
    oval(c,side*28,top-42,17,18,skin(c,side*28,top-42,20,'#c9afbc','#8a798f'));
    oval(c,side*28,top-42,9,9,'#f8eacb');
    oval(c,side*28,top-41,5.8,7,'#392e36');
    oval(c,side*28-2,top-44,2.1,2.3,'#fff');
  }
  oval(c,0,bottom+1,50,19,skin(c,0,bottom,50,'#c7a6ae','#7d687f'));
  if(p.open){
    oval(c,0,0,47,half+5,'#a67586');
    oval(c,0,0,45.5,half,'#4b263c');
    oval(c,0,half*.67,26,half*.29,'#c57788');
    for(const side of [-1,1]){
      c.fillStyle='#f7e3be';c.beginPath();c.moveTo(side*38,bottom-1);
      c.quadraticCurveTo(side*40,bottom-10,side*34,bottom-Math.min(17,half));
      c.quadraticCurveTo(side*30,bottom-10,side*30,bottom);c.fill();
    }
  }
  for(const side of [-1,1]){
    c.fillStyle='#fff0c8';c.beginPath();c.roundRect(side*24-4,top-4,8,p.open?11:6,3);c.fill();
  }
  oval(c,0,top-16,54,22,skin(c,0,top-20,57,'#d5b3bf','#93798d'));
  for(const side of [-1,1]){
    oval(c,side*23,top-24,10,6,'#ae889a',side*.22);
    oval(c,side*23,top-25,6.7,3.6,'#5a495e',side*.22);
    for(let j=0;j<4;j++)oval(c,side*(31+j*3),top-13+Math.sin(j*2)*2,1.2,1,'#a38193')
  }
  c.restore()
}
export function paintPond(c,w,h){
  const sky=c.createLinearGradient(0,0,0,h*.48);sky.addColorStop(0,'#9ccbc1');sky.addColorStop(1,'#ffe1a4');c.fillStyle=sky;c.fillRect(0,0,w,h*.48);
  oval(c,w*.74,h*.19,w*.066,w*.066,'#ffecbd');
  for(const [y,a,color,phase] of [[.32,.055,'#9cb8a1',.4],[.37,.04,'#6a9e88',2],[.415,.032,'#477f71',4]]){
    c.beginPath();c.moveTo(0,h*.48);for(let x=0;x<=w+6;x+=6)c.lineTo(x,h*(y+a*Math.sin(phase+x/w*8)+.018*Math.cos(x/w*16)));
    c.lineTo(w,h*.48);c.fillStyle=color;c.fill()
  }
  const water=c.createLinearGradient(0,h*.45,0,h);water.addColorStop(0,'#73b7a3');water.addColorStop(.45,'#44988c');water.addColorStop(1,'#225e60');c.fillStyle=water;c.fillRect(0,h*.445,w,h*.555);
  for(let i=0;i<58;i++){let x=((i*79)%139)/139*w,y=h*(.46+((i*37)%97)/185);oval(c,x,y,w*(.009+(i%7)*.004),Math.max(.8,h*.002),'#d5eed345')}
  for(const side of [-1,1]){
    const edge=side<0?0:w;
    for(let i=0;i<12;i++){let x=edge-side*(i%5)*4,y=h*(.78+(i%4)*.045),tip=x-side*(7+i*3);
      c.beginPath();c.moveTo(x,h);c.quadraticCurveTo(x,y,tip,y-h*.1);c.quadraticCurveTo(x+side*4,y+h*.1,x+5,h);c.fillStyle=i%2?'#366f59':'#497b5e';c.fill()}
  }
}
