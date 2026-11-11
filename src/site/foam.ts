// The newsletter section is the top of a cup of coffee: Aaron asked for "a foamy coffee top, nice and
// beautiful, but the cursor can temporarily part the foam" (2026-11-11). This is the ONE public script
// besides Google Analytics, inlined by layout.ts with the page nonce.
//
// What real foam looks like, and how each part is drawn:
// - Underneath is crema, not black coffee: a golden to reddish brown, tiger mottled. (crema canvas)
// - The foam is a warm ivory, glossy, with faint brown marbling where crema has mixed in, and darker,
//   crema tinted near the rim of the cup. (foam canvas, a vignette at the left and right edges)
// - Bubbles are mostly microscopic, so the surface reads smooth; visible bubbles gather in clusters,
//   each a pale disc with a darker meniscus ring and a tiny highlight. A few larger ones.
// - A finger drawn through foam leaves a soft edged channel showing crema, with the displaced foam
//   piled into a slightly brighter ridge along the edges, and the foam casts a soft shadow into the
//   channel. Then it slowly flows back. (a low resolution thickness field T: 0 = parted, 1 = normal,
//   above 1 = piled up; rendered as a mask over the foam, a highlight for the pile, and a drop shadow)
// Reduced motion: the foam is drawn once and never parts.
export const FOAM_JS = `(function(){
var c=document.querySelector('.latte');if(!c)return;
var s=c.parentNode,x=c.getContext('2d'),d=Math.min(window.devicePixelRatio||1,2),w=0,h=0;
var calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
var crema,foam,comp,cc,mask,mc,pile,pc,img,pimg,G=4,gw=0,gh=0,T=null,last=null,busy=false;
function R(a,b){return a+Math.random()*(b-a)}
function cv(W,H){var k=document.createElement('canvas');k.width=W;k.height=H;return k}
function blob(g,px,py,rx,ry,col,a){g.save();g.translate(px,py);g.scale(1,ry/rx);var q=g.createRadialGradient(0,0,0,0,0,rx);q.addColorStop(0,col.replace('A',a));q.addColorStop(1,col.replace('A',0));g.fillStyle=q;g.beginPath();g.arc(0,0,rx,0,6.283);g.fill();g.restore()}
function makeCrema(W,H){var k=cv(W,H),g=k.getContext('2d');var l=g.createLinearGradient(0,0,0,H);l.addColorStop(0,'#8a4a1f');l.addColorStop(1,'#6e3814');g.fillStyle=l;g.fillRect(0,0,W,H);
for(var i=0;i<W*H/2500;i++){blob(g,R(0,W),R(0,H),R(10,40),R(4,12),Math.random()<.55?'rgba(201,138,69,A)':'rgba(70,30,8,A)',R(.15,.4))}
for(var j=0;j<W*H/90;j++){g.fillStyle='rgba(235,190,130,'+R(.05,.25)+')';g.fillRect(R(0,W),R(0,H),1,1)}return k}
function makeFoam(W,H){var k=cv(W,H),g=k.getContext('2d');g.fillStyle='#f1e3c9';g.fillRect(0,0,W,H);
for(var i=0;i<W*H/9000;i++){blob(g,R(0,W),R(0,H),R(40,140),R(30,90),Math.random()<.6?'rgba(255,249,236,A)':'rgba(222,196,152,A)',R(.25,.55))}
for(var m=0;m<W*H/26000;m++){g.save();g.translate(R(0,W),R(0,H));g.rotate(R(-.5,.5));blob(g,0,0,R(90,260),R(5,16),'rgba(170,108,56,A)',R(.1,.22));g.restore()}
var v=g.createLinearGradient(0,0,W,0);v.addColorStop(0,'rgba(168,104,52,.45)');v.addColorStop(.12,'rgba(168,104,52,0)');v.addColorStop(.88,'rgba(168,104,52,0)');v.addColorStop(1,'rgba(168,104,52,.45)');g.fillStyle=v;g.fillRect(0,0,W,H);
function bub(px,py,r){g.fillStyle='rgba(255,251,242,'+(r>2?.5:.7)+')';g.beginPath();g.arc(px,py,r,0,6.283);g.fill();g.strokeStyle='rgba(150,104,60,'+(r>2?.5:.34)+')';g.lineWidth=Math.max(.5,r*.22);g.beginPath();g.arc(px,py,r,-.6,2.6);g.stroke();if(r>1.3){g.fillStyle='rgba(255,255,255,.95)';g.beginPath();g.arc(px-r*.38,py-r*.38,Math.max(.5,r*.24),0,6.283);g.fill()}}
for(var n=0;n<W*H/5200;n++){var cx0=R(0,W),cy0=R(0,H),sp=R(14,60),cnt=R(20,90)|0;for(var b=0;b<cnt;b++){var a=R(0,6.283),dd=Math.sqrt(Math.random())*sp;bub(cx0+Math.cos(a)*dd,cy0+Math.sin(a)*dd*.7,Math.random()<.85?R(.7,1.8):R(1.8,3.2))}}
for(var q=0;q<W*H/700;q++){bub(R(0,W),R(0,H),R(.35,.9))}
for(var z=0;z<W*H/22000;z++){bub(R(0,W),R(0,H),R(3,6.5))}
return k}
function fit(){var r=s.getBoundingClientRect();if(!r.width)return;w=r.width;h=r.height;c.width=Math.round(w*d);c.height=Math.round(h*d);
crema=makeCrema(Math.round(w),Math.round(h));foam=makeFoam(Math.round(w),Math.round(h));comp=cv(c.width,c.height);cc=comp.getContext('2d');
gw=Math.ceil(w/G)+1;gh=Math.ceil(h/G)+1;T=new Float32Array(gw*gh).fill(1);mask=cv(gw,gh);mc=mask.getContext('2d');img=mc.createImageData(gw,gh);pile=cv(gw,gh);pc=pile.getContext('2d');pimg=pc.createImageData(gw,gh);
for(var i=0;i<gw*gh;i++){img.data[i*4+3]=255;pimg.data[i*4]=pimg.data[i*4+1]=pimg.data[i*4+2]=255}draw()}
function draw(){x.setTransform(1,0,0,1,0,0);x.globalCompositeOperation='source-over';x.globalAlpha=1;x.drawImage(crema,0,0,c.width,c.height);
for(var i=0;i<gw*gh;i++){var t=T[i];img.data[i*4+3]=t>=1?255:t<=0?0:t*255;pimg.data[i*4+3]=t>1?Math.min(1,(t-1)*3)*255:0}
mc.putImageData(img,0,0);pc.putImageData(pimg,0,0);
cc.globalCompositeOperation='source-over';cc.clearRect(0,0,comp.width,comp.height);cc.drawImage(foam,0,0,comp.width,comp.height);
cc.globalCompositeOperation='destination-in';cc.imageSmoothingEnabled=true;cc.imageSmoothingQuality='high';cc.drawImage(mask,0,0,gw*G*d,gh*G*d);
cc.globalCompositeOperation='source-atop';cc.globalAlpha=.55;cc.drawImage(pile,0,0,gw*G*d,gh*G*d);cc.globalAlpha=1;
if(busy){x.shadowColor='rgba(55,24,6,.55)';x.shadowBlur=9*d;x.shadowOffsetY=2*d}x.drawImage(comp,0,0);x.shadowColor='transparent';x.shadowBlur=0;x.shadowOffsetY=0}
function push(px,py){var rad=44,rim=rad*1.5,gx0=Math.max(0,Math.floor((px-rim)/G)),gx1=Math.min(gw-1,Math.ceil((px+rim)/G)),gy0=Math.max(0,Math.floor((py-rim)/G)),gy1=Math.min(gh-1,Math.ceil((py+rim)/G));
for(var gy=gy0;gy<=gy1;gy++)for(var gx=gx0;gx<=gx1;gx++){var k=gy*gw+gx,dist=Math.hypot(gx*G-px,gy*G-py);
if(dist<rad){var f=1-dist/rad;f=f*f*(3-2*f);T[k]=Math.max(0,T[k]-f*.5)}else if(dist<rim){var e=1-(dist-rad)/(rim-rad);T[k]=Math.min(1.3,T[k]+e*.06)}}}
function move(e){var r=s.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;if(px<0||py<0||px>w||py>h){last=null;return}
var n=last?Math.max(1,Math.ceil(Math.hypot(px-last.x,py-last.y)/5)):1;for(var i=1;i<=n;i++){var f=i/n;push(last?last.x+(px-last.x)*f:px,last?last.y+(py-last.y)*f:py)}
last={x:px,y:py};if(!busy){busy=true;requestAnimationFrame(tick)}}
function tick(){var off=0;for(var i=0;i<T.length;i++){var t=T[i];if(t!==1){t+=(1-t)*(t<1?.012:.03);if(Math.abs(1-t)<.004)t=1;else off++;T[i]=t}}
draw();if(off)requestAnimationFrame(tick);else{busy=false;draw()}}
var rt;fit();addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(fit,200)});
if(!calm){s.addEventListener('pointermove',move);s.addEventListener('pointerleave',function(){last=null})}
})();`;
