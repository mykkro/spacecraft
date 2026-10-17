/**
 * Seeded spherical moon surfaces with crater relief, baked normal lighting and terrain palettes.
 * Compact vertex buffers are cached; flight uses the original moon radius and landing rules.
 */
const MoonArt = (() => {
  const presets = {
    cratered:{base:[.43,.44,.43],high:[.64,.63,.59],craters:30,depth:.022},
    ice:{base:[.36,.52,.59],high:[.75,.83,.83],craters:16,depth:.014},
    volcanic:{base:[.16,.14,.15],high:[.36,.27,.23],craters:19,depth:.025},
    rust:{base:[.40,.24,.17],high:[.66,.45,.30],craters:26,depth:.024},
    basalt:{base:[.16,.19,.22],high:[.37,.40,.42],craters:22,depth:.018}
  };
  const cache=new Map(),LIMIT=20;
  const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
  const normalize=v=>{const length=Math.hypot(...v)||1;return v.map(n=>n/length);};
  function seedFor(moon){
    const [x,y]=moon.id.split(':').map(Number);
    return (Math.imul(x,73856093)^Math.imul(y,19349663)^48271)>>>0;
  }
  function typeFor(moon){return moon.id==='0:0'?'cratered':Object.keys(presets)[seedFor(moon)%5];}
  function buildModel(moon,type=typeFor(moon)){
    const preset=presets[type]||presets.cratered,seed=seedFor(moon),rng=random(seed),phase=rng()*6.28;
    const craters=Array.from({length:preset.craters},()=>{
      const z=rng()*1.9-1,a=rng()*Math.PI*2,r=Math.sqrt(Math.max(0,1-z*z));
      return {direction:[Math.cos(a)*r,Math.sin(a)*r,z],size:.007+rng()*.065,depth:preset.depth*(.45+rng()),rim:.004+rng()*.008};
    });
    // A large old impact basin is visible on Selene as well as its smaller craters.
    craters.push({direction:normalize([-.29,.20,.94]),size:.12,depth:preset.depth*.7,rim:.005});
    function node(x,y){
      const z=Math.sqrt(Math.max(0,1-x*x-y*y)),d=[x,y,z];
      let h=0,occlusion=1,gradient=[0,0,0];
      for(const crater of craters){
        const distance=(1-dot(d,crater.direction))/crater.size;
        const bowl=Math.exp(-distance*4),rim=Math.exp(-Math.pow(distance-.65,2)*20);
        h-=crater.depth*bowl;h+=crater.rim*rim;
        const slope=crater.depth*4*bowl-crater.rim*40*(distance-.65)*rim;
        for(let i=0;i<3;i++)gradient[i]-=slope*crater.direction[i]/crater.size;
        occlusion-=bowl*.13;
      }
      const normal=normalize(d.map((v,i)=>v-(gradient[i]-v*dot(d,gradient))));
      const broad=Math.sin(x*6+phase)*Math.cos(y*5-phase)+Math.sin(z*7+y*3+phase)*.6;
      const grain=Math.sin(x*84+y*49+phase)*Math.cos(y*76-z*31);
      const maria=Math.max(0,Math.min(1,(broad+.6)*.5));
      const light=Math.max(0,dot(normal,[-.55,-.45,.70]));
      const brightness=.065+light*.92;
      const fracture=Math.pow(Math.max(0,1-Math.abs(Math.sin(x*19+y*8+Math.sin(y*14+phase)))*13),2);
      const color=preset.base.map((v,i)=>{
        let albedo=v*(1-maria)+preset.high[i]*maria;
        albedo*=.94+grain*.045;
        if(type==='ice')albedo*=1-fracture*.18;
        let lit=albedo*brightness*Math.max(.62,occlusion);
        // Lava is restricted to narrow fissures, leaving most of the surface dark.
        if(type==='volcanic')lit+=[.34,.07,.008][i]*fracture*Math.max(0,broad)*.5;
        const rim=type==='ice'?Math.pow(1-z,5)*light*[.04,.07,.09][i]:0;
        return Math.max(0,Math.min(1,lit+rim));
      });
      return [x*(1+h*.25),y*(1+h*.25),...color,1];
    }
    const rings=32,segments=96,nodes=[],data=[];
    for(let ring=0;ring<=rings;ring++){
      const rho=Math.sin(ring/rings*Math.PI/2),row=[];
      for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;row.push(node(Math.cos(a)*rho,Math.sin(a)*rho));}
      nodes.push(row);
    }
    function triangle(...points){for(const p of points)data.push(...p);}
    for(let ring=0;ring<rings;ring++)for(let i=0;i<segments;i++){
      const a=nodes[ring][i],b=nodes[ring+1][i],c=nodes[ring+1][i+1],e=nodes[ring][i+1];
      triangle(a,b,c);if(ring>0)triangle(a,c,e);
    }
    return {type,data:new Float32Array(data),craters:craters.length};
  }
  function modelFor(moon){
    const key=moon.id;let model=cache.get(key);
    if(model)cache.delete(key);else model=buildModel(moon);
    cache.set(key,model);while(cache.size>LIMIT)cache.delete(cache.keys().next().value);
    return model;
  }
  function render(moon,x,y){
    if(x < -moon.r-15||y < -moon.r-15||x>width+moon.r+15||y>height+moon.r+15)return;
    const data=modelFor(moon).data;
    // Write directly into the existing interleaved batch, avoiding per-frame triangle arrays.
    for(let i=0;i<data.length;i+=6)vertices.push(x+data[i]*moon.r,y+data[i+1]*moon.r,data[i+2],data[i+3],data[i+4],data[i+5]);
  }
  return {presets,typeFor,buildModel,render,get cacheSize(){return cache.size;}};
})();
