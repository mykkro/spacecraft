/**
 * Decorative deep-space scenery. Positions live on slow parallax layers, never in
 * the collision/mining world. Seeded tiles make revisiting a place look identical.
 * Geometry is baked once per tile; the LRU bounds memory during endless travel.
 */
const DeepSpace = (() => {
  const TILE = 2400, LIMIT = 72;
  const cache = new Map();
  const palettes = [
    [[.09,.23,.30],[.18,.46,.43],[.43,.35,.22]], // ocean / land
    [[.40,.24,.14],[.68,.46,.26],[.78,.65,.43]], // gas giant
    [[.22,.25,.30],[.43,.46,.50],[.62,.66,.70]]  // cratered moon
  ];
  function rng(seed) {
    let n = seed >>> 0;
    return () => { n = (Math.imul(n,1664525)+1013904223) >>> 0; return n/4294967296; };
  }
  function hash(x,y,layer) {
    return (Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(layer+1,83492791)) >>> 0;
  }
  function triangle(mesh,a,b,c,ca,cb=ca,cc=ca) {
    mesh.push([a,b,c,ca,cb,cc]);
  }
  // Soft elliptical fans have transparent edges, avoiding hard cloud boundaries.
  function glow(mesh,x,y,rx,ry,color,alpha,segments=32) {
    const center=[x,y], opaque=[...color,alpha], clear=[...color,0];
    for(let i=0;i<segments;i++) {
      const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
      triangle(mesh,center,[x+Math.cos(a)*rx,y+Math.sin(a)*ry],
        [x+Math.cos(b)*rx,y+Math.sin(b)*ry],opaque,clear,clear);
    }
  }
  function planet(mesh,x,y,r,kind,seed) {
    const palette=palettes[kind], phase=seed*.00001;
    // An atmospheric halo sits behind the opaque sphere.
    if(kind!==2) {
      for(let i=3;i>0;i--) glow(mesh,x,y,r+i*9,r+i*9,[.18,.48,.78],.045,64);
    }
    const rows=20, columns=64, points=[];
    for(let row=0;row<=rows;row++) {
      const ring=[], rho=row/rows;
      for(let col=0;col<=columns;col++) {
        const a=col/columns*Math.PI*2, nx=Math.cos(a)*rho,ny=Math.sin(a)*rho;
        const nz=Math.sqrt(Math.max(0,1-rho*rho));
        const terrain=Math.sin(nx*17+phase+Math.sin(ny*11)*2)
          +Math.sin(ny*23+nx*8+phase)*.55+Math.cos(nx*39-ny*31)*.24;
        const band=kind===1 ? Math.sin(ny*35+Math.sin(nx*9+phase)*.8) : terrain;
        const base=palette[band>.45?2:band>-.4?1:0];
        const light=Math.max(0,-nx*.62-ny*.34+nz*.70);
        const shade=.055+Math.pow(light,.85)*.85;
        const rim=kind!==2?Math.pow(1-nz,5)*Math.max(0,light)*.25:0;
        const spec=kind===0&&band<-.4?Math.pow(Math.max(0,-nx*.32-ny*.18+nz*.93),40)*.32:0;
        ring.push({p:[x+nx*r,y+ny*r],c:base.map((v,i)=>Math.min(1,v*shade+rim*[.2,.5,1][i]+spec)).concat(1)});
      }
      points.push(ring);
    }
    for(let row=0;row<rows;row++) for(let col=0;col<columns;col++) {
      const a=points[row][col],b=points[row+1][col],c=points[row+1][col+1],d=points[row][col+1];
      triangle(mesh,a.p,b.p,c.p,a.c,b.c,c.c);
      if(row>0) triangle(mesh,a.p,c.p,d.p,a.c,c.c,d.c);
    }
  }
  function buildTile(tx,ty,layer) {
    const random=rng(hash(tx,ty,layer)), mesh=[];
    const origin=tx===0&&ty===0, x=tx*TILE+random()*TILE,y=ty*TILE+random()*TILE;
    if(layer===0) {
      // Overlapping wisps vary in hue and density; dark space remains between clouds.
      const tint=random()>.5?[.20,.16,.46]:[.08,.36,.40];
      const cloudX=origin?-160:x,cloudY=origin?80:y;
      for(let i=0;i<22;i++) {
        const a=i*.43, spread=i*24;
        glow(mesh,cloudX+Math.cos(a)*spread,cloudY+Math.sin(a)*spread*.5,
          260+random()*350,100+random()*180,tint,.025+random()*.035);
      }
    } else if(layer===1) {
      if(origin||random()<.7) planet(mesh,origin?340:x,origin?-170:y,
        origin?205:110+random()*180,origin?0:Math.floor(random()*3),hash(tx,ty,layer));
    } else if(origin||random()<.45) {
      const sx=origin?-430:x,sy=origin?-260:y,r=origin?32:18+random()*28;
      const tint=random()>.5?[1,.65,.28]:[.56,.76,1];
      glow(mesh,sx,sy,r*9,r*9,tint,.10);
      glow(mesh,sx,sy,r*3,r*3,tint,.35);
      glow(mesh,sx,sy,r,r,[1,.94,.79],1,64);
      glow(mesh,sx,sy,r*.7,r*.7,[1,1,1],1,48);
    }
    return mesh;
  }
  function tile(x,y,layer) {
    const key=layer+':'+x+':'+y;
    let mesh=cache.get(key);
    if(mesh) cache.delete(key); else mesh=buildTile(x,y,layer);
    cache.set(key,mesh);
    while(cache.size>LIMIT) cache.delete(cache.keys().next().value);
    return mesh;
  }
  function render() {
    // Never wrap individual objects across the viewport: the camera crosses tiles.
    const layers=[.025,.11,.055], margin=1100;
    for(const layer of [0,2,1]) {
      const cx=ship.x*layers[layer],cy=ship.y*layers[layer];
      const left=Math.floor((cx-width/2-margin)/TILE),right=Math.floor((cx+width/2+margin)/TILE);
      const top=Math.floor((cy-height/2-margin)/TILE),bottom=Math.floor((cy+height/2+margin)/TILE);
      for(let x=left;x<=right;x++) for(let y=top;y<=bottom;y++) {
        for(const [a,b,c,ca,cb,cc] of tile(x,y,layer)) {
          const project=p=>[p[0]-cx+width/2,p[1]-cy+height/2];
          // Cull baked triangles before adding them to the shared WebGL batch.
          if(Math.max(a[0],b[0],c[0])<cx-width/2||Math.min(a[0],b[0],c[0])>cx+width/2||
             Math.max(a[1],b[1],c[1])<cy-height/2||Math.min(a[1],b[1],c[1])>cy+height/2) continue;
          triGradient(project(a),project(b),project(c),ca,cb,cc);
        }
      }
    }
  }
  return {render, buildTile, get cacheSize(){return cache.size;}};
})();
