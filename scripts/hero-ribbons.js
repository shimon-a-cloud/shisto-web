/* Rounded deforming mesh with the renewal material and polished gold/silver reflections. */
(()=>{'use strict';const body=document.body,reduce=matchMedia('(prefers-reduced-motion: reduce)'),stage=document.querySelector('.hero-architecture');if(!stage)return;let paused=reduce.matches;
 /* A family of open, solid ribbons. Actual mesh normals, depth and lighting;
    no image texture, external library, or sphere/ring primitive. */
 const canvas=document.createElement('canvas');canvas.className='ribbon-canvas';canvas.setAttribute('aria-hidden','true');stage.append(canvas);let gl;try{gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power'});}catch(e){return;}if(!gl)return;
 const vs=`
 attribute vec3 aPosition;attribute vec3 aNormal;attribute vec3 aUv;
 uniform mat4 uMVP;uniform mat4 uModel;uniform float uTime;uniform float uFlow;
 varying vec3 vNormal;varying vec3 vPosition;varying vec3 vUv;
 vec3 deform(vec3 p){
   float t=uTime*.48;
   float swell=1.+.11*sin(p.y*1.9+t)*cos(p.x*1.6-t*.73)+.065*sin(p.z*2.2+p.x*1.2+t*.61);
   p*=swell;
   p*=vec3(1.+.12*sin(t*.81),1.+.10*cos(t*.67),1.+.12*sin(t*.57+.8));
   p.x+=.13*sin(p.y*1.65+t*.72);
   p.z+=.09*sin(p.x*1.8-t*.64);
   return p;
 }
 void main(){
   vec3 n=normalize(aNormal);
   vec3 axis=abs(n.y)>.9?vec3(1.,0.,0.):vec3(0.,1.,0.);
   vec3 tangent=normalize(cross(axis,n));vec3 bitangent=cross(n,tangent);
   float e=.002;
   vec3 dt=deform(aPosition+tangent*e)-deform(aPosition-tangent*e);
   vec3 db=deform(aPosition+bitangent*e)-deform(aPosition-bitangent*e);
   vec3 shape=deform(aPosition);vec3 normal=normalize(cross(dt,db));
   vec4 p=uModel*vec4(shape,1.);
   vPosition=p.xyz;vNormal=mat3(uModel)*normal;vUv=aUv;
   gl_Position=uMVP*vec4(shape,1.);
 }`;

 const fs=`precision highp float;varying vec3 vNormal;varying vec3 vPosition;varying vec3 vUv;uniform float uTime;uniform float uOpacity;vec3 spectrum(float t){return .5+.5*cos(6.28318*(vec3(0.,.32,.64)+t));}void main(){vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;vec3 v=normalize(vec3(0.,0.,8.)-vPosition);vec3 r=reflect(-v,n);float facing=max(dot(n,v),0.);float f=pow(1.-facing,2.5);float band=pow(max(0.,cos(r.y*5.1+r.x*2.4+.7)),24.);float broad=pow(max(0.,cos(r.y*2.6-r.x*.8)),8.);float rim=pow(1.-facing,4.);vec3 ir=spectrum(r.y*.31+r.x*.22+vUv.y*.18+uTime*.014);ir.g*=.69;ir=mix(vec3(.32,.43,.46),ir,.68);vec3 col=vec3(.045,.042,.046)+vec3(.24,.25,.25)*broad;col+=vec3(.91,.91,.87)*(band*.80);col+=ir*(band*.31+f*.10);float stripe=pow(max(0.,cos(vUv.x*6.28318)),12.);col+=vec3(.065,.075,.072)*stripe*broad;col+=vec3(.42,.55,.57)*rim*.10;float goldLight=max(0.,cos(r.x*3.1+r.y*1.7-.65));
float silverLight=max(0.,cos(r.y*3.6-r.x*2.1+1.2));
vec3 gold=vec3(1.,.69,.27);
vec3 silver=vec3(.82,.90,1.);
col+=gold*(pow(goldLight,7.)*.28+pow(goldLight,65.)*.95);
col+=silver*(pow(silverLight,9.)*.20+pow(silverLight,80.)*1.05);
col+=mix(gold,silver,smoothstep(-.3,.4,r.x))*rim*.14;
col=pow(col,vec3(.94));gl_FragColor=vec4(col,uOpacity);}`;
 function shader(type,source){const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;}let program;try{program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return;}catch(e){return;}
 gl.useProgram(program);const loc={};['uMVP','uModel','uTime','uOpacity','uFlow'].forEach(n=>loc[n]=gl.getUniformLocation(program,n));
 const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),scale=(a,s)=>a.map(v=>v*s),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>scale(a,1/(Math.hypot(...a)||1));
 function center(t,k){const phase=(k-2.5)*.11;return [1.34*Math.sin(t*2.15+phase)+.23*Math.sin(t*5.2+phase),t*1.93+.15*Math.sin(t*3.+k*.2),.85*Math.cos(t*2.7+phase)+(k-2.5)*.15];}
 function point(t,q,k){const c=center(t,k),tan=norm(sub(center(t+.001,k),center(t-.001,k))),base=norm(cross(tan,[0,0,1])),other=norm(cross(tan,base)),twist=t*2.7+k*.17+.3*Math.sin(t*4.),side=add(scale(base,Math.cos(twist)),scale(other,Math.sin(twist))),up=norm(cross(tan,side)),w=(.20+.075*Math.sin(t*3.+k))*(.72+.28*Math.pow(Math.cos(t*1.22),2)),thickness=.028;return add(c,add(scale(side,Math.cos(q)*w),scale(up,Math.sin(q)*thickness)));}
 const positions=[],normals=[],uvs=[],indices=[];
 const segments=innerWidth<768?96:160,edges=innerWidth<768?48:80;
 for(let i=0;i<=edges;i++){
   const latitude=Math.PI*i/edges;
   for(let j=0;j<=segments;j++){
     const longitude=2*Math.PI*j/segments;
     const n=[Math.sin(latitude)*Math.cos(longitude),Math.cos(latitude),Math.sin(latitude)*Math.sin(longitude)];
     positions.push(n[0]*1.63,n[1]*1.70,n[2]*1.35);
     normals.push(...norm([n[0]/1.63,n[1]/1.70,n[2]/1.35]));
     uvs.push(j/segments,i/edges,0);
   }
 }
 for(let i=0;i<edges;i++)for(let j=0;j<segments;j++){
   const a=i*(segments+1)+j,b=a+segments+1;
   indices.push(a,a+1,b,a+1,b+1,b);
 }

 function buffer(name,data,size){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,0,0);}buffer('aPosition',positions,3);buffer('aNormal',normals,3);buffer('aUv',uvs,3);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
 function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}function projection(aspect){const f=1/Math.tan(.59/2),n=.1,far=40;return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+n)/(n-far),-1,0,0,2*far*n/(n-far),0]);}
 let pointer=[0,0],smoothPointer=[0,0],elapsed=0,last=0,raf=0,lastDraw=0,staticFrame=0,resizeFrame=0,visible=true,contextLost=false;
 const hero=document.querySelector('.hero');
 function resize(){
  /* CSS viewport units stay steady through mobile browser-bar animation. */
  const width=Math.max(canvas.clientWidth,1),height=Math.max(canvas.clientHeight,1);
  const d=Math.min(devicePixelRatio||1,1.7),max=width<768?1300:2048,ratio=Math.min(d,max/Math.max(width,height));
  const nextWidth=Math.max(1,Math.round(width*ratio)),nextHeight=Math.max(1,Math.round(height*ratio));
  if(canvas.width===nextWidth&&canvas.height===nextHeight)return;
  canvas.width=nextWidth;canvas.height=nextHeight;gl.viewport(0,0,nextWidth,nextHeight);
 }
 resize();
 window.addEventListener('resize',()=>{
  if(resizeFrame)return;
  resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;resize();if(paused)scheduleStatic();else start();});
 },{passive:true});
 window.addEventListener('pointermove',e=>{
  if(e.pointerType!=='mouse'&&e.pointerType!=='pen')return;
  pointer=[e.clientX/innerWidth*2-1,e.clientY/innerHeight*2-1];
 },{passive:true});
 window.addEventListener('pointerleave',()=>{pointer=[0,0];});
 function render(){if(contextLost)return;const hr=hero.getBoundingClientRect(),mobile=innerWidth<768;visible=hr.bottom>0&&hr.top<innerHeight;if(!visible)return;gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const progress=Math.min(1,Math.max(0,-hr.top/Math.max(canvas.clientHeight,1)));smoothPointer[0]+=(pointer[0]-smoothPointer[0])*.055;smoothPointer[1]+=(pointer[1]-smoothPointer[1])*.055;const t=elapsed,ry=.20+Math.sin(t*.16)*.30+smoothPointer[0]*.20+progress*.65,rx=.10+Math.sin(t*.12)*.09+smoothPointer[1]*.11,rz=-.40+Math.sin(t*.11)*.08+progress*.21,sc=mobile?.19:.82;const cy=Math.cos(ry),sy=Math.sin(ry),cx=Math.cos(rx),sx=Math.sin(rx),cz=Math.cos(rz),sz=Math.sin(rz);const rotX=new Float32Array([1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1]),rotY=new Float32Array([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1]),rotZ=new Float32Array([cz,sz,0,0,-sz,cz,0,0,0,0,1,0,0,0,0,1]);let model=multiply(rotZ,multiply(rotY,rotX));for(let i=0;i<12;i++)model[i]*=sc;model[12]=mobile?.1:1.85;model[13]=(mobile?.28:-.14)+progress*2.8;model[14]=mobile?-8.3:-9.;const mvp=multiply(projection(canvas.clientWidth/Math.max(canvas.clientHeight,1)),model);gl.uniformMatrix4fv(loc.uModel,false,model);gl.uniformMatrix4fv(loc.uMVP,false,mvp);gl.uniform1f(loc.uTime,t);gl.uniform1f(loc.uFlow,progress);gl.uniform1f(loc.uOpacity,1);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);}
 function frame(now){raf=0;if(paused||document.hidden||contextLost)return;if(last)elapsed+=Math.min((now-last)/1000,.05);last=now;if(now-lastDraw>33){render();lastDraw=now;}if(visible)raf=requestAnimationFrame(frame);}
 function start(){if(paused||document.hidden||contextLost||raf)return;last=0;lastDraw=0;raf=requestAnimationFrame(frame);}
 function stop(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;}
 function scheduleStatic(){if(staticFrame||document.hidden||contextLost)return;staticFrame=requestAnimationFrame(()=>{staticFrame=0;render();});}
 document.addEventListener('motionchange',()=>{if(paused){stop();scheduleStatic();}else start();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else if(paused)scheduleStatic();else start();});
 window.addEventListener('scroll',()=>{if(paused)scheduleStatic();else if(!visible)start();},{passive:true});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;stop();stage.classList.remove('sculpture-ready');});
 const syncMotion=()=>{paused=reduce.matches||body.classList.contains('motion-paused')||body.classList.contains('brand-opening-active');if(paused)stop();else start();};
 new MutationObserver(syncMotion).observe(body,{attributes:true,attributeFilter:['class']});
 reduce.addEventListener('change',()=>{syncMotion();render();});
 render();stage.classList.add('sculpture-ready');syncMotion();
})();
