/**
 * Cached three-dimensional station structures, projected into the shared 2D batch.
 * Triangles are depth-sorted once, with surface-normal lighting and smooth torus normals.
 * No textures, extra WebGL context or per-frame mesh generation.
 */
const StarbaseArt = (() => {
  const cache=new Map(),LIMIT=18;
  const light=[-.45,-.6,.75],view=[-.265,.497,.828];
  const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
  const normal=(a,b,c)=>{
    const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;
    return n.map(v=>v/l);
  };
  const project=p=>[p[0]+p[2]*.32,p[1]-p[2]*.6];
  function buildModel(gx,gy){
    const seed=(Math.imul(gx,3769)^Math.imul(gy,977)^7214)>>>0,rng=random(seed);
    const style=gx===0&&gy===0?0:seed%3,faces=[];
    const hull=[.40,.46,.48],edge=[.21,.27,.30],solar=[.06,.16,.27],copper=[.45,.30,.18],dark=[.025,.045,.06];
    function shade(color,n,emissive=false){
      if(emissive)return [...color,1];
      const diffuse=Math.max(0,dot(n,light)),spec=Math.pow(Math.max(0,dot(n,[-.22,-.29,.93])),22)*.13;
      return color.map(v=>Math.min(1,v*(.27+diffuse*.9)+spec)).concat(1);
    }
    function triangle(a,b,c,color,normals=null,emissive=false){
      const ns=normals||Array(3).fill(normal(a,b,c));
      const center=a.map((v,i)=>(v+b[i]+c[i])/3);
      faces.push({points:[a,b,c],colors:ns.map(n=>shade(color,n,emissive)),depth:dot(center,view)});
    }
    function quad(a,b,c,d,color,emissive=false){triangle(a,b,c,color,null,emissive);triangle(a,c,d,color,null,emissive);}
    function box(x,y,z,w,h,d,color){
      const a=[x-w/2,y-h/2,z-d/2],b=[x+w/2,y-h/2,z-d/2],c=[x+w/2,y+h/2,z-d/2],e=[x-w/2,y+h/2,z-d/2];
      const A=[a[0],a[1],z+d/2],B=[b[0],b[1],z+d/2],C=[c[0],c[1],z+d/2],E=[e[0],e[1],z+d/2];
      quad(A,B,C,E,color);quad(b,a,e,c,color);
      quad(a,b,B,A,color);quad(b,c,C,B,color);quad(c,e,E,C,color);quad(e,a,A,E,color);
    }
    function cylinder(x,y,z,r,height,color,sides=20){
      for(let i=0;i<sides;i++){
        const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2;
        const p=[x+Math.cos(a)*r,y+Math.sin(a)*r,z],q=[x+Math.cos(b)*r,y+Math.sin(b)*r,z];
        const P=[p[0],p[1],z+height],Q=[q[0],q[1],z+height];
        quad(p,q,Q,P,color);triangle([x,y,z+height],P,Q,color);
      }
    }
    function ring(radius,tube,z){
      const segments=56,sides=8;
      function node(i,j){
        const a=i/segments*Math.PI*2,b=j/sides*Math.PI*2;
        return {p:[Math.cos(a)*(radius+Math.cos(b)*tube),Math.sin(a)*(radius+Math.cos(b)*tube),z+Math.sin(b)*tube],
          n:[Math.cos(a)*Math.cos(b),Math.sin(a)*Math.cos(b),Math.sin(b)]};
      }
      for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){
        const a=node(i,j),b=node(i+1,j),c=node(i+1,j+1),d=node(i,j+1);
        const color=i%7===0?edge:hull;
        triangle(a.p,b.p,c.p,color,[a.n,b.n,c.n]);triangle(a.p,c.p,d.p,color,[a.n,c.n,d.n]);
      }
      // Window belts are separate lit panes, following the curved habitat hull.
      for(let i=0;i<56;i++)if(i%7!==0){
        const a=i/56*Math.PI*2,b=(i+.45)/56*Math.PI*2,r=radius+tube*.68;
        quad([Math.cos(a)*r,Math.sin(a)*r,z+4],[Math.cos(b)*r,Math.sin(b)*r,z+4],
          [Math.cos(b)*r,Math.sin(b)*r,z+7],[Math.cos(a)*r,Math.sin(a)*r,z+7],
          i%4===0?[.76,.56,.28]:[.28,.57,.64],true);
      }
    }
    // Central structural spine and utility conduits.
    box(0,0,-9,25,164,13,edge);
    box(0,0,-4,230,10,10,edge);
    for(const side of [-1,1]){
      // Solar cells have dark frames, panel subdivisions and a thin physical edge.
      const sx=side*(style===2?145:155);
      box(sx,0,0,50,110,3,edge);
      for(let col=0;col<3;col++)for(let row=0;row<8;row++){
        const tint=solar.map(v=>v*(.8+rng()*.3));
        box(sx-16+col*16,-45+row*13,2,14,11,1,tint);
      }
      box(side*102,0,-1,43,7,7,copper);
      // Ribbed radiators dissipate heat above and below the main body.
      for(const end of [-1,1]){
        box(side*39,end*110,-8,25,43,2,[.20,.23,.25]);
        for(let rib=0;rib<7;rib++)box(side*39,end*110-17+rib*5,-6,22,1,1,[.36,.39,.38]);
      }
    }
    if(style===0){
      ring(76,10,5);
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2;
        box(Math.cos(a)*42,Math.sin(a)*42,-2,i%2?12:64,i%2?64:12,10,edge);
      }
    }else if(style===1){
      for(const side of [-1,1])for(const end of [-1,1]){
        box(side*52,end*53,1,42,62,24,hull);
        box(side*52,end*53,15,35,52,3,edge);
        for(let i=0;i<4;i++)box(side*52-12+i*8,end*53,17,3,43,1,[.38,.43,.44]);
      }
      ring(55,7,-4);
    }else{
      box(0,0,0,42,145,25,hull);
      for(const side of [-1,1]){
        cylinder(side*69,-39,-7,23,25,hull);
        cylinder(side*69,43,-7,23,25,hull);
        box(side*33,0,5,26,9,8,edge);
      }
    }
    cylinder(0,0,0,31,25,hull,24);
    cylinder(0,-8,25,19,12,edge,20);
    cylinder(0,-8,37,15,3,[.23,.46,.56],20);
    // Open docking aperture: black recess, armoured frame, guidance lamps and stripes.
    box(0,42,17,42,38,14,hull);
    box(0,44,25,32,28,1,dark);
    box(-18,44,27,4,32,4,copper);box(18,44,27,4,32,4,copper);
    for(let i=0;i<4;i++){
      quad([-16,34+i*7,28],[-13,34+i*7,28],[-13,37+i*7,28],[-16,37+i*7,28],[.30,.75,.62],true);
      quad([13,34+i*7,28],[16,34+i*7,28],[16,37+i*7,28],[13,37+i*7,28],[.30,.75,.62],true);
    }
    // Small exterior equipment, patch plates, mast and communications dish.
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2;
      box(Math.cos(a)*26,Math.sin(a)*26,27,6,8,3,i%2?edge:hull);
    }
    box(-20,-53,17,3,40,3,edge);
    box(-20,-65,31,2,2,34,hull);
    cylinder(-20,-65,48,9,3,[.49,.52,.50],16);
    box(17,-44,22,15,10,8,edge);
    faces.sort((a,b)=>a.depth-b.depth);
    const triangles=faces.map(face=>({points:face.points.map(project),colors:face.colors}));
    return {style,triangles,bounds:220,beacons:[[0,-65,50],[-180,-50,5],[180,50,5]].map(project)};
  }
  function modelFor(station){
    const key=station.gx+':'+station.gy;
    let model=cache.get(key);
    if(model)cache.delete(key);else model=buildModel(station.gx,station.gy);
    cache.set(key,model);while(cache.size>LIMIT)cache.delete(cache.keys().next().value);
    return model;
  }
  function render(station,screen){
    const [x,y]=screen(station.x,station.y);
    if(x < -220||y < -220||x>width+220||y>height+220)return;
    const model=modelFor(station);
    disc(x,y,110,[.24,.48,.63,.025],40);
    for(const face of model.triangles){
      const p=face.points.map(p=>[x+p[0],y+p[1]]);
      triGradient(p[0],p[1],p[2],...face.colors);
    }
    const glow=.5+.2*Math.sin((typeof time==='number'?time:0)*1.8+station.gx);
    for(const [i,p]of model.beacons.entries()){
      disc(x+p[0],y+p[1],5,[i===1?1:.3,i===1?.35:.8,.6,glow*.13],10);
      disc(x+p[0],y+p[1],1.5,[i===1?1:.4,i===1?.35:.9,.7,glow],6);
    }
  }
  return {buildModel,render,get cacheSize(){return cache.size;}};
})();
