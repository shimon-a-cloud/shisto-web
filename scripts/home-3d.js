/* Liquid glass hero: the brand opening is rendered separately in brand-opening.js.
   This renderer stays dedicated to the approved, continuous hero volume. */
(() => {
  'use strict';
  const hero = document.querySelector('.hero');
  const stage = hero?.querySelector('.hero-architecture');
  if (!hero || !stage) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  canvas.className = 'sculpture-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  let gl;
  try { gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' }); } catch (_) { return; }
  if (!gl) return;

  const vertex = 'attribute vec2 aPosition; void main(){gl_Position=vec4(aPosition,0.,1.);}';
  const fragment = `
    precision highp float;
    uniform vec2 uResolution,uPointer;
    uniform float uTime,uScroll;
    #define FAR 11.0
    #define EPS .0024

    float smin(float a,float b,float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
    float sdEllipsoid(vec3 p,vec3 r){ float k0=length(p/r),k1=length(p/(r*r)); return k0*(k0-1.)/k1; }
    mat2 rotate2d(float angle){ float c=cos(angle),s=sin(angle); return mat2(c,-s,s,c); }

    float scene(vec3 p){
      float a=uTime*.58,b=uTime*.41+1.4,c=uTime*.31+2.7;
      p.xz=rotate2d(.19*sin(a)+.07*sin(c))*p.xz;
      p.xy=rotate2d(.12*sin(b))*p.xy;
      p.x+=sin(p.y*2.1+a)*.095;
      p.z+=sin(p.x*2.5-b)*.075;
      float core=sdEllipsoid(p-vec3(-.12+.11*sin(b),.02+.10*cos(a),.02*sin(c)),vec3(1.13+.13*cos(a),1.10+.16*sin(b),.67+.075*cos(c)));
      float shoulder=sdEllipsoid(p-vec3(.43+.22*cos(a),.27+.18*sin(c),.02+.11*sin(b)),vec3(.74+.17*sin(c),.77+.15*cos(a),.60+.09*sin(b)));
      float lower=sdEllipsoid(p-vec3(.12+.19*sin(c),-.67+.22*cos(b),.03-.10*cos(a)),vec3(.98+.18*cos(b),.65+.15*sin(a),.62+.10*cos(c)));
      float left=sdEllipsoid(p-vec3(-.66+.20*cos(b),-.18+.18*sin(a),-.02+.10*sin(c)),vec3(.61+.15*sin(a),.79+.16*cos(c),.56+.09*sin(b)));
      float shape=smin(core,shoulder,.40+.09*sin(c));
      shape=smin(shape,lower,.43+.10*cos(a));
      shape=smin(shape,left,.33+.09*sin(b));
      return shape+.018*sin(p.y*3.1-p.x*2.0+a);
    }

    vec3 normalAt(vec3 p){ vec2 e=vec2(.003,0.); return normalize(vec3(scene(p+e.xyy)-scene(p-e.xyy),scene(p+e.yxy)-scene(p-e.yxy),scene(p+e.yyx)-scene(p-e.yyx))); }
    float band(float value,float center,float width){return exp(-pow((value-center)/width,2.));}
    vec3 reflectedStudio(vec3 r,vec3 n){
      vec3 sampleR=vec3(-r.x,r.y,r.z);
      float orange=band(sampleR.y+.18*sin(sampleR.x*3.3),-.08,.24)*smoothstep(-.65,.22,sampleR.x);
      float magenta=band(sampleR.y-.36*cos(sampleR.x*2.2),.34,.18)*smoothstep(-.10,.65,sampleR.x);
      float cyan=band(sampleR.y+.24*cos(sampleR.x*3.7),-.31,.17)*smoothstep(-.58,.36,-sampleR.x);
      float cobalt=band(sampleR.x,-.46,.31)*(1.-smoothstep(.02,.86,sampleR.y));
      float warmStripe=band(sampleR.x+.12*sin(sampleR.y*4.1),-.08,.18)*band(sampleR.y,.02,.65);
      vec3 colour=vec3(.004,.009,.024);
      colour+=vec3(1.0,.15,.008)*orange*1.55;
      colour+=vec3(.94,.008,.42)*magenta*1.55;
      colour+=vec3(.002,.63,1.0)*cyan*1.36;
      colour+=vec3(.015,.08,.31)*cobalt*1.62;
      colour+=vec3(1.0,.39,.035)*warmStripe*.62;
      float edge=1.-max(0.,n.z),rightArc=smoothstep(-.15,.35,-n.x),lowerArc=1.-smoothstep(-.20,.65,n.y);
      float broadSoftbox=band(sampleR.x,.12,.60)*band(sampleR.y,-.10,.78);
      float white=rightArc*(.25+.75*lowerArc)*band(edge,.32,.047)*(.75+.25*broadSoftbox);
      colour+=vec3(1.,.99,1.)*white*4.8;
      float fineGlint=rightArc*band(edge,.63,.019)*(.3+.7*lowerArc);
      colour+=vec3(.65,.84,1.)*fineGlint*1.5;
      float outerRim=pow(edge,1.7),innerRim=band(edge,.40,.065);
      colour+=vec3(.015,.12,.42)*outerRim*.72;
      colour+=vec3(.22,.03,.30)*innerRim*.42;
      return colour;
    }
    void main(){
      vec2 uv=(2.*gl_FragCoord.xy-uResolution.xy)/uResolution.y; uv.y=-uv.y;
      float aspect=uResolution.x/uResolution.y;
      float cameraZ=mix(5.15,3.20,smoothstep(.56,1.22,aspect));
      vec3 baseRo=vec3(uPointer.x*.075,-uPointer.y*.055+uScroll*.045,cameraZ);
      vec3 baseTarget=vec3(uPointer.x*.025,-.02,0.);
      vec3 ro=baseRo, target=baseTarget;
      vec3 forward=normalize(target-ro),right=normalize(cross(vec3(0.,1.,0.),forward)),up=cross(forward,right);
      vec3 rd=normalize(forward+uv.x*right*.83+uv.y*up*.83);
      float t=0.,distance=0.; bool hit=false;
      for(int i=0;i<76;i++){ vec3 p=ro+rd*t; distance=scene(p); if(distance<EPS){hit=true;break;} t+=distance*.76; if(t>FAR)break; }
      vec3 colour=vec3(0.);
      if(hit){
        vec3 p=ro+rd*t,n=normalAt(p),r=reflect(rd,n); float fresnel=pow(1.-max(0.,dot(-rd,n)),3.25);
        vec3 studio=reflectedStudio(r,n); float inner=pow(max(0.,dot(n,normalize(vec3(-.35,.28,.88)))),1.4);
        vec3 body=vec3(.006,.025,.075)+vec3(.008,.055,.13)*inner;
        float liquid=.5+.5*sin(p.x*4.5-p.y*3.1+uTime*.65); body+=vec3(.015,.004,.032)*liquid*(1.-fresnel);
        colour=mix(body*.45,studio,clamp(.82+fresnel*.18,0.,1.)); colour+=studio*(.12+.32*fresnel);
        colour=1.-exp(-colour*1.20); float vignette=1.-smoothstep(.22,1.12,length(uv-vec2(0.,-.015))); colour*=.92+.08*vignette;
      }
      gl_FragColor=vec4(colour,1.);
    }`;

  const shaders=[]; let program,buffer,control;
  let frame=0,last=0,elapsed=0,visible=true,lost=false,ready=false,paused=reduced.matches;
  let px=0,py=0,lx=0,ly=0,scrollTarget=0,scrollEase=0;
  const dispose=()=>{ready=false;if(frame)cancelAnimationFrame(frame);frame=0;stage.classList.remove('sculpture-ready');canvas.remove();control?.remove();if(!lost){if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);}};
  try{
    const compile=(type,source)=>{const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error('Shader unavailable');return shader;};
    program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('WebGL unavailable');
  }catch(_){shaders.forEach(shader=>gl.deleteShader(shader));dispose();return;}
  shaders.forEach(shader=>gl.deleteShader(shader));gl.useProgram(program);
  buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const attr=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
  const resolution=gl.getUniformLocation(program,'uResolution'),time=gl.getUniformLocation(program,'uTime'),pointer=gl.getUniformLocation(program,'uPointer'),scroll=gl.getUniformLocation(program,'uScroll');
  const draw=()=>{if(!ready||lost)return;gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(resolution,canvas.width,canvas.height);gl.uniform1f(time,elapsed);gl.uniform2f(pointer,lx,ly);gl.uniform1f(scroll,scrollEase);gl.drawArrays(gl.TRIANGLES,0,6);};
  const update=()=>{const stopped=paused||reduced.matches;stage.classList.toggle('is-paused',stopped||!visible||document.hidden||lost);if(!control)return;control.setAttribute('aria-pressed',String(stopped));control.setAttribute('aria-label',stopped?'立体演出を再生する':'立体演出を停止する');control.textContent=stopped?'MOTION OFF':'MOTION ON';control.hidden=reduced.matches||lost;};
  const run=()=>ready&&!paused&&!reduced.matches&&visible&&!document.hidden&&!lost&&!document.body.classList.contains('brand-opening-active');
  const tick=now=>{frame=0;if(!run()){last=0;return;}const delta=last?Math.min(now-last,80):0;if(!last||now-last>=1000/30){elapsed+=delta/1000;last=now;lx+=(px-lx)*.055;ly+=(py-ly)*.055;scrollEase+=(scrollTarget-scrollEase)*.075;draw();}frame=requestAnimationFrame(tick);};
  const sync=()=>{if(frame)cancelAnimationFrame(frame);frame=0;last=0;if(run())frame=requestAnimationFrame(tick);};
  const resize=()=>{const rect=stage.getBoundingClientRect(),scale=Math.min(devicePixelRatio||1,1,1100/Math.max(rect.width,rect.height,1));canvas.width=Math.max(1,Math.round(rect.width*scale));canvas.height=Math.max(1,Math.round(rect.height*scale));draw();};
  try{
    stage.append(canvas);ready=true;resize();if(gl.getError()!==gl.NO_ERROR)throw new Error('WebGL unavailable');stage.classList.add('sculpture-ready');
    control=document.createElement('button');control.type='button';control.className='sculpture-motion-control';control.addEventListener('click',()=>{paused=!paused;update();sync();});hero.append(control);update();sync();
  }catch(_){dispose();return;}
  hero.addEventListener('pointermove',event=>{if(event.pointerType!=='mouse'||!run())return;const rect=hero.getBoundingClientRect();px=((event.clientX-rect.left)/rect.width-.5)*2;py=((event.clientY-rect.top)/rect.height-.5)*2;},{passive:true});hero.addEventListener('pointerleave',()=>{px=0;py=0;});
  const readScroll=()=>{if(reduced.matches){scrollTarget=0;return;}const rect=hero.getBoundingClientRect();scrollTarget=Math.max(0,Math.min(1,-rect.top/Math.max(rect.height*.72,1)));};readScroll();window.addEventListener('scroll',readScroll,{passive:true});
  document.addEventListener('visibilitychange',()=>{update();sync();});
  reduced.addEventListener?.('change',()=>{paused=reduced.matches;readScroll();update();sync();});
  new MutationObserver(()=>{update();sync();}).observe(document.body,{attributes:true,attributeFilter:['class']});
  if('IntersectionObserver'in window)new IntersectionObserver(([entry])=>{visible=entry.isIntersecting&&entry.intersectionRatio>0;update();sync();},{threshold:[0,.001]}).observe(hero);
  if('ResizeObserver'in window)new ResizeObserver(resize).observe(stage);else window.addEventListener('resize',resize,{passive:true});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;update();sync();stage.classList.remove('sculpture-ready');canvas.style.display='none';if(control)control.hidden=true;});
})();
