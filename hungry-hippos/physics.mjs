export function biteBonus(seconds){return Math.min(5, Math.floor(seconds*2))}
export function mouthPoint(point,w,h,vw,vh){const s=Math.max(w/vw,h/vh);return {x:(w-vw*s)/2+(1-point.x)*vw*s,y:(h-vh*s)/2+point.y*vh*s}}
export function caught(ball,oldY,mouth){if(!mouth?.open)return false;
 const cos=Math.cos(mouth.angle),sin=Math.sin(mouth.angle),rx=mouth.width*.5+ball.r*.35,ry=mouth.gap*.5+ball.r*.35;
 function position(y){let dx=ball.x-mouth.x,dy=y-mouth.y;return [(dx*cos+dy*sin)/rx,(-dx*sin+dy*cos)/ry]}
 const [x,y]=position(oldY),[a,b]=position(ball.y),u=a-x,v=b-y,t=Math.max(0,Math.min(1,-(x*u+y*v)/(u*u+v*v||1)));
 return (x+t*u)**2+(y+t*v)**2<=1}
