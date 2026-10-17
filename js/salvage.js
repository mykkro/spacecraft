/**
 * Seeded salvage objects, separate from mineable asteroids and inhabited stations.
 * Only damaged/discovered object records persist; live geometry uses a nine-system LRU.
 */
const Salvage = (() => {
  const tr=(en,cs)=>I18n.language==='cs'?cs:en;
  const cache=new Map(), records=new Map();
  const kinds=['ship','station','debris','debris','debris','debris','debris','debris'];
  function definition(gx,gy,index) {
    const rng=random(Math.imul(gx,73856093)^Math.imul(gy,19349663)^Math.imul(index+1,83492791)^81273);
    const kind=kinds[index],initial=gx===0&&gy===0;
    let x=gx*12000+(rng()-.5)*7800,y=gy*12000+(rng()-.5)*7800;
    if(initial&&index===0){x=-1100;y=650;}
    if(initial&&index===1){x=3200;y=-1700;}
    if(Math.hypot(x-gx*12000,y-gy*12000)<500)x+=800;
    if(!initial && Math.hypot(x-gx*12000-1800,y-gy*12000-1100)<1100){x=gx*12000-2800;y=gy*12000+2100+index*75;}
    const r=kind==='ship'?58:kind==='station'?135:16+rng()*20;
    const maxHp=kind==='ship'?22:kind==='station'?90:2+Math.floor(rng()*3);
    return {id:gx+':'+gy+':'+index,gx,gy,kind,x,y,r,maxHp,
      tier:kind==='station'?2:kind==='ship'?1:0,angle:rng()*Math.PI*2,seed:Math.floor(rng()*1e8)};
  }
  function forSystem(gx,gy) {
    const key=gx+':'+gy;
    let objects=cache.get(key);
    if(objects)cache.delete(key);else objects=kinds.map((_,i)=>definition(gx,gy,i));
    cache.set(key,objects);
    while(cache.size>9)cache.delete(cache.keys().next().value);
    return objects.filter(o=>(records.get(o.id)?.hp??o.maxHp)>0);
  }
  function nearby() {
    const gx=Math.floor((ship.x+6000)/12000),gy=Math.floor((ship.y+6000)/12000),out=[];
    for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++)out.push(...forSystem(x,y));
    return out;
  }
  function snapshot(){return [...records].map(([id,state])=>({id,...state}));}
  function restore(saved) {
    if(!Array.isArray(saved))return;
    for(const row of saved) {
      if(!row||typeof row.id!=='string'||! /^-?\d{1,7}:-?\d{1,7}:[0-7]$/.test(row.id))continue;
      const [gx,gy,index]=row.id.split(':').map(Number),object=definition(gx,gy,index);
      if(!Number.isFinite(row.hp)||row.hp<0||row.hp>object.maxHp)continue;
      records.set(row.id,{hp:row.hp,seen:row.seen===true});
    }
  }
  try{restore(JSON.parse((typeof Profiles==='undefined'?localStorage:Profiles).getItem('spacecraft-save-v1')||'null')?.salvage);}catch{}
  function name(o){return o.kind==='ship'?tr('Derelict ship','Opuštěná loď'):o.kind==='station'?tr('Derelict starbase','Opuštěná stanice'):tr('Cosmic debris','Vesmírný šrot');}
  // Exact segment/circle intersection, including shots starting inside a target.
  function intersection(x0,y0,x1,y1,o) {
    const dx=x1-x0,dy=y1-y0,ox=x0-o.x,oy=y0-o.y,r=o.r*.82;
    const c=ox*ox+oy*oy-r*r;if(c<=0)return 0;
    const a=dx*dx+dy*dy;if(!a)return null;
    const b=2*(ox*dx+oy*dy),d=b*b-4*a*c;if(d<0)return null;
    const t=(-b-Math.sqrt(d))/(2*a);return t>=0&&t<=1?t:null;
  }
  function sweep(x0,y0,x1,y1) {
    let best=null;
    for(const object of nearby()){
      const t=intersection(x0,y0,x1,y1,object);
      if(t!==null&&(!best||t<best.t))best={object,t};
    }
    return best;
  }
  function hit(projectile,object,feedback=true) {
    const hp=records.get(object.id)?.hp??object.maxHp;
    if(hp<=0||!Number.isFinite(projectile.damage)||projectile.damage<=0)return false;
    if((projectile.tier||0)<object.tier){
      if(feedback){GameAudio.play('blocked',{x:object.x,y:object.y});notify(name(object)+' · '+tr('Requires weapon tier ','Vyžaduje zbraň úrovně ')+object.tier);}
      return false;
    }
    const next=Math.max(0,hp-projectile.damage);
    records.set(object.id,{hp:next,seen:true});
    GameAudio.play(next===0?'explosion':'impact',{x:object.x,y:object.y});
    if(next===0){
      if(typeof SpaceEffects!=='undefined')SpaceEffects.spawn(object.x,object.y,object.r,'metal');
      const loot=object.kind==='station'?[['plate',6],['ingot',8],['crystal',3],['ammo_piercer',3],['repair_pack',1]]
        :object.kind==='ship'?[['metal',6],['plate',2],['fuel_cell',2],['ammo_rockbreaker',3]]
        :[['metal',2],['ingot',1]];
      loot.forEach(([type,qty],i)=>drops.push({x:object.x+Math.cos(i*2.4)*28,y:object.y+Math.sin(i*2.4)*28,type,qty,life:120,source:'salvage'}));
      notify(name(object)+' · '+tr('SALVAGE RELEASED','UVOLNĚN NÁKLAD'));
    }
    Colony.save();return true;
  }
  function blast(projectile,exclude=null) {
    for(const o of nearby())if(o!==exclude&&Math.hypot(o.x-projectile.x,o.y-projectile.y)<projectile.blast+o.r*.5)hit(projectile,o,false);
  }
  function update() {
    let changed=false;
    for(const o of nearby()){
      const distance=Math.hypot(o.x-ship.x,o.y-ship.y);
      if(distance<2200&&!records.get(o.id)?.seen){
        records.set(o.id,{hp:records.get(o.id)?.hp??o.maxHp,seen:true});changed=true;
      }
    }
    if(changed)Colony.save();
  }
  function collide() {
    for(const o of nearby()){
      const dx=ship.x-o.x,dy=ship.y-o.y,d=Math.hypot(dx,dy),radius=o.r*.82+14;
      if(d>=radius)continue;
      const nx=d?dx/d:1,ny=d?dy/d:0,impact=Math.max(0,-(ship.vx*nx+ship.vy*ny));
      ship.x=o.x+nx*radius;ship.y=o.y+ny*radius;
      if(impact>0){ship.vx+=nx*impact*1.25;ship.vy+=ny*impact*1.25;}
      if(impact>35)damageShip(Math.min(18,impact*.035),tr('COLLISION WITH WRECKAGE','SRÁŽKA S VRAKEM'));
      return;
    }
  }
  function render(screen) {
    for(const o of nearby()){
      const [x,y]=screen(o.x,o.y);if(x < -o.r*1.5||y < -o.r*1.5||x>width+o.r*1.5||y>height+o.r*1.5)continue;
      const project=(a,b)=>[x+(a*Math.cos(o.angle)-b*Math.sin(o.angle))*o.r,y+(a*Math.sin(o.angle)+b*Math.cos(o.angle))*o.r];
      if(o.kind==='debris'){
        const rng=random(o.seed),points=Array.from({length:7},(_,i)=>{const a=i/7*Math.PI*2,r=.6+rng()*.4;return project(Math.cos(a)*r,Math.sin(a)*r);});
        for(let i=0;i<7;i++)tri([x,y],points[i],points[(i+1)%7],i%2?[.2,.24,.27,1]:[.3,.32,.31,1]);
        line(project(-.4,-.3),project(.45,.2),[.65,.4,.2,.9],3);
      }else if(o.kind==='ship'){
        WorldArt.drawShip('nomad',x,y,o.angle,.8,o.r/32,0);
        tri(project(-.2,-.8),project(.8,.1),project(-.1,.45),[.025,.035,.045,1]);
        line(project(-.55,-.2),project(.4,.55),[.65,.35,.18,1],3);
        line(project(.3,.8),project(.95,1),[.3,.34,.36,1],5);
      }else{
        // Broken station ring, exposed ribs and disconnected solar wings.
        for(let i=0;i<30;i++){
          if((i>4&&i<9)||(i>19&&i<23))continue;
          const a=i/30*Math.PI*2,b=(i+1)/30*Math.PI*2;
          line(project(Math.cos(a)*.7,Math.sin(a)*.7),project(Math.cos(b)*.7,Math.sin(b)*.7),[.29,.34,.37,1],o.r*.12);
          if(i%3===0)line(project(0,0),project(Math.cos(a)*.65,Math.sin(a)*.65),[.19,.23,.26,1],4);
        }
        disc(x,y,o.r*.22,[.12,.15,.17,1],8);
        for(const side of [-1,1]){
          const a=project(side*.8,-.2),b=project(side*1.2,-.13),c=project(side*1.12,.35);
          tri(a,b,c,[.13,.22,.28,1]);line(a,c,[.47,.32,.18,1],3);
        }
      }
      // Scorched damage marks and a small salvage beacon remain readable in the dark.
      if((records.get(o.id)?.hp??o.maxHp)<o.maxHp)disc(x,y,o.r*.15,[.035,.025,.02,.8],7);
      disc(x+o.r*.25,y-o.r*.2,2,[.95,.57,.2,.75],5);
    }
  }
  function known(){return [...records].filter(([,s])=>s.seen&&s.hp>0).map(([id])=>definition(...id.split(':').map(Number))).filter(o=>o.kind!=='debris');}
  function marker(pen,x,y,label){
    pen.save();pen.strokeStyle='#bd9c81';pen.lineWidth=1.5;pen.strokeRect(x-5,y-5,10,10);
    pen.beginPath();pen.moveTo(x-5,y+5);pen.lineTo(x+5,y-5);pen.stroke();
    if(label){pen.font='11px monospace';pen.fillStyle='#bd9c81';pen.fillText(label,x+9,y-8);}pen.restore();
  }
  function drawRadar(pen){
    for(const o of known()){
      const dx=o.x-ship.x,dy=o.y-ship.y,d=Math.hypot(dx,dy);if(d>2400)continue;
      const scale=Math.min(1,65/(d/16||1));
      marker(pen,78+dx/16*scale,78+dy/16*scale);
    }
  }
  function drawLocal(pen,project){
    const gx=Math.floor((ship.x+6000)/12000),gy=Math.floor((ship.y+6000)/12000);
    for(const o of known())if(o.gx===gx&&o.gy===gy){const p=project(o.x,o.y);marker(pen,p.x,p.y,name(o));}
  }
  function drawGlobal(pen,project){
    for(const o of known()){const p=project({gx:o.x/12000,gy:o.y/12000});marker(pen,p.x,p.y);}
  }
  return {forSystem,nearby,snapshot,restore,sweep,hit,blast,update,collide,render,known,drawRadar,drawLocal,drawGlobal,get cacheSize(){return cache.size;}};
})();
