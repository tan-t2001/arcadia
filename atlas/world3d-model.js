/* Arcadia's explorable, meter-scale interpretation of world.js and map V3. */
'use strict';
window.ArcadiaWorldModel = (() => {
  const placements = {
    sadland: [-80, 320], capital: [-100, -420], cab: [-780, 650],
    fishing: [600, -880], papyrus: [440, 100], quarry: [-700, -140],
    pyramid: [-1130, -400], oasis: [-650, -820],
    'desert-fort': [650, 430], 'plains-fort': [808, 430],
    winery: [1110, -250], residential: [1210, -100], rainbow: [1320, -100],
    temple: [1600, -2050], goblin: [-2550, 1850]
  };
  const bounds = { minX: -3700, maxX: 3400, minZ: -3400, maxZ: 3100 };
  // The paper atlas compresses distances. This coastline defines the actual land.
  const mainlandPoints = [
    [-3020,2070],[-3120,1690],[-2930,1370],[-3260,1080],[-3160,500],
    [-2900,80],[-3050,-400],[-2740,-1020],[-2850,-1380],[-2530,-1870],
    [-2150,-2000],[-2060,-2400],[-1570,-2680],[-1100,-2580],[-700,-2860],
    [-200,-2700],[350,-2830],[830,-2560],[1190,-2870],[1670,-2900],
    [2000,-2690],[2340,-2800],[2720,-2420],[2660,-2050],[2970,-1700],
    [2760,-1230],[2920,-780],[2720,-260],[2840,250],[2580,650],[2610,1010],
    [2260,1330],[2020,1250],[1760,1590],[1320,1740],[1100,1930],[750,2100],
    [450,1900],[100,2300],[-300,2240],[-700,2530],[-1100,2330],[-1500,2590],
    [-1990,2510],[-2280,2670],[-2740,2430]
  ];
  const colors = {
    sand: '#d8b681', pale: '#ecd6a7', trim: '#b48b58', dark: '#554332',
    wood: '#995a38', oak: '#66513c', plaster: '#ded4b8', stone: '#8d9993',
    white: '#e5e5d9', blue: '#426d92', water: '#64b5b0', grass: '#78965d',
    leaf: '#52794a', lightLeaf: '#8ca55c', orange: '#c88642', snow: '#e2ece8',
    iron: '#3c4848', gold: '#caa45b', window: '#465d5b', light: '#f7ce83'
  };
  const northBay = [[-1100,-4000],[500,-4000],[500,-2600],[600,-1950],[670,-1450],[670,-1050],[570,-950],[570,-800],
    [470,-710],[300,-680],[270,-600],[255,-475],[245,-355],[150,-300],[110,-310],
    [65,-500],[65,-600],[-420,-650],[-520,-780],[-580,-1000],[-700,-1600],[-900,-2100],[-1100,-2600]];
  const southBay = [[-900,800],[-850,715],[-800,685],[-700,688],[-570,650],
    [-380,605],[-220,620],[-40,535],[100,570],[360,620],[700,710],
    [1000,970],[1200,1600],[1000,2700],[700,4000],[-1500,4000],[-1300,2000],[-1050,1450]];
  const riverPoints = [[1420,-2420],[1450,-2180],[1500,-1990],[1300,-1840],
    [1050,-1690],[870,-1510],[790,-1100],[760,-900],[830,-700],[700,-555],
    [600,-350],[565,-70],[506,110],[610,270],[730,430],[800,610],[700,760]];
  const eastRiverPoints = [[830,-700],[1120,-600],[1480,-530],[1540,-280],
    [1550,30],[1430,270],[1180,490],[960,510],[730,430]];

  function build(THREE, world) {
    const root = new THREE.Group();
    root.name = 'Arcadia · connected world';
    const batches = new Map();
    const places = new Map();
    const animated = [];
    const features = [];
    const origin = { x: 0, y: 0, z: 0, rotation: 0, id: null };
    let seed = 73103;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const mix = (a, b, t) => a + (b - a) * t;
    const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x-a)/(b-a))); return t*t*(3-2*t); };
    const geometries = {
      box: new THREE.BoxGeometry(1, 1, 1),
      cylinder: new THREE.CylinderGeometry(.5, .5, 1, 16),
      cone: new THREE.ConeGeometry(.5, 1, 12),
      pyramid: new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI/4),
      rock: new THREE.IcosahedronGeometry(.5, 1),
      leaf: new THREE.IcosahedronGeometry(.5, 1),
      disk: new THREE.CylinderGeometry(.5,.5,1,24).rotateX(Math.PI/2),
      ring: new THREE.TorusGeometry(.43,.07,6,24),
      pot: new THREE.LatheGeometry([new THREE.Vector2(.18,-.5),new THREE.Vector2(.35,-.4),new THREE.Vector2(.48,0),new THREE.Vector2(.32,.3),new THREE.Vector2(.34,.46),new THREE.Vector2(.26,.5),new THREE.Vector2(.23,.35)],12),
      garden: new THREE.CylinderGeometry(.5,.5,1,24,1,false,-Math.PI/2,Math.PI)
    };
    // A gabled prism, shared by the timber houses and public buildings.
    const roof = new THREE.BufferGeometry();
    roof.setAttribute('position', new THREE.Float32BufferAttribute([
      -.5,0,.5, .5,0,.5, 0,1,.5, .5,0,-.5, -.5,0,-.5, 0,1,-.5,
      -.5,0,-.5, -.5,0,.5, 0,1,.5, -.5,0,-.5, 0,1,.5, 0,1,-.5,
      0,1,-.5, 0,1,.5, .5,0,.5, 0,1,-.5, .5,0,.5, .5,0,-.5,
      -.5,0,-.5, .5,0,-.5, .5,0,.5, -.5,0,-.5, .5,0,.5, -.5,0,.5
    ], 3));
    roof.computeVertexNormals();
    geometries.roof = roof;
    const archShape=new THREE.Shape();
    archShape.moveTo(-.5,-.5);archShape.lineTo(-.5,0);archShape.absarc(0,0,.5,Math.PI,0,true);
    archShape.lineTo(.5,-.5);archShape.lineTo(.33,-.5);archShape.lineTo(.33,0);
    archShape.absarc(0,0,.33,0,Math.PI,false);archShape.lineTo(-.33,-.5);archShape.closePath();
    geometries.arch=new THREE.ExtrudeGeometry(archShape,{depth:1,bevelEnabled:false,curveSegments:10}).translate(0,0,-.5);
    geometries.sail=new THREE.PlaneGeometry(1,1,6,6);
    const cloth=geometries.sail.attributes.position;
    for(let i=0;i<cloth.count;i++) cloth.setZ(i,.2*Math.cos(cloth.getX(i)*Math.PI)*Math.cos(cloth.getY(i)*Math.PI));
    geometries.sail.computeVertexNormals();
    const solid = new THREE.MeshStandardMaterial({ roughness: .88, metalness: .02, flatShading: true });
    // Meter-scale joints and wood grain stay crisp when approaching a building.
    // Surface type is per instance, so leaves and water never acquire masonry.
    solid.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float surfaceKind;\nvarying float vSurfaceKind;\nvarying vec3 vSurfacePosition;\nvarying vec3 vSurfaceNormal;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        vSurfaceKind=surfaceKind;
        vSurfacePosition=position*vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
        vSurfaceNormal=normal;`);
      shader.fragmentShader='varying float vSurfaceKind;\nvarying vec3 vSurfacePosition;\nvarying vec3 vSurfaceNormal;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 face=abs(vSurfaceNormal.x)>.65?vSurfacePosition.zy:vSurfacePosition.xy;
        if(abs(vSurfaceNormal.y)>.8) face=vSurfacePosition.xz;
        float grain=fract(sin(dot(floor(face*48.0),vec2(127.1,311.7)))*43758.5453);
        float fade=1.0-smoothstep(.04,.3,max(fwidth(face.x),fwidth(face.y)));
        if(vSurfaceKind>.5 && vSurfaceKind<1.5) {
          float row=floor(face.y/.65);
          vec2 brick=vec2(fract(face.x/1.65+mod(row,2.0)*.5),fract(face.y/.65));
          vec2 seamWidth=max(fwidth(brick)*.65,vec2(.012,.022));
          float joint=min(smoothstep(0.0,seamWidth.x,brick.x),smoothstep(0.0,seamWidth.y,brick.y));
          float block=fract(sin(dot(vec2(floor(face.x/1.65+mod(row,2.0)*.5),row),vec2(12.98,78.23)))*43758.54);
          diffuseColor.rgb*=mix(1.0,(.79+.21*joint)*(.95+.09*block)+grain*.025,fade);
        } else if(vSurfaceKind>1.5) {
          float fiber=sin(face.y*55.0+sin(face.x*7.0)*3.0)*.035;
          diffuseColor.rgb*=mix(1.0,.96+fiber+grain*.06,fade);
          if(vSurfaceKind>2.5) diffuseColor.rgb*=mix(1.0,.83+.17*smoothstep(0.0,.035,fract(face.y/.45)),fade);
        }`);
    };
    solid.customProgramCacheKey=()=> 'arcadia-surfaces-v2';
    const fabric=solid.clone();fabric.side=THREE.DoubleSide;fabric.onBeforeCompile=solid.onBeforeCompile;
    fabric.customProgramCacheKey=solid.customProgramCacheKey;
    const stoneColors=new Set([colors.sand,colors.pale,colors.trim,colors.stone,colors.plaster,colors.white,'#7d8b72','#a1ab90','#6b7370']);
    const timberColors=new Set([colors.wood,colors.oak]);
    const glow = new THREE.MeshBasicMaterial();
    const temp = new THREE.Object3D();
    const vertexColor = new THREE.Color();

    function add(shape, color, x, y, z, w, h, d, rotation = 0, luminous = false) {
      const key = shape + (luminous ? '-glow' : '');
      if (!batches.has(key)) batches.set(key, { shape, luminous, items: [] });
      const cos = Math.cos(origin.rotation), sin = Math.sin(origin.rotation);
      const item = {
        x: origin.x + x*cos + z*sin, y: origin.y+y, z: origin.z+z*cos-x*sin,
        w, h, d, rotation: rotation+origin.rotation, color, place: origin.id
      };
      batches.get(key).items.push(item);
      return item;
    }
    const box = (color,x,y,z,w,h,d,r=0) => add('box',color,x,y,z,w,h,d,r);
    const cylinder = (color,x,y,z,w,h,d=w) => add('cylinder',color,x,y,z,w,h,d);
    function beam(color, a, b, width=.35) {
      const center = new THREE.Vector3().addVectors(a,b).multiplyScalar(.5);
      const item = box(color,center.x,center.y,center.z,width,a.distanceTo(b),width);
      item.quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
      item.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),origin.rotation));
    }
    function strip(color, x1,z1,x2,z2,width,y=.08,height=.14) {
      box(color,(x1+x2)/2,y,(z1+z2)/2,width,height,Math.hypot(x2-x1,z2-z1),Math.atan2(x2-x1,z2-z1));
    }
    function fence(x,z,w,d,y=0,material=colors.wood) {
      for (const side of [-1,1]) {
        box(material,x,y+1,z+side*d/2,w,.15,.18);
        box(material,x+side*w/2,y+1,z,.18,.15,d);
        for(let i=0;i<=w;i+=3) box(material,x-w/2+i,y+.6,z+side*d/2,.18,1.2,.18);
        for(let i=0;i<=d;i+=3) box(material,x+side*w/2,y+.6,z-d/2+i,.18,1.2,.18);
      }
    }
    function pool(x,z,w,d,y=0) {
      cylinder(colors.pale,x,y+.15,z,w+.9,.35,d+.9);
      cylinder(colors.water,x,y+.36,z,w,.12,d);
    }
    function tree(x,z,size=6,kind='acacia',y=0,detail=true) {
      const trunk = kind==='acacia' ? '#72614f' : colors.oak;
      cylinder(trunk,x,y+size*.36,z,size*.1,size*.72);
      if(kind==='pine'||kind==='snow') {
        for(let i=0;i<3;i++) add('cone',kind==='snow'?colors.snow:colors.leaf,x,y+size*(.5+i*.18),z,size*(.7-i*.15),size*.5,size*(.7-i*.15));
      } else {
        const leaf = kind==='autumn'?colors.orange:kind==='spring'?'#b1be78':colors.leaf;
        const count=detail?7:3;
        for(let i=0;i<count;i++) {
          const a=i*2.4,spread=size*(i===0?0:.3);
          const bx=x+Math.cos(a)*spread,bz=z+Math.sin(a)*spread,by=y+size*(.8+random()*.18);
          const tint=i%3===0?(kind==='spring'?'#e2b3b5':kind==='autumn'?'#d8a94f':colors.lightLeaf):leaf;
          add('leaf',tint,bx,by,bz,size*.65,size*(kind==='acacia'?.24:.55),size*.6,a);
          if(detail&&i%2===0) beam(trunk,new THREE.Vector3(x,y+size*.43,z),new THREE.Vector3(bx,by,bz),size*.055);
        }
        if(detail) for(let i=0;i<3;i++) {
          const a=i*2.1;beam(trunk,new THREE.Vector3(x,y+.2,z),new THREE.Vector3(x+Math.cos(a)*size*.15,y+.05,z+Math.sin(a)*size*.15),size*.06);
        }
      }
    }
    function palm(x,z,size=8,y=0) {
      cylinder(colors.oak,x,y+size*.48,z,.45,size*.96);
      for(let i=0;i<8;i++) {
        const a=i*Math.PI/4;
        add('leaf',i%2?colors.leaf:colors.lightLeaf,x+Math.sin(a)*size*.19,y+size,z+Math.cos(a)*size*.19,.7,.3,size*.65,a);
        add('leaf',colors.leaf,x+Math.sin(a)*size*.4,y+size*.88,z+Math.cos(a)*size*.4,.55,.4,size*.35,a);
      }
    }
    function flowers(x,z,r=2,y=0,count=12,color='#d9b3c7') {
      for(let i=0;i<count;i++) {
        const a=random()*Math.PI*2,d=Math.sqrt(random())*r,px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d;
        add('leaf',colors.leaf,px,y+.23,pz,.5,.5,.5);
        add('leaf',i%4?color:'#f0dfb1',px,y+.5,pz,.35,.22,.35);
      }
    }
    function reeds(x,z,r=2,y=0,count=9) {
      for(let i=0;i<count;i++) {
        const a=random()*Math.PI*2,d=random()*r,px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d,h=.7+random()*1.2;
        cylinder('#83955d',px,y+h/2,pz,.065,h);
        add('leaf',colors.leaf,px+.15,y+h*.7,pz,.45,h*.5,.16,a);
        add('leaf','#947445',px,y+h,pz,.12,.35,.12);
      }
    }
    function planter(x,z,w=2,y=0) {
      box(colors.wood,x,y+.25,z,w,.5,.8);
      for(let i=0;i<3;i++) flowers(x+(i-1)*w*.3,z,w*.2,y+.45,3);
    }
    function lantern(x,y,z) {
      box(colors.iron,x,y+.52,z,.6,.12,.6);box(colors.iron,x,y-.1,z,.52,.12,.52);
      add('box',colors.light,x,y+.2,z,.34,.5,.34,0,true);
      for(const a of [-.22,.22]) for(const b of [-.22,.22]) box(colors.iron,x+a,y+.2,z+b,.045,.6,.045);
      cylinder(colors.iron,x,y+.75,z,.07,.45);
    }
    function barrel(x,z,y=0,size=1) {
      add('rock',colors.wood,x,y+size*.65,z,size,size*1.3,size);
      for(const h of [.25,1.05]) cylinder(colors.iron,x,y+size*h,z,size*.94,.09*size);
      cylinder(colors.oak,x,y+size*1.26,z,size*.77,.1*size);
    }
    function crate(x,z,y=0,size=1.5) {
      box(colors.wood,x,y+size/2,z,size,size,size);
      for(const side of [-1,1]) {
        box(colors.oak,x+side*size*.42,y+size/2,z+size*.51,.12,size,.12);
        box(colors.oak,x,y+size*(side>0?.92:.08),z+size*.51,size,.12,.12);
      }
      beam(colors.oak,new THREE.Vector3(x-size*.4,y+.1,z+size*.52),new THREE.Vector3(x+size*.4,y+size-.1,z+size*.52),.13);
    }
    function vine(x,y,z,length=3) {
      for(let i=0;i<length/.35;i++) add('leaf',i%3?colors.leaf:colors.lightLeaf,x+Math.sin(i*1.8)*.2,y-i*.35,z,.65,.6,.4);
    }
    function pergola(x,z,w,d,y=0) {
      for(const a of [-1,1]) for(const b of [-1,1]) box(colors.wood,x+a*(w/2-.2),y+1.7,z+b*(d/2-.2),.35,3.4,.35);
      box(colors.wood,x,y+3.4,z-d/2,w+.6,.3,.35);
      box(colors.wood,x,y+3.4,z+d/2,w+.6,.3,.35);
      for(let i=0;i<=w;i+=1) box(colors.wood,x-w/2+i,y+3.6,z,.3,.22,d+.8);
    }
    function steps(x,z,width,length,height,y=0,direction=0) {
      const count=Math.max(3,Math.ceil(height/.7));
      for(let i=0;i<count;i++) {
        const depth=length/count;
        const along=(i+.5)*depth-length/2;
        const sy=(count-i)*height/count;
        box(colors.pale,x+Math.sin(direction)*along,y+sy/2,z+Math.cos(direction)*along,width,sy,depth+.03,direction);
      }
    }
    function house(x,z,w,d,h=5,style='sand',y=0,flat=false) {
      const plain = style==='plain'||style==='church';
      const wallColor=style==='white'?colors.white:style==='church'?colors.stone:plain?'#c5b38f':colors.sand;
      box(plain?colors.stone:colors.trim,x,y+.25,z,w+.5,.5,d+.5);
      box(wallColor,x,y+h/2,z,w,h,d);
      if(plain) {
        for(const side of [-1,1]) {
          for(const pos of [-.45,0,.45]) box(colors.oak,x+pos*w,y+h/2,z+side*(d/2+.03),.28,h,.25);
          box(colors.oak,x,y+h*.5,z+side*(d/2+.05),w,.3,.28);
          box(colors.oak,x+side*w/2,y+h/2,z,.25,h,.3);
        }
      }
      if(plain&&!flat) add('roof','#6b7370',x,y+h,z,w+1,h*.44,d+1);
      else {
        box(plain?colors.oak:colors.pale,x,y+h+.1,z,w+.5,.25,d+.5);
        if(flat&&plain) fence(x,z,w,d,y+h);
        else for(const side of [-1,1]) {
          box(colors.pale,x,y+h+.5,z+side*d/2,w,.8,.35);
          box(colors.pale,x+side*w/2,y+h+.5,z,.35,.8,d);
        }
      }
      for(const side of [-1,1]) {
        const front=z+side*(d/2+.06);
        box(colors.dark,x,y+1.2,front,Math.min(1.4,w*.18),2.4,.13);
        box(plain?colors.oak:colors.pale,x,y+2.5,front,2,.25,.35);
        box(colors.gold,x+.38,y+1.1,front+side*.1,.09,.14,.1);
        for(const dx of [-.83,.83]) box(plain?colors.oak:colors.pale,x+dx,y+1.2,front,.18,2.4,.3);
        for(let i=1;i<=Math.max(2,Math.floor(w/3));i++) {
          const wx=x-w/2+i*w/(Math.max(2,Math.floor(w/3))+1);
          box(colors.window,wx,y+h*.7,front,.8,1,.13);
          box(colors.pale,wx,y+h*.7+.55,front,.95,.15,.2);
          box(colors.oak,wx,y+h*.7,front+side*.1,.07,1,.08);
          box(colors.oak,wx,y+h*.7,front+side*.1,.8,.07,.08);
        }
      }
      if(!plain) {
        pergola(x,z+d/2+1.2,Math.min(w*.65,7),2.4,y);
        add('pot','#af7251',x+w*.36,y+.55,z+d/2+1.3,1,1.1,1);
        add('leaf',colors.lightLeaf,x+w*.36,y+1.3,z+d/2+1.3,.65,1,.65);
      } else planter(x-w*.28,z+d/2+.5,Math.min(w*.3,2.6),y+h*.7-.85);
      lantern(x+Math.min(w*.3,2),y+2.2,z+d/2+.55);
    }
    function dock(x,z,w,d,y=0) {
      box(colors.wood,x,y+.65,z,w,.6,d);
      for(let i=-d/2;i<=d/2;i+=2) box(colors.trim,x,y+.99,z+i,w,.08,.12);
      for(const a of [-1,1]) for(const b of [-1,1]) cylinder(colors.oak,x+a*w*.42,y-.4,z+b*d*.43,.5,4);
      for(const a of [-1,1]) for(const b of [-1,1]) {
        cylinder(colors.oak,x+a*w*.42,y+1.1,z+b*d*.43,.55,1.3);
        add('ring','#d6bd86',x+a*w*.42,y+1.3,z+b*d*.43,.65,.65,.18);
      }
    }
    function boat(x,z,size=10,rotation=0,y=-5.2) {
      add('rock',colors.wood,x,y+1,z,size*.32,size*.23,size,rotation);
      box(colors.dark,x,y+1.3,z,size*.25,.3,size*.7,rotation);
      cylinder(colors.oak,x,y+size*.42,z,.3,size*.75);
      add('sail',colors.pale,x,y+size*.54,z,size*.42,size*.42,size*.4,rotation);
      const dx=Math.cos(rotation)*size*.23,dz=-Math.sin(rotation)*size*.23;
      beam(colors.oak,new THREE.Vector3(x-dx,y+size*.76,z-dz),new THREE.Vector3(x+dx,y+size*.76,z+dz),.15);
      for(const side of [-1,1]) beam('#c4b28c',new THREE.Vector3(x,y+size*.8,z),new THREE.Vector3(x+Math.sin(rotation)*size*.35*side,y+size*.12,z+Math.cos(rotation)*size*.35*side),.055);
    }
    function fountain(x,z,y=0) {
      pool(x,z,9,9,y);
      cylinder(colors.stone,x,y+1.7,z,1.6,3.2);
      cylinder(colors.pale,x,y+2.9,z,4,.4);
      cylinder(colors.water,x,y+3.13,z,3.6,.09);
      cylinder(colors.white,x,y+3.8,z,.65,1.5);
      add('rock',colors.gold,x,y+4.65,z,.9,1.2,.9);
    }
    function pointInPolygon(x,z,polygon) {
      let inside=false;
      for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
        const a=polygon[i],b=polygon[j];
        if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
      }
      return inside;
    }
    function segmentDistance(x,z,a,b) {
      const dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
      return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
    }
    function pathDistance(x,z,path) {
      let result=Infinity;
      for(let i=1;i<path.length;i++) result=Math.min(result,segmentDistance(x,z,path[i-1],path[i]));
      return result;
    }
    const curvePath = points => new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],0,p[1]))).getPoints(Math.max(90,points.length*8)).map(p=>[p.x,p.z]);
    const mainland = new THREE.CatmullRomCurve3(mainlandPoints.map(p=>new THREE.Vector3(p[0],0,p[1])),true,'centripetal').getPoints(240).map(p=>[p.x,p.z]);
    const river=curvePath(riverPoints),eastRiver=curvePath(eastRiverPoints);
    const creek=curvePath([[-80,340],[-75,370],[-95,405],[-70,450],[-25,510],[-40,560]]);
    const waterPaths=[{points:river,width:22},{points:eastRiver,width:16},{points:creek,width:2.5}];
    function waterDistance(x,z) {
      const shore=pathDistance(x,z,mainland);
      let distance=pointInPolygon(x,z,mainland)?shore:-shore;
      for(const polygon of [northBay,southBay]) {
        const edge=pathDistance(x,z,[...polygon,polygon[0]]);
        distance=Math.min(distance,pointInPolygon(x,z,polygon)?-edge:edge);
      }
      for(const path of waterPaths) if(path.width>3) distance=Math.min(distance,pathDistance(x,z,path.points)-path.width);
      return distance;
    }
    const peaks = [
      [-1620,-1030,125,145],[-1530,-760,150,165],[-1700,-420,160,140],
      [-1480,-160,95,130],[-1600,100,145,140],[-1360,380,105,150],
      [900,-620,125,95],[900,-420,155,105],[920,-200,100,90],[940,70,85,100],
      [1100,-1050,100,155],[1320,-1310,135,170],[1480,-1630,150,170],
      [1390,-2470,230,210],[1600,-2250,210,160],[1840,-2080,245,180],[1800,-2340,175,155],
      [1630,700,115,130],[-1770,1180,95,170],[-2050,1430,125,160],
      [-2730,1710,150,170],[-2400,2040,115,155],[-2790,2070,155,180],
      [-2480,-1600,140,220],[2130,-1800,185,200],[2200,650,130,190]
    ];
    function rawHeight(x,z) {
      let height=8+5*Math.sin(x*.004)*Math.cos(z*.005)+2*Math.sin((x+z)*.016);
      for(const [px,pz,h,r] of peaks) {
        const distance=Math.hypot(x-px,z-pz);
        height+=Math.max(0,1-distance/r)**1.3*h+Math.exp(-((distance/(r*1.8))**2))*h*.16;
      }
      height+=Math.max(0,1-Math.hypot(x+650,z+820)/100)*30;
      height+=Math.exp(-(((x-910)/72)**2))*45*smooth(-820,-660,z)*(1-smooth(100,260,z));
      return height;
    }
    function terrainHeight(x,z) {
      let h=rawHeight(x,z);
      for(const location of world.locations) {
        const [px,pz]=placements[location.id];
        const dx=Math.max(0,Math.abs(x-px)-location.plan.w*.55);
        const dz=Math.max(0,Math.abs(z-pz)-location.plan.d*.55);
        const distance=Math.hypot(dx,dz);
        if(distance<32) h=mix(location.id==='oasis'?36:6,h,smooth(0,32,distance));
      }
      const water=waterDistance(x,z);
      h=mix(-4,h,smooth(-5,14,water));
      if(z>=335&&z<=560) {
        const creekDistance=pathDistance(x,z,creek);
        const level=6*(1-smooth(340,535,z));
        h=mix(level-.5,h,smooth(3,15,creekDistance));
      }
      // The quarry is excavated below the surrounding ground, in four benches.
      const qx=x+727,qz=z+162;
      if(Math.abs(qx)<44&&Math.abs(qz)<34) {
        const ring=Math.max(Math.abs(qx)/44,Math.abs(qz)/34);
        h=6-(4-Math.floor(ring*4))*2;
      }
      // Dry quarry bottom is lower than sea level, and locally capped by its floor.
      return h;
    }
    function isPlains(x,z) {
      const segment=riverPoints.findIndex(point=>point[1]>=z);
      let riverX=riverPoints[0][0];
      if(segment>0) {
        const a=riverPoints[segment-1],b=riverPoints[segment];
        riverX=mix(a[0],b[0],(z-a[1])/(b[1]-a[1]));
      } else if(segment<0) riverX=riverPoints[riverPoints.length-1][0];
      const valley=x<-1770+100*Math.sin(z*.004)&&z>1100+(x+2500)*.15+140*Math.sin(x*.004);
      return x>riverX||valley;
    }
    function terrain() {
      const geometry=new THREE.PlaneGeometry(bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ,355,325);
      geometry.rotateX(-Math.PI/2);
      geometry.translate((bounds.minX+bounds.maxX)/2,0,(bounds.minZ+bounds.maxZ)/2);
      const vertices=geometry.attributes.position;
      const terrainColors=new Float32Array(vertices.count*3);
      const sand=new THREE.Color('#c8ac79'),green=new THREE.Color('#738760'),rock=new THREE.Color('#8b8b78');
      for(let i=0;i<vertices.count;i++) {
        const x=vertices.getX(i),z=vertices.getZ(i),height=terrainHeight(x,z);
        vertices.setY(i,height);
        const vegetation=(Number(isPlains(x,z))*4+Number(isPlains(x-40,z))+Number(isPlains(x+40,z))+Number(isPlains(x,z-40))+Number(isPlains(x,z+40)))/8;
        vertexColor.copy(sand).lerp(green,vegetation);
        if(height>23) vertexColor.lerp(rock,smooth(23,100,height)*.8);
        if(waterDistance(x,z)<12) vertexColor.lerp(new THREE.Color('#c6bd97'),.3);
        vertexColor.multiplyScalar(.94+random()*.11);
        vertexColor.toArray(terrainColors,i*3);
      }
      geometry.setAttribute('color',new THREE.BufferAttribute(terrainColors,3));
      geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
      mesh.name='Continuous terrain / rivers / excavated quarry';
      mesh.receiveShadow=true;
      root.add(mesh);
      const waterMaterial=new THREE.MeshStandardMaterial({color:'#468f99',roughness:.32,metalness:.28});
      const waterTime={value:0};
      waterMaterial.onBeforeCompile=shader=>{
        shader.uniforms.uTime=waterTime;
        shader.vertexShader='varying vec2 vWaterPosition;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWaterPosition=(modelMatrix*vec4(position,1.0)).xz;');
        shader.fragmentShader='uniform float uTime;\nvarying vec2 vWaterPosition;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(abs(vWaterPosition.x+727.0)<44.0 && abs(vWaterPosition.y+162.0)<34.0) discard;\nfloat ripple=sin(vWaterPosition.x*.055+vWaterPosition.y*.025+uTime*.7)*sin(vWaterPosition.y*.065-uTime*.5); diffuseColor.rgb+=ripple*.015;');
      };
      const sea=new THREE.Mesh(new THREE.PlaneGeometry(30000,30000),waterMaterial);
      sea.rotation.x=-Math.PI/2;
      sea.position.y=.1;
      sea.name='Connected sea and river surface';
      root.add(sea);
      const creekVertices=[];
      for(let i=1;i<creek.length;i++) {
        const a=creek[i-1],b=creek[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
        const nx=-(b[1]-a[1])/length*3,nz=(b[0]-a[0])/length*3;
        const ay=.16+6*(1-smooth(340,535,a[1])),by=.16+6*(1-smooth(340,535,b[1]));
        creekVertices.push(a[0]-nx,ay,a[1]-nz,a[0]+nx,ay,a[1]+nz,b[0]-nx,by,b[1]-nz,
          a[0]+nx,ay,a[1]+nz,b[0]+nx,by,b[1]+nz,b[0]-nx,by,b[1]-nz);
      }
      const creekGeometry=new THREE.BufferGeometry();
      creekGeometry.setAttribute('position',new THREE.Float32BufferAttribute(creekVertices,3));
      creekGeometry.computeVertexNormals();
      const stream=new THREE.Mesh(creekGeometry,waterMaterial);
      stream.name='Spring creek descending to the southern bay';root.add(stream);
      animated.push(time=>{waterTime.value=time;});
      return mesh;
    }
    const terrainMesh=terrain();
    // Match the rendered triangle surface, including the coarse distant hills.
    function groundHeight(x,z) {
      const gx=THREE.MathUtils.clamp((x-bounds.minX)/(bounds.maxX-bounds.minX)*355,0,354.9999);
      const gz=THREE.MathUtils.clamp((z-bounds.minZ)/(bounds.maxZ-bounds.minZ)*325,0,324.9999);
      const ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,a=iz*356+ix;
      const p=terrainMesh.geometry.attributes.position;
      const ha=p.getY(a),hb=p.getY(a+356),hc=p.getY(a+357),hd=p.getY(a+1);
      return u+v<=1?ha+u*(hd-ha)+v*(hb-ha):hc+(1-u)*(hb-hc)+(1-v)*(hd-hc);
    }

    function sadland() {
      const p=world.locations.find(p=>p.id==='sadland').plan;
      for(const [type,x,z,w,d,,h] of p.items) if(type==='house') house(x+w/2,z+d/2,w,d,h);
      pool(22,19,16,12,-.4);
      strip(colors.water,22,24,22,40,4,.12,.15);
      dock(22,33,10,2,.2);
      tree(11,17,7); tree(33,21,7.5); tree(21,6,6);
      for(const [x,z] of [[8,24],[35,12],[15,30]]) { cylinder(colors.wood,x,.5,z,.65,1); add('rock',colors.lightLeaf,x,1.2,z,1.4,1.3,1.4); }
      for(let i=0;i<26;i++) {
        const a=i/26*Math.PI*2,x=22+Math.cos(a)*(8.5+random()),z=19+Math.sin(a)*(6.5+random());
        add('rock',i%2?colors.trim:colors.pale,x,.15,z,1.4,.7,1,a);
        if(i%3===0) {reeds(x,z,.9,0,5);flowers(x,z,1.3,.02,6,'#d8be71');}
      }
      for(const x of [17.5,26.5]) for(const z of [32,34]) cylinder(colors.wood,x,1.3,z,.22,2);
      for(const z of [32,34]) box(colors.wood,22,2,z,9,.16,.16);
      for(const [x,z] of [[3,18],[39,7],[4,37]]) {
        cylinder('#65815b',x,1.1,z,.5,2.2);cylinder('#78945b',x+.4,1.1,z,.3,.8);
        box('#78945b',x+.2,.75,z,.5,.25,.3);flowers(x+1,z,1.1,0,5,'#cda05e');
      }
    }
    function capital() {
      // High rectangular palace, colonnades, gate pylons and ceremonial stairs.
      box(colors.trim,110,3,89,138,6,104);
      box(colors.pale,110,6.5,89,133,1,99);
      box(colors.sand,110,23,78,108,32,67);
      for(const side of [-1,1]) {
        box(colors.sand,110+side*52,27,110,20,42,24);
        box(colors.pale,110+side*52,48.5,110,22,1.2,26);
        box(colors.gold,110+side*52,44,122.2,11,1.7,.3);
      }
      for(let x=67;x<=154;x+=8) { cylinder(colors.pale,x,21,118,3,27); box(colors.gold,x,34,118,4,1.2,4); }
      box(colors.pale,110,36,115,96,3,14);
      box(colors.pale,110,40,78,111,2,70);
      for(const y of [10,37]) box(colors.iron,110,y,112,104,1.4,.4);
      for(let x=64;x<160;x+=5) box(colors.gold,x,37,112.3,1,.9,.2);
      for(const side of [-1,1]) {
        const x=110+side*52;
        for(const dx of [-6,6]) box(colors.gold,x+dx,28,122.2,.45,28,.2);
        box(colors.iron,x,28,122.3,5,18,.25);
        box(colors.gold,x,29,122.5,.6,12,.2);box(colors.gold,x,32,122.5,3,.6,.2);
        cylinder(colors.wood,x+side*9,32,124,.25,25);
        add('sail',colors.orange,x+side*7.7,41,124,2.5,5,.8);
      }
      steps(110,146,42,30,7);
      for(let x=65;x<165;x+=20) { pool(x,170,9,15); palm(x,195,11); }
      strip(colors.pale,110,184,110,385,15);
      // A hollow oval arena with two open colonnaded tiers and descending seats.
      const cx=339,cz=153,rx=54,rz=37;
      cylinder('#b79b70',cx,.25,cz,rx*2,.5,rz*2);
      for(let i=0;i<48;i++) {
        const a=i/48*Math.PI*2;
        const x=cx+Math.cos(a)*rx,z=cz+Math.sin(a)*rz;
        const tangent=Math.atan2(-Math.cos(a)*rz,-Math.sin(a)*rx);
        for(let tier=0;tier<2;tier++) {
          add('arch',colors.sand,x,5.5+tier*11,z,6.5,10.5,4,tangent);
          box(colors.pale,x,11+tier*11,z,8,1.6,5,tangent);
        }
        for(let seat=0;seat<5;seat++) box(colors.pale,cx+Math.cos(a)*(rx-6-seat*3),9-seat*1.5,cz+Math.sin(a)*(rz-6-seat*2),7,1.3,3,tangent);
        box(colors.pale,x,23.2,z,6.8,1,4,tangent);
        if(i%3===0) {
          cylinder(colors.oak,x,26,z,.25,6);
          const canopy=add('sail','#e5d8b8',cx+Math.cos(a)*(rx-4),27,cz+Math.sin(a)*(rz-4),10,9,1,tangent);
          canopy.quaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,tangent));
        }
      }
      house(310,57,44,38,12);
      for(let tier=0;tier<3;tier++) { const s=17-tier*4; box(colors.pale,310,18+tier*8,57,s,8,s); }
      add('cone',colors.gold,310,40,57,10,9,10);
      for(const area of [[53,236,125,113],[219,260,131,100]]) {
        const [ax,az,w,d]=area;
        for(let row=0;row<5;row++) for(let col=0;col<6;col++) {
          const x=ax+col*w/6+9,z=az+row*d/5+9;
          house(x,z,12+random()*4,12+random()*4,5+random()*5);
          if((row+col)%5===0) {pergola(x,z+10,10,4);crate(x+3,z+11);barrel(x-3,z+11);}
        }
        for(let row=0;row<=5;row++) strip(colors.trim,ax,az+row*d/5,ax+w,az+row*d/5,3);
      }
      house(227,218,32,22,10);
      for(let i=0;i<6;i++) cylinder(colors.pale,214+i*5,7,231,1.6,12);
      house(379,302,30,24,9); house(377,348,28,22,8);
      box('#af755b',379,8,314.1,5,1.3,.2); box('#af755b',379,8,314.2,1.3,5,.2);
      strip(colors.pale,175,225,380,225,10);
      strip(colors.pale,200,200,200,380,10);
      for(let i=0;i<28;i++) palm(30+i*14,390,9+random()*3);
      for(let i=0;i<8;i++) palm(375,235+i*15,9);
      // Port and statue park at the northeastern edge of the same city.
      box(colors.trim,396,-2,85,15,4,150);
      box(colors.pale,396,.15,85,16,.3,150);
      for(let i=0;i<3;i++) {dock(435,32+i*45,63,7,-4);steps(407,32+i*45,6,14,3,-3,Math.PI/2);}
      for(let i=0;i<3;i++) boat(455,48+i*45,22,Math.PI/2);
      cylinder(colors.pale,428,-2,186,18,8);
      for(let level=0;level<4;level++) {
        box(level%2?colors.pale:colors.sand,428,5+level*8,186,16-level*3,8,16-level*3);
        box(colors.pale,428,9+level*8,186,18-level*3,.7,18-level*3);
      }
      cylinder(colors.window,428,35,186,7,5);
      add('cone',colors.gold,428,40,186,10,6,10);
      add('rock',colors.light,428,35,186,4,3,4,0,true);
      box(colors.pale,384,1,238,58,2,40);
      box(colors.iron,370,13,238,4,24,4);
      add('pyramid',colors.gold,370,27,238,4,4,4);
      box(colors.trim,398,2.5,237,10,5,10);
      box(colors.iron,398,12,237,4,14,3);
      box(colors.iron,398,20,237,4.5,4,4);
      box(colors.iron,398,20,239.5,2,2,4);
      add('cone',colors.iron,396.5,24,237,1.4,5,1.4);
      add('cone',colors.iron,399.5,24,237,1.4,5,1.4);
      box(colors.iron,398,6,235.8,6,6,6);
      for(const side of [-1,1]) {
        box(colors.iron,398+side*2.3,9,238,1.6,8,1.6);
        box(colors.iron,398+side*2.3,5.7,240,1.8,1.6,4.4);
        box(colors.gold,398+side*2.3,8.3,238,1.7,.6,1.7);
        add('rock',colors.gold,398+side*1.2,20.6,239,.35,.25,.25);
      }
      box(colors.gold,398,17.6,237.6,4.6,.8,4.2);
      cylinder(colors.gold,402,12,239,.35,18);
      for(const x of [360,414]) {pool(x,248,8,12);palm(x,229,10);}
      for(let i=0;i<8;i++) {crate(413+i%4*3,66+Math.floor(i/4)*4,0,2);barrel(413+i%4*3,123+Math.floor(i/4)*3);}
    }
    function cab() {
      box(colors.trim,60,4,48,116,8,85);
      box(colors.sand,60,10,21,116,12,33);
      house(29,16,28,18,7,'sand',16); house(90,16,28,18,7,'sand',16);
      box('#aa6753',29,21,25.1,4,.8,.2); box('#aa6753',29,21,25.2,.8,4,.2);
      steps(60,53,13,60,16);
      for(let row=0;row<3;row++) for(const x of [30,90]) { house(x,36+row*14,18,11,6,'sand',8); pergola(x,43+row*14,16,3,8); }
      for(const x of [31,90]) { house(x,81,30,16,6); for(let i=0;i<5;i++) box(colors.wood,x-8+i*4,1,93,2,2,2); }
      for(const x of [23,58,93]) { dock(x,104,7,30,-4); boat(x+12,110,14); }
      for(const x of [8,110]) palm(x,60,10,8);
      for(const z of [35,68]) for(const x of [9,111]) planter(x,z,5,8);
      for(const x of [13,45,76,104]) {
        barrel(x,92,0,1.4);barrel(x+1.6,94,0,1.2);crate(x+3,91,0,1.8);
        lantern(x,2,96);
      }
      for(let i=0;i<6;i++) {box(colors.pale,13+i*19,8.4,88,12,.7,.9);flowers(10+i*19,86,1.8,8.1,8);}
    }
    function fishing() {
      for(let row=0;row<2;row++) for(let col=0;col<3;col++) house(18+col*30,12+row*19,16,13,5);
      for(let col=0;col<3;col++) {
        const x=20+col*28;
        for(const side of [-1,1]) box(colors.wood,x+side*10,1.6,48,.3,3.2,.3);
        box(colors.wood,x,3.1,48,22,.3,.3);
        for(let i=0;i<8;i++) {
          const fx=x-8+i*2.2;
          add('rock','#a9b6b1',fx,2.1,48,.6,1.1,.25);
          add('leaf','#809b9b',fx,2.7,48,.6,.35,.2);
          beam('#d1ba8e',new THREE.Vector3(fx,2.7,48),new THREE.Vector3(fx,3.1,48),.025);
        }
        for(let i=0;i<9;i++) {
          beam('#a39677',new THREE.Vector3(x-9+i*2,2.8,50),new THREE.Vector3(x-7+i*2,.4,50),.035);
          beam('#a39677',new THREE.Vector3(x-7+i*2,2.8,50),new THREE.Vector3(x-9+i*2,.4,50),.035);
        }
      }
      dock(51,58,23,6,0);
      add('rock','#70959e',51,2.2,58,7,2,1.8);
      add('leaf','#78979b',47.3,2.2,58,.9,2.7,1.1);
      add('leaf','#527d8c',51,3.25,58,2,1.1,.24);
      add('leaf','#a4c3c4',51.2,1.65,58.7,1.4,.25,1);
      add('rock',colors.iron,53.3,2.5,58.8,.25,.25,.2);
      for(const x of [17,79]) { dock(x,78,5,29,-4); boat(x+9,82,11); }
      for(const x of [8,36,66,91]) {barrel(x,56,0,1.2);crate(x+2,55);add('pot',colors.wood,x,1,60,2,2,2);}
    }
    function papyrus() {
      house(20,20,23,17,6);house(50,20,23,17,6);house(94,21,23,17,7);
      for(let i=0;i<3;i++) for(let j=0;j<2;j++) {
        box(colors.pale,15+i*12,.4,49+j*15,9,.8,10);
        box('#b5d1bc',15+i*12,.85,49+j*15,7,.1,8);
      }
      for(let row=0;row<9;row++) {
        strip(colors.water,80,46+row*4.7,105,46+row*4.7,.7,.2);
        for(let col=0;col<8;col++) {
          const x=81+col*3,z=48+row*4.7;
          cylinder(colors.lightLeaf,x,1.4,z,.24,2.8);
          add('leaf',colors.leaf,x,2.9,z,1,1.1,1);
          for(const side of [-1,1]) add('leaf',colors.lightLeaf,x+side*.3,2.3,z,.8,.3,.2,side*.5);
          for(const side of [-1,1]) {
            cylinder(colors.lightLeaf,x+side*.6,1.2,z+.5,.12,2.4);
            add('leaf',colors.leaf,x+side*.6,2.4,z+.5,.8,.7,.5,side*.8);
          }
        }
      }
      for(let i=0;i<5;i++) { pergola(65,52+i*7,12,4);box(colors.white,65,2.4,52+i*7,10,.12,3); }
      fence(92,66,31,45);
      for(const x of [9,18,27]) {add('pot',colors.pale,x,.75,34,1.4,1.5,1.4);barrel(x,38);}
      for(let i=0;i<10;i++) cylinder(colors.lightLeaf,46+i*.3,1.2,35,.22,2.4);
      for(const z of [35,44,55,65,76,87]) reeds(110,z,1.5,0,8);
      box(colors.wood,50,6.8,29,5,1.3,.3);box(colors.white,20,5.8,29,5,1.3,.3);
      const wheel=new THREE.Group();
      wheel.name='River-driven mill wheel';
      const material=new THREE.MeshStandardMaterial({color:colors.wood,roughness:.9});
      for(const x of [-1,1]) {
        const ring=new THREE.Mesh(new THREE.TorusGeometry(4.2,.24,5,24),material);
        ring.rotation.y=Math.PI/2;ring.position.x=x;wheel.add(ring);
      }
      for(let i=0;i<12;i++) {
        const a=i/12*Math.PI*2;
        const paddle=new THREE.Mesh(new THREE.BoxGeometry(2.7,.5,1.2),material);
        paddle.position.set(0,Math.cos(a)*4.2,Math.sin(a)*4.2);paddle.rotation.x=a;wheel.add(paddle);
      }
      const axle=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,9,8),material);axle.rotation.z=Math.PI/2;axle.position.x=-3;wheel.add(axle);
      wheel.position.set(origin.x+112,3,origin.z+21);
      root.add(wheel);animated.push((time)=>{wheel.rotation.x=-time*.3;});
    }
    function quarry() {
      // A dry retaining floor prevents the global sea plane entering the excavation.
      box(colors.trim,48,-7.8,38,90,.4,70);
      for(let level=0;level<4;level++) {
        const inset=level*9,y=-level*2;
        box(colors.pale,48,y-1,5+inset,88-inset*2,2,5);
        box(colors.sand,5+inset,y-1,38,5,2,66-inset*2);
        box(colors.trim,91-inset,y-1,38,5,2,66-inset*2);
      }
      for(let i=0;i<12;i++) { const x=30+i*4;box(colors.trim,x,-7+i*.65,68,4,1.5,8); }
      for(const x of [105,122]) box(colors.wood,x,6,21,.8,12,.8);
      box(colors.wood,113.5,12,21,24,.8,.8);
      beam(colors.wood,new THREE.Vector3(105,1,21),new THREE.Vector3(122,12,21),.5);
      beam(colors.wood,new THREE.Vector3(105,12,21),new THREE.Vector3(122,1,21),.5);
      for(const x of [105,122]) for(const z of [16,26]) beam(colors.oak,new THREE.Vector3(x,6,21),new THREE.Vector3(x,0,z),.5);
      cylinder(colors.iron,113.5,7,21,.22,10);
      box(colors.sand,113.5,2,21,4,3,4);
      add('disk',colors.iron,113.5,12,21,1.7,1.7,.5);
      house(84,106,25,15,5);house(121,106,25,15,5);
      for(let i=0;i<10;i++) box(colors.pale,21+i%5*6,1.7,101+Math.floor(i/5)*7,5,3.4,5);
      for(const z of [87,89]) strip(colors.iron,4,z,150,z,.16,.3,.2);
      for(let x=4;x<150;x+=2.5) box(colors.wood,x,.1,88,.5,.2,3);
      for(const x of [30,70,110]) {
        box(colors.iron,x,.7,88,4,.6,2.6);box(colors.wood,x,1.8,88,3.5,1.5,2.2);
        box(colors.sand,x,2.6,88,2.8,.5,1.6);
        for(const dx of [-1.2,1.2]) for(const dz of [-1.4,1.4]) add('disk',colors.iron,x+dx,.55,88+dz,1,1,.22);
      }
      for(const x of [19,77]) {
        for(const dx of [-.6,.6]) beam(colors.wood,new THREE.Vector3(x+dx,-6,48),new THREE.Vector3(x+dx,1,44),.15);
        for(let i=0;i<12;i++) box(colors.wood,x,-5.8+i*.6,47.9-i*.34,1.4,.12,.15);
      }
      for(let i=0;i<25;i++) add('rock',i%2?colors.sand:colors.pale,8+random()*70,-7,22+random()*33,1+random()*2,.8,1+random());
    }
    function pyramid() {
      for(const [type,x,z,w,d,,h] of world.locations.find(p=>p.id==='pyramid').plan.items) {
        if(type==='pyramid') {
          add('pyramid',colors.sand,x+w/2,h/2,z+d/2,w,h,d);
          add('pyramid',colors.pale,x+w/2,h*.94,z+d/2,w*.12,h*.12,d*.12);
          box(colors.dark,x+w/2,2,z+d+.03,2.5,4,.2);
        } else strip(colors.pale,x+w/2,z,x+w/2,z+d,w);
      }
      for(let i=0;i<8;i++) for(const x of [103,126]) {
        const z=144+i*4,h=1.5+random()*4;
        cylinder(colors.trim,x,h/2,z,1.7,h);cylinder(colors.pale,x,.15,z,2.6,.3);
        if(i%3===0) add('rock',colors.pale,x+2,.5,z+1,2,.8,1.4);
      }
      for(let i=0;i<45;i++) add('rock',colors.trim,88+random()*55,.25,137+random()*40,.5+random()*2,.7,.8+random());
    }
    function oasis() {
      const floors=[[35,29,38,26],[32,28,30,21],[36,30,24,17],[33,28,31,23],[32,29,42,29]];
      floors.forEach(([x,z,w,d],i)=>{
        cylinder(colors.pale,x,i*4+.3,z,w,.6,d);
        cylinder(colors.sand,x,i*4+2,z,w*.77,3.5,d*.77);
        for(let a=0;a<20;a++) {
          const angle=a/20*Math.PI*2,px=x+Math.cos(angle)*w*.39,pz=z+Math.sin(angle)*d*.39;
          box(colors.window,px,i*4+2,pz,1.5,2.4,.15,-angle+Math.PI/2);
          cylinder(colors.pale,x+Math.cos(angle)*w*.46,i*4+2,z+Math.sin(angle)*d*.46,.4,3.5);
          const bx=x+Math.cos(angle)*w*.49,bz=z+Math.sin(angle)*d*.49;
          box(colors.wood,bx,i*4+1,bz,.12,1.3,.12);
          box(colors.wood,bx,i*4+1.65,bz,w*.16,.12,.12,-angle+Math.PI/2);
          if(a%5===0) {
            add('pot',colors.trim,bx,i*4+.8,bz,1.2,1.2,1.2);
            add('leaf',colors.lightLeaf,bx,i*4+1.6,bz,2,1.3,1.8);
            if(i>0) vine(bx,i*4+.6,bz,2.8);
          }
        }
      });
      cylinder(colors.pale,32,20.2,29,43,.6,30);
      pool(28,29,20,12,20.55);pergola(44,25,11,7,20.5);
      box(colors.wood,44,21.4,25,8,1.5,1.5);
      for(let i=0;i<60;i++) {
        const a=i/60*Math.PI*2;
        box(colors.wood,32+Math.cos(a)*20.6,21.2,29+Math.sin(a)*14.1,.2,1.4,.2);
        box(colors.wood,32+Math.cos(a)*20.6,21.85,29+Math.sin(a)*14.1,2.2,.15,.15,-a+Math.PI/2);
      }
      for(const x of [10,33,56]) { pool(x,49,15,9);pergola(x,49,17,11); }
      tree(5,26,8); tree(60,28,9); steps(35,62,9,18,4,-4);
      for(const x of [9,21,45,57]) {
        box(colors.wood,x,.4,58,2,.6,3.5);box(colors.pale,x,.8,57,1.8,.25,1);
        add('pot',colors.trim,x,1,43,1.4,2,1.4);flowers(x,43,.7,2,5);
      }
      for(let i=0;i<4;i++) cylinder(colors.wood,41+i*2,21.4,28,1,1.3);
    }
    function fort(plain) {
      const stone=plain?colors.stone:colors.sand;
      box(stone,50,-3.5,50,94,7,94);
      box(colors.trim,50,.2,50,94,.4,94);
      for(const x of [7,93]) box(stone,x,6,50,4,12,90);
      box(stone,50,6,7,90,12,4);
      for(const x of [25,75]) box(stone,x,6,93,40,12,4);
      box(stone,50,10,93,12,4,4);
      add('arch',plain?colors.white:colors.pale,50,4,93,12,8,4.3);
      for(const x of [11,89]) for(const z of [11,89]) {
        box(stone,x,9,z,12,18,12);box(plain?colors.white:colors.pale,x,18,z,13,.6,13);
        for(const a of [-4,0,4]) for(const b of [-5,5]) box(stone,x+a,19,z+b,2,2,2);
        for(const a of [-3,3]) for(const b of [-3,3]) box(colors.oak,x+a,20,z+b,.25,4,.25);
        box(plain?colors.oak:colors.wood,x,22.1,z,9,.5,9);
        for(const side of [-1,1]) box(colors.dark,x+side*6.05,12,z, .15,2,.6);
      }
      for(let i=18;i<=82;i+=5) for(const side of [7,93]) {box(stone,i,13,side,2,2,4);box(stone,side,13,i,4,2,2);}
      house(50,32,28,25,22,plain?'plain':'sand');house(26,63,16,26,6,plain?'plain':'sand');
      pergola(74,63,16,26);box(colors.oak,74,2,76,16,4,.4);
      for(let i=0;i<3;i++) { add('rock','#7e6049',70+i*4,1.3,64,1,1.5,3);cylinder(colors.oak,70+i*4,.5,63.3,.18,1); }
      cylinder(colors.oak,50,16,30,.3,35);box(plain?colors.blue:colors.orange,52,32,30,4,2,.08);
      steps(17,60,5,23,12);
      pool(50,61,5,5);cylinder(stone,50,.6,61,5,1.2);cylinder(colors.water,50,1.22,61,3.6,.08);
      pergola(50,61,6,6);add('ring',colors.iron,50,2.7,61,.8,.8,.2);
      for(let i=0;i<4;i++) {
        const z=54+i*6;box(colors.oak,74,1,z,15,2,.22);
        add('rock','#c7ad66',80,.6,z+2.2,3,1.2,3);
      }
      for(const x of [36,42,58]) {
        cylinder(colors.oak,x,1.4,77,.2,2.8);box(colors.oak,x,2.3,77,2,.2,.2);
        add('disk',colors.pale,x,2,77,1.1,1.1,.3);add('disk',colors.orange,x,2,77.2,.5,.5,.1);
      }
      for(const x of [20,25,29]) {barrel(x,40);crate(x,44);}
    }
    function winery() {
      house(33,60,42,40,26,'white');
      add('roof',colors.blue,33,26,60,44,11,42);
      for(const z of [31,90]) {
        cylinder(colors.white,20,17,z,14,34);
        add('cone',colors.blue,20,41,z,18,17,18);
        add('cone',colors.gold,20,50,z,2,4,2);
      }
      for(let z=45;z<80;z+=8) {box(colors.window,54.1,17,z,.2,4,2);box(colors.pale,54.2,19.3,z,.3,.5,3);}
      add('arch',colors.pale,54.3,5,60,7,10,.8,Math.PI/2);
      box(colors.oak,54.15,3,60,.2,6,4);
      for(const z of [31,90]) for(const dx of [-1,1]) {
        add('arch',colors.pale,20+dx*5,21,z+5,2.6,5,.5);
        box(colors.window,20+dx*5,20.5,z+4.8,1.5,3.4,.2);
      }
      strip(colors.stone,55,69,180,69,8);
      for(const z0 of [18,80]) for(let row=0;row<7;row++) {
        const z=z0+row*6;
        strip('#60724b',78,z,152,z,2.8,.5,.5);
        strip(colors.oak,78,z,152,z,.08,1.4,.08);
        for(let col=0;col<10;col++) {
          const x=80+col*8;
          box(colors.oak,x,1.2,z,.2,2.4,.2);
          for(let l=0;l<3;l++) add('leaf',l%2?colors.lightLeaf:colors.leaf,x+(l-1)*1.25,1.9,z,2.8,1.5,2.2);
          for(const side of [-1,1]) add('leaf','#5f506c',x+side*.8,1.5,z+side*.85,.4,.7,.4);
        }
      }
      // Fence encloses both the castle and every vineyard row, with an eastern gate.
      for(const z of [4,136]) {box(colors.stone,90,.5,z,176,1,1.5);strip(colors.iron,2,z,178,z,.2,2.2,.2);}
      for(const x of [2,178]) for(let z=4;z<=136;z+=3) if(x!==178||Math.abs(z-69)>6) box(colors.iron,x,1.7,z,.18,2.4,.18);
      for(let x=2;x<=178;x+=3) for(const z of [4,136]) box(colors.iron,x,1.7,z,.18,2.4,.18);
      for(const x of [2,178]) for(const [a,b] of x===178?[[4,62],[76,136]]:[[4,136]]) {
        strip(colors.stone,x,a,x,b,1.5,.5,1);strip(colors.iron,x,a,x,b,.2,2.2,.2);
      }
      for(const z of [62,76]) box(colors.stone,178,2,z,2.5,4,2.5);
      for(const z of [18,36,89,112]) {
        tree(64,z,9,'pine');flowers(60,z,3,.1,15,'#bba1cc');
        barrel(71,z,0,1.6);
      }
      for(const z of [47,83]) {box(colors.pale,65,.3,z,13,.6,5);planter(65,z,10,.6);}
    }
    function rainbow() {
      box(colors.stone,40,.1,22,82,.2,13);
      world.shops.forEach((shop,i)=>{
        const x=8+i%10*7,z=i<10?10:34,side=i<10?1:-1;
        house(x,z,6,10,7,'plain',0,true);
        const front=z+side*7;
        for(let stripe=0;stripe<4;stripe++) box(stripe%2?shop[2]:colors.white,x-2.25+stripe*1.5,3.1,front,1.5,.18,4);
        for(const sx of [-2.8,2.8]) box(colors.oak,x+sx,1.5,z+side*8.5,.2,3,.2);
        box(colors.oak,x,.8,front,4.8,1.6,1.3);
        box(colors.oak,x+2.5,3.8,front,1.5,.12,.12);
        box(shop[2],x+2.8,3.25,front,1,.8,.15);
        box(colors.gold,x+2.8,3.25,front+side*.1,.35,.35,.1);
        planter(x, z+side*5.5,2.5,4.3);
        for(let n=0;n<4;n++) {
          const gx=x-1.6+n,gy=1.85;
          if([4,8,9].includes(i)) {
            cylinder(i===8?'#8494ac':shop[2],gx,gy+.25,front,.35,.5);
            cylinder(colors.gold,gx,gy+.6,front,.16,.2);
          } else if([1,2,3,16].includes(i)) {
            add('rock',i===16?'#b86b43':'#d3ae6b',gx,gy,front,.75,.35,.55);
          } else if(i===7||i===10) {
            add('leaf',i===7?'#8bb2b7':'#b77976',gx,gy,front,.75,.25,.4);
            add('leaf',colors.pale,gx-.4,gy,front,.25,.15,.4);
          } else if(i===5||i===19) {
            add('pot',shop[2],gx,gy+.3,front,.5,.6,.5);
            if(i===19) flowers(gx,front,.3,gy+.6,3);
          } else if(i===12||i===17) {
            cylinder(i===12?colors.gold:colors.pale,gx,gy+.3,front,.2,.6);
          } else if(i===13) {
            box(colors.iron,gx,gy,front,.25,.2,.8);box(colors.oak,gx,gy,front+.45,.18,.18,.5);
          } else box(shop[2],gx,gy,front,.75,.25,.65);
        }
        if(i%3===0) {barrel(x+2.2,z-side*6);planter(x,z,3,7.3);}
      });
      for(const x of [2,78]) for(const z of [17,27]) {
        cylinder(colors.iron,x,2,z,.15,4);lantern(x,4,z);flowers(x,z,1.3,0,8);
      }
    }
    function residential() {
      cylinder(colors.stone,60,.05,55,40,.2);
      fountain(60,55);
      house(60,16,36,24,12,'church');
      for(const x of [45,75]) box(colors.stone,x,6,29,2.3,12,3);
      for(const x of [48,72]) {
        box(colors.window,x,7,28.2,2,4,.15);
        add('arch',colors.pale,x,7,28.4,3,5,.45);
        box('#b6907b',x,7,28.55,.2,3,.1);box('#a5b6bb',x,7,28.55,1.4,.2,.1);
      }
      box(colors.stone,60,12,27,10,24,9);add('cone',colors.blue,60,28,27,12,11,12);
      box(colors.window,60,20.5,31.6,4,5,.15);
      add('arch',colors.pale,60,20.5,31.8,5,6,.5);
      add('pot',colors.gold,60,20.8,31.8,1.7,1.8,1.7);
      add('disk','#647f9c',60,12,31.6,4,4,.15);add('ring',colors.pale,60,12,31.8,4.8,4.8,.35);
      for(let i=0;i<8;i++) {const a=i*Math.PI/4;beam(colors.pale,new THREE.Vector3(60,12,32),new THREE.Vector3(60+Math.cos(a)*1.9,12+Math.sin(a)*1.9,32),.12);}
      add('arch',colors.pale,60,3,31.7,5,6,.6);box(colors.oak,60,2,31.6,3.1,4,.2);
      box(colors.gold,60,34,27,.4,5,.4);box(colors.gold,60,35,27,3,.4,.4);
      house(17,47,25,24,9,'plain');house(102,47,25,24,9,'plain');
      box('#b57565',17,6,59.1,3,.7,.2);box('#b57565',17,6,59.2,.7,3,.2);
      for(const x of [27,90]) house(x,85,27,18,8,'plain');
      for(const x of [38,82]) for(const z of [40,72]) {tree(x,z,7,'spring');box(colors.oak,x+3,.6,z,3,.4,1);}
      strip(colors.stone,60,70,60,102,8);strip(colors.stone,76,55,125,55,8);
      for(const x of [38,82]) for(const z of [40,72]) {
        flowers(x,z,3.5,.1,26,'#d8b8c2');
        box(colors.oak,x+3,1.2,z+.4,3,1,.15);
        for(const dx of [2,4]) box(colors.iron,x+dx,.4,z,.15,.8,.8);
      }
      for(const x of [43,77]) for(const z of [33,78]) {cylinder(colors.iron,x,2,z,.16,4);lantern(x,4,z);}
      for(let i=0;i<14;i++) {const a=i/14*Math.PI*2;add('rock',colors.pale,60+Math.cos(a)*5,.6,55+Math.sin(a)*5,.9,1,.9);}
    }
    function temple() {
      for(let i=0;i<9;i++) {
        const w=100-i*4;
        box(i%2?colors.stone:'#7d8b72',50,i*4+2,50,w,4,w);
        box('#a1ab90',50,i*4+4,50,w+.4,.4,w+.4);
        for(const side of [-1,1]) for(const offset of [-.32,.26]) {
          vine(50+offset*w,i*4+4,50+side*(w/2+.25),2.2+random()*1.5);
          vine(50+side*(w/2+.25),i*4+4,50+offset*w,2.2+random()*1.5);
        }
        // Water descends the eastern terraces into a small rock basin.
        for(const z of [36,63]) beam(colors.water,new THREE.Vector3(50+w/2,i*4+4,z),new THREE.Vector3(52+w/2,i*4,z),1.1);
      }
      for(let i=0;i<4;i++) {
        const a=i*Math.PI/2;
        steps(50+Math.sin(a)*49,50+Math.cos(a)*49,8,30,36,0,a);
      }
      const gardens=[{x:33,z:33,color:'#a2b777',kind:'spring'}, {x:67,z:33,color:'#467450',kind:'oak'},
        {x:33,z:67,color:colors.snow,kind:'snow'}, {x:67,z:67,color:'#b28e50',kind:'autumn'}];
      for(const garden of gardens) {
        add('garden',garden.color,garden.x,36.3,garden.z<50?44:56,30,.5,34,garden.z<50?Math.PI:0);
        pool(garden.x+4,garden.z+3,10,7,36.6);
        if(garden.kind==='snow') cylinder('#bedbdc',garden.x+4,37.05,garden.z+3,10,.15,7);
        for(let i=0;i<6;i++) {
          const angle=i/6*Math.PI*2;
          tree(garden.x+Math.cos(angle)*8,garden.z+Math.sin(angle)*8,4+random()*2,garden.kind,36.6);
        }
        for(let i=0;i<9;i++) add('rock',garden.kind==='spring'?'#dbb8c6':garden.color,garden.x-9+random()*18,37,garden.z-9+random()*18,.6,.6,.6);
        if(garden.kind==='spring') flowers(garden.x,garden.z,11,36.7,90,'#e0afc7');
        if(garden.kind==='oak') {
          reeds(garden.x+8,garden.z+4,2,36.7,20);
          for(let i=0;i<7;i++) cylinder(colors.leaf,garden.x+1+random()*6,37.12,garden.z+1+random()*4,.8,.06);
        }
        if(garden.kind==='autumn') for(let i=0;i<65;i++) add('leaf',i%2?colors.orange:'#dac173',garden.x-10+random()*20,36.95,garden.z-10+random()*20,.35,.07,.3);
        if(garden.kind==='snow') for(let i=0;i<15;i++) add('rock',colors.snow,garden.x-10+random()*20,37,garden.z-10+random()*20,1.7,.4,1.4);
      }
      strip(colors.pale,18,50,82,50,6,36.5,.3);strip(colors.pale,50,18,50,82,6,36.5,.3);
      for(const x of [20,80]) for(const z of [20,80]) {
        box(colors.pale,x,37,z,6,2,6);box(colors.stone,x,43,z,4,10,4);box(colors.pale,x,49,z,6,2,6);
        add('rock',colors.gold,x,51,z,2,3,2,0,true);
        box('#607b52',x+2.03,43,z,.1,6,1.5);
        for(const side of [-1,1]) for(let n=0;n<4;n++) {
          box(colors.dark,x,40+n*1.7,z+side*2.04,2.4,.28,.08);
          box(colors.gold,x+(n%2?-.5:.5),40.5+n*1.7,z+side*2.1,.3,.75,.1);
        }
        vine(x-2.2,48,z+2.2,7);
      }
      for(let i=0;i<3;i++) box(colors.pale,50,37+i,50,10-i*2,1,10-i*2);
      add('rock',colors.light,50,41,50,1.4,2,1.4,0,true);
      pool(106,49,12,37,-.1);
      for(const z of [34,42,58,65]) {add('rock',colors.stone,111,.8,z,3,2,3);reeds(112,z,1.5,0,8);}
    }
    function goblin() {
      for(const [x,z] of [[18,22],[79,22],[18,59],[79,59]]) {
        cylinder(colors.stone,x,1.7,z,16,3.4,13);
        box(colors.stone,x,1.7,z+4.7,12,3.4,2);
        add('leaf',colors.grass,x,4.5,z,21,4.5,17);
        add('ring',colors.pale,x,1.5,z+5.9,3.7,3.7,.55);
        add('disk',colors.wood,x,1.5,z+5.85,2.8,2.8,.3);
        add('rock',colors.gold,x+.8,1.5,z+6.1,.16,.16,.16);
        for(const dx of [-4,4]) {
          add('disk',colors.window,x+dx,2,z+5.85,1.6,1.6,.2);
          add('ring',colors.pale,x+dx,2,z+6,2,2,.3);
          box(colors.oak,x+dx,2,z+6.2,.1,1.6,.1);box(colors.oak,x+dx,2,z+6.2,1.6,.1,.1);
        }
        box(colors.stone,x-4,5,z-1,1.6,6,1.6);box(colors.pale,x-4,8.1,z-1,2,.3,2);
        box(colors.dark,x-4,8.28,z-1,1.3,.08,1.3);
        for(const dx of [-2.4,2.4]) lantern(x+dx,2.3,z+6);
        for(let i=0;i<18;i++) {
          const dx=-7+random()*14,dz=-5+random()*10;
          const height=4.5+2.25*Math.sqrt(Math.max(0,1-(dx/10.5)**2-(dz/8.5)**2));
          flowers(x+dx,z+dz,.6,height,3,i%2?'#d3aaca':'#e0d29f');
        }
        for(const dx of [-5,5]) {vine(x+dx,4.8,z+6.5,2.4);flowers(x+dx,z+8,2,0,24);}
        barrel(x-7,z+6,0,.8);planter(x+5,z+7,2.5);
        for(let i=0;i<8;i++) cylinder(colors.pale,x,.07,z+7+i*1.4,1.8,.14,1.1);
      }
      fountain(48,17);
      for(const [x,z] of [[31,9],[66,9],[32,29],[66,29]]) tree(x,z,7,'spring');
      strip(colors.trim,50,30,50,80,5);
      // Walk-in hillside gallery, open at the south end, with habitable side doors.
      for(const x of [45,55]) box(colors.stone,x,2,73,2,4,27);
      box(colors.stone,50,4,73,12,1.2,27);
      box(colors.grass,50,5,73,15,1.2,29);
      add('leaf',colors.grass,50,7.7,72,25,4,36);
      box(colors.trim,50,.1,73,10,.2,27);
      for(let z=63;z<85;z+=6) for(const side of [-1,1]) {
        box(colors.wood,50+side*3.95,1.2,z,.15,2.4,1.8);
        add('box',colors.light,50+side*3.8,2.8,z,.2,.5,.5,0,true);
      }
      for(let z=61;z<=88;z+=5.5) {
        for(const x of [45.8,54.2]) box(colors.oak,x,1.9,z,.55,3.8,.55);
        box(colors.oak,50,3.7,z,9,.55,.55);
        for(const side of [-1,1]) beam(colors.oak,new THREE.Vector3(50+side*4,2.3,z),new THREE.Vector3(50+side*2.7,3.7,z),.3);
      }
      add('arch',colors.stone,50,2.7,88,13,5.4,1.3);
      for(const x of [42,58]) {lantern(x,2.8,88);flowers(x,88,2,0,30);}
      for(const x of [35,64]) for(const z of [40,53,64,79]) {
        flowers(x,z,3,0,30,'#cfb0d2');add('leaf',colors.leaf,x,.8,z,2.5,1.6,2.5);
      }
      for(const z of [37,47,57]) {tree(5,z,9,'oak');tree(94,z,9,'spring');}
      for(let i=0;i<18;i++) {
        const a=i/18*Math.PI*2;flowers(48+Math.cos(a)*10,17+Math.sin(a)*8,1.6,0,12,'#ddca8d');
      }
      features.push({id:'goblin-tunnel',place:'goblin',name:'苔铃地下街巷',position:[origin.x+50,origin.y+2,origin.z+81]});
    }
    const builders={sadland,capital,cab,fishing,papyrus,quarry,pyramid,oasis,
      'desert-fort':()=>fort(false),'plains-fort':()=>fort(true),winery,rainbow,residential,temple,goblin};
    for(const place of world.locations) {
      const [x,z]=placements[place.id];
      const y=place.id==='oasis'?36:6;
      origin.rotation=place.id==='fishing'?-Math.PI/2:0;
      const cos=Math.cos(origin.rotation),sin=Math.sin(origin.rotation);
      Object.assign(origin,{x:x-place.plan.w/2*cos-place.plan.d/2*sin,y,z:z-place.plan.d/2*cos+place.plan.w/2*sin,id:place.id});
      const radius=Math.max(place.plan.w,place.plan.d)*.68;
      places.set(place.id,{id:place.id,x,y,z,radius,plan:place.plan,name:place.short||place.name});
      builders[place.id]();
    }
    Object.assign(origin,{x:0,y:0,z:0,rotation:0,id:null});

    // Overland routes are independent on the two fortress banks.
    const roads=[
      [[-80,340],[-120,430],[-450,530],[-780,650]],
      [[-80,300],[-160,150],[-240,-40],[-100,-210]],
      [[-700,-140],[-540,-180],[-370,-210],[-100,-210]],
      [[-700,-140],[-970,-230],[-1130,-320]],
      [[-700,-140],[-780,130],[-800,460],[-780,650]],
      [[-1130,-400],[-900,-600],[-650,-820]],
      [[-100,-210],[110,-130],[290,20],[440,100]],
      [[440,100],[510,260],[650,480]],
      [[-80,340],[180,375],[400,400],[650,480]],
      [[80,-300],[200,-220],[340,-370],[440,-570],[630,-760],[600,-880]],
      [[1110,-181],[1200,-165],[1210,-100],[1320,-100]],
      [[808,480],[1010,315],[1130,80],[1210,-50]],
      [[1110,-320],[1120,-470],[1050,-620],[1050,-820],[1190,-1100],[1370,-1390],[1520,-1680],[1600,-1980]],
      [[-780,650],[-1040,660],[-1280,750],[-1540,1000],[-1820,1270],[-2160,1480],[-2390,1670],[-2550,1850]]
    ];
    const routeSamples=[];
    const roadVertices=[];
    roads.forEach((points,index)=>{
      const path=curvePath(points);
      routeSamples.push(path);
      for(let i=1;i<path.length;i++) {
        const a=path[i-1],b=path[i],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
        if(waterDistance(x,z)<8) continue;
        const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),halfWidth=index===13?1.5:3;
        const nx=-dz/length*halfWidth,nz=dx/length*halfWidth,steps=Math.ceil(length/3);
        for(let j=0;j<steps;j++) {
          const ax=mix(a[0],b[0],j/steps),az=mix(a[1],b[1],j/steps);
          const bx=mix(a[0],b[0],(j+1)/steps),bz=mix(a[1],b[1],(j+1)/steps);
          const corner=(px,pz)=>[px,groundHeight(px,pz)+.32,pz];
          const p0=corner(ax-nx,az-nz),p1=corner(ax+nx,az+nz),p2=corner(bx-nx,bz-nz),p3=corner(bx+nx,bz+nz);
          roadVertices.push(...p0,...p1,...p2,...p1,...p3,...p2);
        }
      }
      // Supply routes may bridge a tributary, while the opposing fort gates stay separate.
      for(let i=1;i<path.length-1;i++) {
        if(waterDistance(...path[i])>=8) continue;
        const start=i-1;
        while(i<path.length-1&&waterDistance(...path[i])<8) i++;
        const a=path[start],b=path[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
        if(length>160||length<10) continue;
        const y=Math.max(terrainHeight(...a),terrainHeight(...b))+.6;
        strip(colors.wood,...a,...b,6,y,.6);
        const nx=-(b[1]-a[1])/length,nz=(b[0]-a[0])/length;
        for(const side of [-1,1]) {
          strip(colors.oak,a[0]+nx*side*2.8,a[1]+nz*side*2.8,b[0]+nx*side*2.8,b[1]+nz*side*2.8,.14,y+1.3,.15);
          for(let step=0;step<=length;step+=4) {
            const x=mix(a[0],b[0],step/length)+nx*side*2.8,z=mix(a[1],b[1],step/length)+nz*side*2.8;
            cylinder(colors.oak,x,y/2,z,.3,y+2.6);
          }
        }
        features.push({id:'route-bridge-'+index,place:null,position:[(a[0]+b[0])/2,y,(a[1]+b[1])/2]});
      }
    });
    const roadGeometry=new THREE.BufferGeometry();
    roadGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roadVertices,3));roadGeometry.computeVertexNormals();
    const roadMesh=new THREE.Mesh(roadGeometry,new THREE.MeshStandardMaterial({color:'#c0aa82',roughness:1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
    roadMesh.name='Ground-following overland paths';roadMesh.receiveShadow=true;root.add(roadMesh);
    // A continuous quarry freight railway follows the desert supply road.
    const rail=curvePath([[-625,-112],[-510,-175],[-350,-213],[-160,-223]]);
    for(let i=1;i<rail.length;i++) {
      const a=rail[i-1],b=rail[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      const nx=-dz/length,nz=dx/length,y=terrainHeight(a[0],a[1])+.35;
      for(const side of [-.6,.6]) strip(colors.iron,a[0]+nx*side,a[1]+nz*side,b[0]+nx*side,b[1]+nz*side,.13,y,.16);
      strip(colors.wood,a[0]-nx,a[1]-nz,a[0]+nx,a[1]+nz,.4,y-.1,.16);
    }
    // Clustered woodland, riverbank growth and dry scrub follow the expanded continent.
    function canPlant(x,z) {
      const h=terrainHeight(x,z);
      if(h<3||h>160||waterDistance(x,z)<16) return false;
      if(world.locations.some(p=>{const [px,pz]=placements[p.id];return Math.abs(x-px)<p.plan.w*.65+12&&Math.abs(z-pz)<p.plan.d*.65+12;})) return false;
      return !routeSamples.some(path=>pathDistance(x,z,path)<8);
    }
    for(let i=0;i<8500;i++) {
      const x=mix(bounds.minX,bounds.maxX,random()),z=mix(bounds.minZ,bounds.maxZ,random());
      if(!canPlant(x,z)) continue;
      const h=groundHeight(x,z),plain=isPlains(x,z),moisture=waterDistance(x,z);
      const grove=Math.sin(x*.009)+Math.cos(z*.013)+Math.sin((x+z)*.006);
      if(plain&&grove>-.7) {
        tree(x,z,8+random()*13,h>40||random()>.75?'pine':'oak',h,false);
        if(i%4===0) add('leaf',colors.lightLeaf,x+3,h+.8,z+2,4,1.6,3);
      } else if(!plain&&moisture<100&&random()>.4) palm(x,z,7+random()*7,h);
      else if(!plain&&random()>.94) tree(x,z,6+random()*5,'acacia',h,false);
      else if(random()>.72) add('rock',plain?'#89917c':'#a59873',x,h+.6,z,2+random()*4,1.8,2+random()*2);
    }
    for(const id of ['goblin','temple']) {
      const p=places.get(id);
      for(let i=0;i<620;i++) {
        const a=random()*Math.PI*2,r=65+Math.sqrt(random())*370;
        const x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;
        if(!canPlant(x,z)) continue;
        const h=groundHeight(x,z);
        tree(x,z,8+random()*11,id==='temple'&&h>70?'pine':'oak',h,r<150);
        if(r<170) flowers(x+3,z+2,2,h,8,id==='goblin'?'#c7b3c8':'#d1c790');
      }
    }
    for(let i=0;i<mainland.length-1;i+=2) {
      const [x,z]=mainland[i],h=groundHeight(x,z);
      add('rock','#949a85',x,h+1,z,5+random()*8,4+random()*3,6+random()*6,random()*3);
    }
    for(const path of waterPaths.filter(p=>p.width>3)) {
      for(let i=1;i<path.points.length-1;i+=3) {
        const a=path.points[i-1],b=path.points[i+1],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
        for(const side of [-1,1]) {
          const x=path.points[i][0]-(b[1]-a[1])/length*(path.width+13)*side;
          const z=path.points[i][1]+(b[0]-a[0])/length*(path.width+13)*side;
          if(canPlant(x,z)) reeds(x,z,3,groundHeight(x,z),10);
        }
      }
    }
    for(const [x,z,size] of [[-250,-850,30],[220,-1000,24],[30,850,24],[-560,900,18],[400,-800,20]]) boat(x,z,size,random()*2,0);

    let instances=0;
    const pickables=[];
    for(const batch of batches.values()) {
      const geometry=geometries[batch.shape].clone();
      const surfaces=batch.items.map(item=>{
        if(['leaf','rock','cone','pot','sail','ring','garden'].includes(batch.shape)) return 0;
        if(item.color==='#c5b38f') return 3;
        return stoneColors.has(item.color)?1:timberColors.has(item.color)?2:0;
      });
      geometry.setAttribute('surfaceKind',new THREE.InstancedBufferAttribute(new Float32Array(surfaces),1));
      const mesh=new THREE.InstancedMesh(geometry,batch.luminous?glow:batch.shape==='sail'?fabric:solid,batch.items.length);
      mesh.name=batch.shape+' · batched world geometry';
      mesh.userData.items=batch.items;
      mesh.castShadow=!batch.luminous;mesh.receiveShadow=!batch.luminous;
      batch.items.forEach((item,i)=>{
        temp.position.set(item.x,item.y,item.z);
        temp.rotation.set(0,item.rotation,0);
        if(item.quaternion) temp.quaternion.copy(item.quaternion);
        temp.scale.set(item.w,item.h,item.d);temp.updateMatrix();
        mesh.setMatrixAt(i,temp.matrix);mesh.setColorAt(i,vertexColor.set(item.color));
      });
      mesh.computeBoundingSphere();mesh.computeBoundingBox();
      instances+=batch.items.length;root.add(mesh);pickables.push(mesh);
    }
    root.updateMatrixWorld(true);
    return { root, places, features, animated, terrainHeight, groundHeight, terrainMesh, pickables,
      instances, waterPaths, northBay, southBay, mainland, roads, bounds, isPlains,
      stats:{locations:places.size,shops:world.shops.length,sadlandHouses:4,fortresses:2,seasons:4} };
  }
  return { build, placements };
})();
