// Every section holding a <canvas class="latte"> (home newsletter, the Orders sections) is the top of a cup of coffee: Aaron asked for "a foamy coffee top, nice and
// beautiful, but the cursor can temporarily part the foam" (2026-11-11), then for a real, modern effect
// instead of a brush that erases a picture. This is the ONE public script besides Google Analytics,
// inlined by layout.ts with the page nonce.
//
// It is a small GPU fluid simulation (Jos Stam's "stable fluids", the same method as the well known
// WebGL fluid demos): a velocity field that is advected, made divergence free with a pressure solve,
// and used to carry the foam. The cursor stirs the liquid, so the foam is pushed, swirls and folds
// like the surface of a real cup, and then slowly settles back.
//
// What is carried by the flow (one texture, three channels):
//   x  foam thickness. 1 is a normal layer, 0 is parted down to the crema, above 1 is piled up.
//   yz the foam's own texture coordinates, so the bubbles and the marbling move WITH the foam.
// The picture is drawn by a shader from those: crema underneath, ivory foam with marbling, bubbles
// that gather in clusters (a meniscus ring and a highlight each), and light computed from the slope
// of the thickness so parted edges look like soft ridges rather than cut-outs.
//
// No WebGL2 or no float render targets: the script stops and the CSS foam colour stays. Reduced
// motion: one still frame, no stirring. The loop sleeps a few seconds after the last movement.
export const FOAM_JS = `document.querySelectorAll('.latte').forEach(function(c){
var s=c.parentNode,gl=c.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false});
if(!gl||!(gl.getExtension('EXT_color_buffer_float')||gl.getExtension('EXT_color_buffer_half_float')))return;
var calm=matchMedia('(prefers-reduced-motion: reduce)').matches,SS=4,DS=2,w=0,h=0,sw=0,sh=0,dw=0,dh=0;
var VS='#version 300 es\\nin vec2 a;out vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
var H='#version 300 es\\nprecision highp float;in vec2 v;out vec4 o;';
function sh1(t,src){var x=gl.createShader(t);gl.shaderSource(x,src);gl.compileShader(x);return x}
function prog(fs){var p=gl.createProgram();gl.attachShader(p,sh1(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh1(gl.FRAGMENT_SHADER,H+fs));gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);var u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(var i=0;i<n;i++){var nm=gl.getActiveUniform(p,i).name;u[nm]=gl.getUniformLocation(p,nm)}return{p:p,u:u}}
var ADV=prog('uniform sampler2D uV,uS;uniform vec2 tx;uniform float dt,heal;uniform int mode;void main(){vec2 q=v-dt*texture(uV,v).xy*tx;vec4 r=texture(uS,q);if(mode==1){r.x=mix(r.x,1.,heal);r.yz=mix(r.yz,v,heal*.6);}else r.xy*=.986;o=r;}');
var DIV=prog('uniform sampler2D uV;uniform vec2 tx;void main(){float L=texture(uV,v-vec2(tx.x,0.)).x,R=texture(uV,v+vec2(tx.x,0.)).x,B=texture(uV,v-vec2(0.,tx.y)).y,T=texture(uV,v+vec2(0.,tx.y)).y;o=vec4(.5*(R-L+T-B));}');
var PRS=prog('uniform sampler2D uP,uD;uniform vec2 tx;void main(){float L=texture(uP,v-vec2(tx.x,0.)).x,R=texture(uP,v+vec2(tx.x,0.)).x,B=texture(uP,v-vec2(0.,tx.y)).x,T=texture(uP,v+vec2(0.,tx.y)).x;o=vec4((L+R+B+T-texture(uD,v).x)*.25);}');
var GRD=prog('uniform sampler2D uP,uV;uniform vec2 tx;void main(){float L=texture(uP,v-vec2(tx.x,0.)).x,R=texture(uP,v+vec2(tx.x,0.)).x,B=texture(uP,v-vec2(0.,tx.y)).x,T=texture(uP,v+vec2(0.,tx.y)).x;vec2 e=texture(uV,v).xy-.5*vec2(R-L,T-B);o=vec4(e,0.,1.);}');
var SPL=prog('uniform sampler2D uT;uniform vec2 pt;uniform vec3 val;uniform float asp,rad;uniform int mode;void main(){vec2 p=(v-pt)*vec2(asp,1.);float g=exp(-dot(p,p)/rad);vec4 b=texture(uT,v);if(mode==0)b.xy+=g*val.xy;else b.x=max(0.,b.x-g*val.x);o=b;}');
var DSP=prog('uniform sampler2D uD;uniform vec2 tx;uniform float asp,sc;'
+'float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}'
+'vec2 h2(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}'
+'float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1.,0.)),f.x),mix(h1(i+vec2(0.,1.)),h1(i+vec2(1.,1.)),f.x),f.y);}'
+'float fbm(vec2 p){float a=.5,r=0.;for(int i=0;i<5;i++){r+=a*ns(p);p=p*2.03+7.1;a*=.5;}return r;}'
+'vec2 bub(vec2 x,float keep){vec2 n=floor(x),f=fract(x);float md=9.;vec2 mv=vec2(0.);float mh=0.;for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 g=vec2(float(i),float(j));vec2 pp=h2(n+g);vec2 r=g+pp-f;float d=dot(r,r);if(d<md){md=d;mv=r;mh=h1(n+g+3.7);}}'
+'float d=sqrt(md),R=.16+.26*mh,on=step(keep,fract(mh*7.31));float rim=smoothstep(.07,0.,abs(d-R))*on;float ins=smoothstep(R,R-.05,d)*on;float hl=smoothstep(R*.42,0.,length(mv-vec2(.32,-.32)*R))*ins;return vec2(rim,hl+ins*.08);}'
+'void main(){vec4 d=texture(uD,v);float f=d.x;vec2 p=d.yz*vec2(asp,1.)*sc;'
+'float fx=texture(uD,v+vec2(tx.x,0.)).x-texture(uD,v-vec2(tx.x,0.)).x,fy=texture(uD,v+vec2(0.,tx.y)).x-texture(uD,v-vec2(0.,tx.y)).x;'
+'vec3 n=normalize(vec3(-fx*3.2,-fy*3.2,1.));'
+'vec2 sp=v*vec2(asp,1.)*sc;vec3 cr=mix(vec3(.33,.17,.06),vec3(.66,.41,.18),fbm(sp*5.+3.));cr*=.82+.36*fbm(sp*38.);'
+'float m=fbm(p*3.2);vec3 fo=mix(vec3(.985,.945,.86),vec3(.93,.84,.68),smoothstep(.4,.72,m));'
+'fo=mix(fo,vec3(.80,.62,.41),.42*smoothstep(.56,.78,fbm(p*vec2(1.6,6.)+9.)));'
+'float cl=smoothstep(.46,.68,fbm(p*4.5+20.));vec2 b=bub(p*120.,.3)*cl+bub(p*250.+5.,.45)*(.3+.7*cl)*.7+bub(p*46.+11.,.9)*.8;'
+'fo=fo*(1.-.16*min(b.x,1.))+vec3(.34)*min(b.y,1.);'
+'fo=mix(vec3(.74,.54,.33),fo,smoothstep(.25,.95,f));'
+'float a=smoothstep(.1,.62,f);vec3 col=mix(cr,fo,a);'
+'vec3 L=normalize(vec3(-.45,.5,.74));float df=dot(n,L);col*=.74+.36*df/.74*.72;'
+'float spc=pow(max(dot(n,normalize(L+vec3(0.,0.,1.))),0.),48.);col+=vec3(1.,.97,.9)*spc*.28*(.25+.75*a);'
+'col+=.07*smoothstep(1.02,1.3,f);col*=1.-.38*(1.-a)*smoothstep(.0,.5,length(vec2(fx,fy))*6.);'
+'col=mix(col,col*vec3(.84,.7,.55),smoothstep(.36,.5,abs(v.x-.5))*.55);o=vec4(col,1.);}');
var vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
function fbo(W,Hh){var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,W,Hh,0,gl.RGBA,gl.HALF_FLOAT,null);var f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);return{t:t,f:f,w:W,h:Hh}}
function dbl(W,Hh){var a=fbo(W,Hh),b=fbo(W,Hh);return{get r(){return a},get w(){return b},swap:function(){var t=a;a=b;b=t}}}
var vel,prs,div,dye,ok=true;
function use(P,dst){gl.useProgram(P.p);if(dst){gl.bindFramebuffer(gl.FRAMEBUFFER,dst.f);gl.viewport(0,0,dst.w,dst.h)}else{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,c.width,c.height)}}
function tex(P,name,t,unit){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t.t);gl.uniform1i(P.u[name],unit)}
function quad(){gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}
function fit(){var r=s.getBoundingClientRect();if(!r.width)return;w=r.width;h=r.height;var d=Math.min(window.devicePixelRatio||1,1.5);c.width=Math.round(w*d);c.height=Math.round(h*d);
sw=Math.max(32,Math.round(w/SS));sh=Math.max(16,Math.round(h/SS));dw=Math.max(64,Math.round(w/DS));dh=Math.max(32,Math.round(h/DS));
vel=dbl(sw,sh);prs=dbl(sw,sh);div=fbo(sw,sh);dye=dbl(dw,dh);
ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;if(!ok)return;
[vel.r,vel.w,prs.r,prs.w].forEach(function(t){gl.bindFramebuffer(gl.FRAMEBUFFER,t.f);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT)});
use(ADV,dye.w);tex(ADV,'uV',vel.r,0);tex(ADV,'uS',dye.r,1);gl.uniform2f(ADV.u.tx,0,0);gl.uniform1f(ADV.u.dt,0);gl.uniform1f(ADV.u.heal,1);gl.uniform1i(ADV.u.mode,1);quad();dye.swap();
c.classList.add('on');draw()}
function draw(){use(DSP,null);tex(DSP,'uD',dye.r,0);gl.uniform2f(DSP.u.tx,1/dw,1/dh);gl.uniform1f(DSP.u.asp,w/h);gl.uniform1f(DSP.u.sc,Math.max(1,h/290));quad()}
var q=[],last=null,lastT=0,run=false,prev=0;
function splat(x,y,dx,dy){var asp=w/h;use(SPL,vel.w);tex(SPL,'uT',vel.r,0);gl.uniform2f(SPL.u.pt,x,y);gl.uniform3f(SPL.u.val,dx,dy,0);gl.uniform1f(SPL.u.asp,asp);gl.uniform1f(SPL.u.rad,.02);gl.uniform1i(SPL.u.mode,0);quad();vel.swap();
var sp=Math.min(1,Math.hypot(dx,dy)/120);use(SPL,dye.w);tex(SPL,'uT',dye.r,0);gl.uniform2f(SPL.u.pt,x,y);gl.uniform3f(SPL.u.val,.04+.15*sp,0,0);gl.uniform1f(SPL.u.asp,asp);gl.uniform1f(SPL.u.rad,.008);gl.uniform1i(SPL.u.mode,1);quad();dye.swap()}
function step(now){if(!ok)return;var dt=Math.min((now-prev)/1000,1/30)||1/60;prev=now;
while(q.length){var e=q.shift();splat(e[0],e[1],e[2],e[3])}
use(ADV,vel.w);tex(ADV,'uV',vel.r,0);tex(ADV,'uS',vel.r,1);gl.uniform2f(ADV.u.tx,1/sw,1/sh);gl.uniform1f(ADV.u.dt,dt);gl.uniform1i(ADV.u.mode,0);quad();vel.swap();
use(DIV,div);tex(DIV,'uV',vel.r,0);gl.uniform2f(DIV.u.tx,1/sw,1/sh);quad();
use(PRS,prs.w);gl.uniform2f(PRS.u.tx,1/sw,1/sh);tex(PRS,'uD',div,1);for(var i=0;i<18;i++){gl.bindFramebuffer(gl.FRAMEBUFFER,prs.w.f);tex(PRS,'uP',prs.r,0);quad();prs.swap()}
use(GRD,vel.w);tex(GRD,'uP',prs.r,0);tex(GRD,'uV',vel.r,1);gl.uniform2f(GRD.u.tx,1/sw,1/sh);quad();vel.swap();
use(ADV,dye.w);tex(ADV,'uV',vel.r,0);tex(ADV,'uS',dye.r,1);gl.uniform2f(ADV.u.tx,1/sw,1/sh);gl.uniform1f(ADV.u.dt,dt);gl.uniform1f(ADV.u.heal,.006);gl.uniform1i(ADV.u.mode,1);quad();dye.swap();
draw();if(now-lastT<14000)requestAnimationFrame(step);else run=false}
function move(e){var r=s.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;if(px<0||py<0||px>w||py>h){last=null;return}
if(last){var dx=px-last.x,dy=py-last.y,n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/14));for(var i=1;i<=n;i++){var f=i/n;q.push([(last.x+dx*f)/w,1-(last.y+dy*f)/h,dx/n*26/SS,-dy/n*26/SS])}}
last={x:px,y:py};lastT=performance.now();if(!run){run=true;prev=lastT;requestAnimationFrame(step)}}
var rt;fit();addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(fit,250)});
if(!calm&&ok){s.addEventListener('pointermove',move);s.addEventListener('pointerleave',function(){last=null})}
});`;
