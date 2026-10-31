'use strict';
window.Arcadia3D = (() => {
  const $ = selector => document.querySelector(selector);
  let scene, renderer, camera, controls, model, sun, hemisphere, animationId;
  let readyPromise, active=false, ready=false, selected='world', mode='orbit';
  let lastTime=0, elapsed=0, frame=0, labelsVisible=true;
  let transition=null, yaw=0, pitch=0, drag=null, pointerOrigin=null, miniMapBase;
  const keys=new Set();
  const labels=new Map();
  const scriptPromises=new Map();
  const speeds={slow:8,normal:35,fast:120,world:450};
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer=matchMedia('(pointer:coarse)').matches;

  function loadScript(path) {
    if(scriptPromises.has(path)) return scriptPromises.get(path);
    const promise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=path;
      script.onload=resolve;
      script.onerror=()=>{script.remove();scriptPromises.delete(path);reject(new Error('无法加载 '+path));};
      document.head.append(script);
    });
    scriptPromises.set(path,promise);
    return promise;
  }
  function renderLoading(title,description,retry=false) {
    const loading=$('#world3dLoading');
    loading.hidden=false;
    loading.replaceChildren();
    const wrap=document.createElement('div');
    if(!retry) {const mark=document.createElement('span');mark.className='orbit-mark';wrap.append(mark);}
    const strong=document.createElement('strong');strong.textContent=title;
    const p=document.createElement('p');p.textContent=description;wrap.append(strong,p);
    if(retry) {const button=document.createElement('button');button.textContent='重新载入 3D 世界';button.onclick=()=>location.reload();wrap.append(button);}
    loading.append(wrap);
  }
  async function initialize() {
    renderLoading('让远方，有了形状','正在构建地形、河流与十五处聚落…');
    await loadScript('vendor/three.min.js');
    await loadScript('vendor/OrbitControls.js');
    await loadScript('world3d-model.js?v=20261031-detail5');
    const THREE=window.THREE;
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,logarithmicDepthBuffer:true,powerPreference:'high-performance'});
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    const stage=$('#world3dStage');
    renderer.domElement.setAttribute('aria-label','阿卡迪亚三维场景，左键拖动旋转，WASD 或方向键平移，滚轮缩放。');
    stage.append(renderer.domElement);
    scene=new THREE.Scene();
    scene.background=new THREE.Color('#cadbd6');
    scene.fog=new THREE.Fog('#cadbd6',10000,23000);
    camera=new THREE.PerspectiveCamera(46,1,.3,28000);
    controls=new window.ArcadiaOrbitControls(camera,renderer.domElement);
    controls.enableDamping=true;controls.dampingFactor=.085;
    controls.minDistance=3;controls.maxDistance=15000;
    controls.maxPolarAngle=Math.PI*.49;
    controls.screenSpacePanning=true;
    controls.mouseButtons.RIGHT=null;
    controls.target.set(0,0,0);
    hemisphere=new THREE.HemisphereLight('#e5f2ed','#827052',1.65);
    sun=new THREE.DirectionalLight('#fff1d2',2.6);
    sun.position.set(-700,1200,650);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);
    sun.shadow.camera.near=1;sun.shadow.camera.far=4500;
    sun.shadow.normalBias=.6;sun.shadow.bias=-.00015;
    scene.add(hemisphere,sun,sun.target);
    // Yield once so the loading state paints before deterministic mesh generation.
    await new Promise(resolve=>requestAnimationFrame(resolve));
    model=window.ArcadiaWorldModel.build(THREE,window.ARCADIA);
    scene.add(model.root);
    createLabels();
    connectControls();
    new ResizeObserver(resize).observe(stage);
    setLighting('day');
    setQuality(coarsePointer?'light':'balanced');
    ready=true;
    $('#world3dLoading').hidden=true;
    resize();
    visit('world',false);
    updateReadout();
    renderer.domElement.addEventListener('webglcontextlost',event=>{
      event.preventDefault();pause();ready=false;
      renderLoading('3D 显示已暂停','显卡连接已重置，请重新载入页面恢复场景。',true);
    });
    return true;
  }
  async function activate(id) {
    active=true;
    if(!readyPromise) readyPromise=initialize();
    try {
      await readyPromise;
      if(!active) return;
      resize();
      if(id) visit(id,false);
      start();
    } catch(error) {
      console.error('Arcadia 3D initialization failed',error);
      renderLoading('暂时无法开启 3D 场景','请使用支持 WebGL 的浏览器，并确认已启用硬件加速。'+error.message,true);
    }
  }
  function start() {
    if(animationId||!active||!ready||document.hidden) return;
    lastTime=performance.now();
    animationId=requestAnimationFrame(animate);
  }
  function pause() {
    if(animationId) cancelAnimationFrame(animationId);
    animationId=0;keys.clear();drag=null;
  }
  function deactivate() {
    active=false;pause();
    if(document.pointerLockElement===renderer?.domElement) document.exitPointerLock();
    $('#world3dShell').classList.remove('expanded');
    $('#world3dExpand').setAttribute('aria-pressed','false');
  }
  function resize() {
    if(!renderer) return;
    const stage=$('#world3dStage'),width=stage.clientWidth,height=stage.clientHeight;
    if(!width||!height) return;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
  }
  function updateOrbitFromCamera() {
    const direction=new THREE.Vector3();camera.getWorldDirection(direction);
    yaw=Math.atan2(-direction.x,-direction.z);pitch=Math.asin(direction.y);
  }
  function setMode(next) {
    if(!ready) return;
    transition=null;keys.clear();mode=next;
    controls.enabled=mode==='orbit';
    if(mode==='fly') updateOrbitFromCamera();
    else {
      if(document.pointerLockElement===renderer.domElement) document.exitPointerLock();
      const direction=new THREE.Vector3();camera.getWorldDirection(direction);
      controls.target.copy(camera.position).addScaledVector(direction,Math.min(100,Math.max(12,camera.position.y*.8)));
      controls.update();
    }
    $('#world3dShell').classList.toggle('fly-mode',mode==='fly');
    $('#world3dCrosshair').hidden=mode!=='fly';
    $('#world3dSpeedWrap').hidden=mode!=='fly';
    $('#world3dLock').hidden=mode!=='fly'||coarsePointer;
    document.querySelectorAll('[data-camera-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.cameraMode===mode)));
    $('#world3dHint').textContent=mode==='fly'?
      (coarsePointer?'拖动转头 · 方向键移动 · 升降按钮改变高度':'WASD 移动 · Q/E 升降 · Shift 加速 · 拖动转头'):
      (coarsePointer?'单指旋转 · 双指缩放和平移 · 点击地名抵达':'左键旋转 · WASD / 方向键平移 · Shift 加速 · 滚轮缩放');
    $('#world3dStage').focus({preventScroll:true});
  }
  function visit(id,animateMove=true,close=false) {
    if(!ready) return;
    if(id!=='world'&&!model.places.has(id)) return;
    if(mode!=='orbit') setMode('orbit');
    selected=id;
    let target,position;
    const place=model.places.get(id);
    if(place) {
      const radius=place.radius;
      const targetHeight=close?5:Math.min(20,radius*.12);
      target=new THREE.Vector3(place.x,place.y+targetHeight,place.z);
      const distance=close?Math.max(16,radius*.46):radius*1.7;
      position=target.clone().add(new THREE.Vector3(distance*.78,close?distance*.27:distance*.82,distance));
      if(id==='goblin'&&close) {
        target.set(place.x,place.y+1.8,place.z+22);
        position.set(place.x,place.y+2.4,place.z+44);
      }
    } else {
      const b=model.bounds;
      target=new THREE.Vector3((b.minX+b.maxX)/2,0,(b.minZ+b.maxZ)/2);
      const span=Math.max(b.maxX-b.minX,(b.maxZ-b.minZ)*camera.aspect);
      const distance=span/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect)*1.2;
      position=target.clone().add(new THREE.Vector3(.23,.85,.48).normalize().multiplyScalar(distance));
    }
    if(animateMove&&!reducedMotion) transition={from:camera.position.clone(),to:position,fromTarget:controls.target.clone(),target,start:performance.now()};
    else {transition=null;camera.position.copy(position);controls.target.copy(target);controls.update();}
    $('#world3dDestination').value=id;
    updateCard(place);
    labels.forEach((entry,key)=>entry.button.classList.toggle('selected',key===id));
    drawMiniMap();
    $('#world3dStage').focus({preventScroll:true});
  }
  function updateCard(place) {
    const data=window.ARCADIA.locations.find(p=>p.id===place?.id);
    $('#world3dPlaceEn').textContent=data?.en||'A WORLD TO WANDER';
    $('#world3dPlaceName').textContent=place?.name||'阿卡迪亚全境';
    $('#world3dPlaceText').textContent=data?data.features.slice(0,3).join(' · '):'从沙德兰的四间小屋，到四季永驻的山巅。十五处远方，沿河流与古道相连。';
    $('#world3dReadPlace').hidden=!place;
    $('#world3dCloseView').hidden=!place;
    $('#world3dStart').textContent=place?'从这里飞行 ↗':'从沙德兰出发 ↗';
  }
  function createLabels() {
    const layer=$('#world3dLabels');
    const select=$('#world3dDestination');
    for(const data of window.ARCADIA.locations) {
      const place=model.places.get(data.id);
      const button=document.createElement('button');
      button.className='world3d-label';button.dataset.region=data.region;
      button.setAttribute('aria-label','前往 '+data.name);
      const dot=document.createElement('small');button.append(dot,place.name);
      button.addEventListener('click',()=>visit(data.id));layer.append(button);
      const height=Math.max(...data.plan.items.map(item=>item[6]))+7;
      labels.set(data.id,{button,point:new THREE.Vector3(place.x,place.y+height,place.z)});
      const option=document.createElement('option');option.value=data.id;option.textContent=data.name;select.append(option);
    }
  }
  const labelVector={value:null};
  function positionLabels() {
    if(!labelsVisible) return;
    const width=$('#world3dStage').clientWidth,height=$('#world3dStage').clientHeight;
    const vector=labelVector.value||(labelVector.value=new THREE.Vector3());
    const occupied=[];
    // Selected location is laid out first, then remaining labels in stable atlas order.
    const entries=[...labels.entries()].sort((a,b)=>(b[0]===selected)-(a[0]===selected));
    for(const [id,entry] of entries) {
      vector.copy(entry.point).project(camera);
      const x=(vector.x*.5+.5)*width,y=(-vector.y*.5+.5)*height;
      const distance=camera.position.distanceTo(entry.point);
      let visible=vector.z>-1&&vector.z<1&&x>35&&x<width-35&&y>70&&y<height-55;
      if(mode==='fly'&&distance<25) visible=false;
      if(visible&&id!==selected&&occupied.some(p=>Math.abs(x-p.x)<100&&Math.abs(y-p.y)<27)) visible=false;
      entry.button.hidden=!visible;
      if(visible) {entry.button.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px) translate(-50%,-100%)`;occupied.push({x,y});}
    }
  }
  function setLighting(value) {
    if(!scene) return;
    const evening=value==='evening';
    scene.background.set(evening?'#d8bda0':'#cadbd6');scene.fog.color.copy(scene.background);
    sun.color.set(evening?'#ffcf91':'#fff1d2');sun.intensity=2.6;
    hemisphere.intensity=evening?1.25:1.65;
    hemisphere.color.set(evening?'#c9c7de':'#e5f2ed');
    $('#world3dLight').value=value;
  }
  function setQuality(value) {
    if(!renderer) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio,value==='high'?2:value==='light'?1:1.5));
    renderer.shadowMap.enabled=value!=='light';
    // All authored details are retained in every quality mode.
    $('#world3dQuality').value=value;resize();
  }
  function drawMiniMap() {
    if(!model||!camera) return;
    const canvas=$('#world3dMiniMap'),ctx=canvas.getContext('2d');
    const width=canvas.width,height=canvas.height;
    const b=model.bounds,spanX=b.maxX-b.minX,spanZ=b.maxZ-b.minZ;
    const px=x=>(x-b.minX)/spanX*width,pz=z=>(z-b.minZ)/spanZ*height;
    if(!miniMapBase) {
      miniMapBase=document.createElement('canvas');miniMapBase.width=width;miniMapBase.height=height;
      const base=miniMapBase.getContext('2d');
      base.fillStyle='#7ca8ab';base.fillRect(0,0,width,height);
      base.save();base.beginPath();
      model.mainland.forEach(([x,z],i)=>i?base.lineTo(px(x),pz(z)):base.moveTo(px(x),pz(z)));
      base.closePath();base.clip();base.fillStyle='#d9c49a';base.fillRect(0,0,width,height);
      base.fillStyle='#a3b495';
      for(let y=0;y<height;y+=3) for(let x=0;x<width;x+=3) {
        if(model.isPlains(b.minX+x/width*spanX,b.minZ+y/height*spanZ)) base.fillRect(x,y,3,3);
      }
      base.fillStyle='#7ca8ab';
      for(const polygon of [model.northBay,model.southBay]) {
        base.beginPath();polygon.forEach(([x,z],i)=>i?base.lineTo(px(x),pz(z)):base.moveTo(px(x),pz(z)));base.closePath();base.fill();
      }
      base.strokeStyle='#7ca8ab';
      for(const path of model.waterPaths) {
        base.lineWidth=Math.max(1,path.width/spanX*width*2);base.beginPath();
        path.points.forEach(([x,z],i)=>i?base.lineTo(px(x),pz(z)):base.moveTo(px(x),pz(z)));base.stroke();
      }
      base.strokeStyle='#b29872';base.lineWidth=.8;
      for(const path of model.roads) {base.beginPath();path.forEach(([x,z],i)=>i?base.lineTo(px(x),pz(z)):base.moveTo(px(x),pz(z)));base.stroke();}
      base.restore();
    }
    ctx.drawImage(miniMapBase,0,0);
    for(const [id,p] of model.places) {
      ctx.beginPath();ctx.arc(px(p.x),pz(p.z),id===selected?4:2.3,0,Math.PI*2);ctx.fillStyle=id===selected?'#f7f1d7':'#5e6753';ctx.fill();
      if(id===selected) {ctx.strokeStyle='#365b4c';ctx.lineWidth=1.3;ctx.stroke();}
    }
    const dir=new THREE.Vector3();camera.getWorldDirection(dir);
    const x=Math.max(5,Math.min(width-5,px(camera.position.x))),z=Math.max(5,Math.min(height-5,pz(camera.position.z)));
    ctx.save();ctx.translate(x,z);ctx.rotate(Math.atan2(dir.x,-dir.z));ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,5);ctx.lineTo(0,3);ctx.lineTo(-4,5);ctx.closePath();ctx.fillStyle='#334f45';ctx.fill();ctx.strokeStyle='#fff5da';ctx.lineWidth=1;ctx.stroke();ctx.restore();
  }
  function updateReadout() {
    if(!camera) return;
    $('#world3dReadout').textContent=`X ${Math.round(camera.position.x)}  ·  Z ${Math.round(camera.position.z)}  ·  H ${Math.round(camera.position.y)} m`;
  }
  function stopForInteraction() { transition=null; }
  function connectControls() {
    const canvas=renderer.domElement;
    controls.addEventListener('start',stopForInteraction);
    canvas.addEventListener('pointerdown',event=>{
      if(event.button===2) {event.preventDefault();event.stopImmediatePropagation();}
    },true);
    canvas.addEventListener('pointerdown',event=>{
      $('#world3dStage').focus({preventScroll:true});
      pointerOrigin={x:event.clientX,y:event.clientY};
      if(mode!=='fly'||event.button!==0) return;
      drag={id:event.pointerId,x:event.clientX,y:event.clientY};
      canvas.setPointerCapture(event.pointerId);$('#world3dStage').focus({preventScroll:true});
    });
    canvas.addEventListener('pointermove',event=>{
      if(mode!=='fly') return;
      const locked=document.pointerLockElement===canvas;
      if(!locked&&(!drag||drag.id!==event.pointerId)) return;
      const dx=locked?event.movementX:event.clientX-drag.x;
      const dy=locked?event.movementY:event.clientY-drag.y;
      yaw-=dx*.003;pitch=Math.max(-1.52,Math.min(1.52,pitch-dy*.003));
      if(drag) {drag.x=event.clientX;drag.y=event.clientY;}
    });
    canvas.addEventListener('pointerup',event=>{
      drag=null;
      if(mode!=='orbit'||event.button!==0||!pointerOrigin) return;
      if(Math.hypot(event.clientX-pointerOrigin.x,event.clientY-pointerOrigin.y)>4) return;
      const rect=canvas.getBoundingClientRect();
      const pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
      const raycaster=new THREE.Raycaster();raycaster.setFromCamera(pointer,camera);
      const hit=raycaster.intersectObjects(model.pickables,false)[0];
      const id=hit?.object.userData.items?.[hit.instanceId]?.place;
      if(id&&id!==selected) visit(id);
    });
    canvas.addEventListener('pointercancel',()=>{drag=null;pointerOrigin=null;keys.clear();});
    canvas.addEventListener('contextmenu',event=>event.preventDefault());
    document.addEventListener('keydown',event=>{
      if(!active||!ready||document.querySelector('dialog[open]')) return;
      if(event.code==='Escape') {
        keys.clear();$('#world3dHelp').hidden=true;
        $('#world3dShell').classList.remove('expanded');$('#world3dExpand').setAttribute('aria-pressed','false');resize();
        if(mode==='fly') setMode('orbit');return;
      }
      if(event.target.closest('input,select,textarea,[contenteditable="true"]')) return;
      if(event.ctrlKey||event.metaKey||event.altKey) return;
      const movement=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'];
      if(movement.includes(event.code)||(mode==='fly'&&['KeyQ','KeyE'].includes(event.code))) {
        event.preventDefault();transition=null;keys.add(event.code);
      }
    });
    document.addEventListener('keyup',event=>keys.delete(event.code));
    window.addEventListener('blur',()=>{keys.clear();drag=null;});
    document.addEventListener('visibilitychange',()=>document.hidden?pause():start());
    document.querySelectorAll('[data-flight-key]').forEach(button=>{
      button.addEventListener('pointerdown',event=>{event.preventDefault();keys.add(button.dataset.flightKey);button.setPointerCapture(event.pointerId);});
      const release=()=>keys.delete(button.dataset.flightKey);
      button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
    });
    $('#world3dMiniMap').addEventListener('click',event=>{
      const rect=event.target.getBoundingClientRect();
      const b=model.bounds;
      const x=b.minX+(event.clientX-rect.left)/rect.width*(b.maxX-b.minX);
      const z=b.minZ+(event.clientY-rect.top)/rect.height*(b.maxZ-b.minZ);
      const nearest=[...model.places.values()].sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];
      visit(nearest.id);
    });
    document.querySelectorAll('[data-camera-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.cameraMode)));
    $('#world3dDestination').addEventListener('change',event=>visit(event.target.value));
    $('#world3dLight').addEventListener('change',event=>setLighting(event.target.value));
    $('#world3dQuality').addEventListener('change',event=>setQuality(event.target.value));
    $('#world3dOverview').addEventListener('click',()=>visit('world'));
    $('#world3dCloseView').addEventListener('click',()=>visit(selected,true,true));
    $('#world3dStart').addEventListener('click',()=>{
      visit(selected==='world'?'sadland':selected,false,true);setMode('fly');
    });
    $('#world3dReadPlace').addEventListener('click',()=>{
      keys.clear();window.dispatchEvent(new CustomEvent('arcadia:open-place',{detail:{id:selected}}));
    });
    $('#world3dLabelsToggle').addEventListener('click',event=>{
      labelsVisible=!labelsVisible;$('#world3dLabels').hidden=!labelsVisible;event.currentTarget.setAttribute('aria-pressed',String(labelsVisible));
    });
    $('#world3dExpand').addEventListener('click',event=>{
      const expanded=$('#world3dShell').classList.toggle('expanded');event.currentTarget.setAttribute('aria-pressed',String(expanded));resize();
    });
    $('#world3dHelpToggle').addEventListener('click',()=>{$('#world3dHelp').hidden=!$('#world3dHelp').hidden;});
    $('#world3dHelpClose').addEventListener('click',()=>{$('#world3dHelp').hidden=true;});
    $('#world3dLock').addEventListener('click',async()=>{
      try {await canvas.requestPointerLock();$('#world3dStage').focus({preventScroll:true});} catch {$('#world3dHint').textContent='当前浏览器可使用拖动转头，WASD 移动。';}
    });
  }
  function panOrbit(delta) {
    const forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
    const right=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
    if(!forward&&!right) return;
    const across=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);across.y=0;across.normalize();
    const ahead=new THREE.Vector3(across.z,0,-across.x);
    const speed=THREE.MathUtils.clamp(camera.position.distanceTo(controls.target)*.55,8,1800);
    const boost=keys.has('ShiftLeft')||keys.has('ShiftRight')?3:1;
    const offset=ahead.multiplyScalar(forward).addScaledVector(across,right).normalize().multiplyScalar(speed*boost*delta);
    const b=model.bounds;
    offset.x=THREE.MathUtils.clamp(controls.target.x+offset.x,b.minX,b.maxX)-controls.target.x;
    offset.z=THREE.MathUtils.clamp(controls.target.z+offset.z,b.minZ,b.maxZ)-controls.target.z;
    controls.target.add(offset);camera.position.add(offset);
  }
  function fly(delta) {
    const direction=new THREE.Vector3();
    camera.rotation.set(pitch,yaw,0,'YXZ');
    const forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
    const right=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
    const up=Number(keys.has('KeyE'))-Number(keys.has('KeyQ'));
    camera.getWorldDirection(direction);
    const velocity=direction.multiplyScalar(forward).add(new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)).multiplyScalar(right));
    velocity.y+=up;
    const speed=speeds[$('#world3dSpeed').value]*(keys.has('ShiftLeft')||keys.has('ShiftRight')?3:1);
    if(velocity.lengthSq()>0) camera.position.addScaledVector(velocity.normalize(),speed*delta);
    camera.position.x=THREE.MathUtils.clamp(camera.position.x,model.bounds.minX,model.bounds.maxX);
    camera.position.z=THREE.MathUtils.clamp(camera.position.z,model.bounds.minZ,model.bounds.maxZ);
    camera.position.y=THREE.MathUtils.clamp(camera.position.y,.6,9500);
  }
  function animate(now) {
    animationId=0;
    if(!active||!ready||document.hidden) return;
    const delta=Math.min((now-lastTime)/1000,.05);lastTime=now;elapsed+=delta;frame++;
    const modalOpen=!!document.querySelector('dialog[open]');
    if(modalOpen) keys.clear();
    if(transition) {
      const t=Math.min(1,(now-transition.start)/1250),ease=t*t*(3-2*t);
      camera.position.lerpVectors(transition.from,transition.to,ease);
      controls.target.lerpVectors(transition.fromTarget,transition.target,ease);
      if(t===1) transition=null;
    }
    if(mode==='orbit') {if(!modalOpen) panOrbit(delta);controls.update();} else if(!modalOpen) fly(delta);
    const near=mode==='orbit'?THREE.MathUtils.clamp(camera.position.distanceTo(controls.target)*.002,.15,30):THREE.MathUtils.clamp(camera.position.y*.001,.15,10);
    if(Math.abs(camera.near-near)>.02) {camera.near=near;camera.updateProjectionMatrix();}
    if(!reducedMotion) model.animated.forEach(update=>update(elapsed));
    const target=mode==='orbit'?controls.target:camera.position;
    const radius=mode==='orbit'?Math.min(1950,Math.max(85,camera.position.distanceTo(target)*.75)):130;
    const shadow=sun.shadow.camera;
    shadow.left=-radius;shadow.right=radius;shadow.top=radius;shadow.bottom=-radius;shadow.updateProjectionMatrix();
    sun.target.position.copy(target);
    const evening=$('#world3dLight').value==='evening';
    sun.position.copy(target).add(new THREE.Vector3(-900,evening?650:1400,750));
    renderer.render(scene,camera);
    if(frame%2===0) positionLabels();
    if(frame%12===0) {drawMiniMap();updateReadout();}
    animationId=requestAnimationFrame(animate);
  }
  return {activate,deactivate,visit};
})();
