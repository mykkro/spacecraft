/**
 * Seeded gravity hazards. One compact field per selected system; no world cache.
 * Newtonian attraction is deliberately gameplay-scaled, not a relativistic sim.
 */
const BlackHoles = (() => {
  const tr=(en,cs)=>I18n.language==='cs'?cs:en;
  let before={x:0,y:0}, active=[], warningClock=0;
  function forSystem(gx,gy) {
    const rng=random(Math.imul(gx,71419)^Math.imul(gy,3989)^9147);
    if((gx!==0||gy!==0)&&rng()>.38)return [];
    const sx=gx===0&&gy===0?-1:rng()<.5?-1:1, sy=gx===0&&gy===0?1:rng()<.5?-1:1;
    return [{id:gx+':'+gy,name:tr('Black hole','Černá díra')+' '+gx+':'+gy,gx,gy,
      x:gx*12000+sx*3500,y:gy*12000+sy*3500,r:80+Math.floor(rng()*15),influence:1900,gravity:60000000}];
  }
  function nearby(){return forSystem(Math.floor((ship.x+6000)/12000),Math.floor((ship.y+6000)/12000));}
  function getById(id) {
    if(typeof id!=='string'||!/^[-]?\d{1,7}:[-]?\d{1,7}$/.test(id))return null;
    return forSystem(...id.split(':').map(Number))[0]||null;
  }
  function acceleration(hole,x,y) {
    const dx=hole.x-x,dy=hole.y-y,d=Math.hypot(dx,dy);
    if(d>=hole.influence||d<.001)return [0,0];
    const strength=Math.min(1200,hole.gravity/(d*d+3600));
    return [dx/d*strength,dy/d*strength];
  }
  function applyGravity(dt) {
    before={x:ship.x,y:ship.y};active=nearby();warningClock-=dt;
    const warning=document.querySelector('#blackHoleWarning');
    warning.hidden=true;
    for(const hole of active) {
      const d=Math.hypot(ship.x-hole.x,ship.y-hole.y), [ax,ay]=acceleration(hole,ship.x,ship.y);
      ship.vx+=ax*dt;ship.vy+=ay*dt;
      if(d<hole.influence+400) {
        warning.hidden=false;
        warning.textContent=(d<700?tr('CRITICAL GRAVITY','KRITICKÁ GRAVITACE'):tr('BLACK HOLE AHEAD','POZOR, ČERNÁ DÍRA'))+
          ' · '+Math.round(d)+' m · '+tr('THRUST AWAY / BOOST TO ESCAPE','LEŤTE PRYČ / ZRYCHLETE K ÚNIKU');
        if(warningClock<=0){GameAudio.play('alert');warningClock=8;}
      }
      for(let i=rocks.length-1;i>=0;i--) {
        const rock=rocks[i], distance=Math.hypot(rock.x-hole.x,rock.y-hole.y);
        if(distance<hole.r){rocks.splice(i,1);continue;}
        const [x,y]=acceleration(hole,rock.x,rock.y);rock.vx+=x*dt*.4;rock.vy+=y*dt*.4;
      }
      if(typeof drops!=='undefined')for(let i=drops.length-1;i>=0;i--){
        const drop=drops[i],distance=Math.hypot(drop.x-hole.x,drop.y-hole.y);
        if(distance<hole.r){drops.splice(i,1);continue;}
        const [x,y]=acceleration(hole,drop.x,drop.y);drop.x+=x*dt*.18;drop.y+=y*dt*.18;
      }
    }
  }
  function checkCapture() {
    for(const hole of active) {
      const dx=ship.x-before.x,dy=ship.y-before.y,length=dx*dx+dy*dy;
      const t=length?Math.max(0,Math.min(1,((hole.x-before.x)*dx+(hole.y-before.y)*dy)/length)):0;
      if(Math.hypot(before.x+dx*t-hole.x,before.y+dy*t-hole.y)>hole.r+12)continue;
      // Emergency recovery preserves cargo but costs hull; shields cannot stop gravity.
      if(typeof SpaceEffects!=='undefined')SpaceEffects.spawn(hole.x,hole.y,90,'crystal');
      if(typeof Shields!=='undefined')Shields.absorb(Shields.capacity);
      ship.x=ship.y=ship.vx=ship.vy=0;ship.hull=Math.max(15,ship.hull-35);ship.invulnerable=4;
      if(typeof generate==='function') {
        rocks.length=0;
        if(typeof shots!=='undefined')shots.length=0;
        if(typeof particles!=='undefined')particles.length=0;
        if(typeof drops!=='undefined')drops.length=0;
        if(typeof chunks!=='undefined')chunks.clear();
        generate();
      }
      if(typeof Raiders!=='undefined')Raiders.resetEncounter();
      if(typeof FlightTransitions!=='undefined')FlightTransitions.start('respawn');
      GameAudio.play('wormhole');Colony.save();
      notify(tr('EVENT HORIZON · EMERGENCY RECOVERY · HULL DAMAGED','HORIZONT UDÁLOSTÍ · NOUZOVÁ ZÁCHRANA · POŠKOZENÝ TRUP'));
      document.querySelector('#blackHoleWarning').hidden=true;
      return true;
    }
    return false;
  }
  function render(screen) {
    for(const hole of nearby()) {
      const [x,y]=screen(hole.x,hole.y), r=hole.r;
      if(x < -r*4 || x>width+r*4 || y < -r*4 || y>height+r*4)continue;
      // Flattened accretion bands behind a dark event horizon and photon ring.
      for(let ring=0;ring<5;ring++)for(let i=0;i<72;i++){
        const a=i/72*Math.PI*2,b=(i+1)/72*Math.PI*2, radius=r*(1.4+ring*.35);
        const brightness=.35+.55*Math.max(0,Math.cos(a+time*.6));
        line([x+Math.cos(a)*radius,y+Math.sin(a)*radius*.38],
          [x+Math.cos(b)*radius,y+Math.sin(b)*radius*.38],[1,.42+ring*.06,.18,brightness*.3],3+ring*.8);
      }
      disc(x,y,r,[.002,.003,.008,1],64);
      for(let i=0;i<72;i++){
        const a=i/72*Math.PI*2,b=(i+1)/72*Math.PI*2;
        line([x+Math.cos(a)*r*1.07,y+Math.sin(a)*r*1.07],[x+Math.cos(b)*r*1.07,y+Math.sin(b)*r*1.07],[.82,.63,1,.5],2);
      }
      for(let i=0;i<40;i++){
        const a=i/40*Math.PI*2+time*.18, radius=r*(1.3+((i*.173+time*.08)%1)*1.8);
        disc(x+Math.cos(a)*radius,y+Math.sin(a)*radius*.38,1.3,[1,.7,.4,.55],4);
      }
    }
  }
  function drawLocal(pen,project) {
    for(const hole of nearby()){
      const p=project(hole.x,hole.y),edge=project(hole.x+hole.influence,hole.y);
      pen.save();pen.strokeStyle='#ca83de66';pen.fillStyle='#9b468714';pen.setLineDash([4,6]);
      pen.beginPath();pen.arc(p.x,p.y,Math.abs(edge.x-p.x),0,Math.PI*2);pen.fill();pen.stroke();pen.setLineDash([]);
      drawMarker(pen,p.x,p.y,hole.name);pen.restore();
    }
  }
  function drawMarker(pen,x,y,name) {
    pen.save();pen.fillStyle='#03040b';pen.strokeStyle='#d49cf0';pen.lineWidth=2;
    pen.beginPath();pen.arc(x,y,6,0,Math.PI*2);pen.fill();pen.stroke();
    if(name){pen.font='10px monospace';pen.fillStyle='#e4afea';pen.fillText(name,x+11,y-9);}
    pen.restore();
  }
  function drawRadar(pen) {
    for(const hole of nearby()){
      const dx=(hole.x-ship.x)/16,dy=(hole.y-ship.y)/16,d=Math.hypot(dx,dy)||1,scale=Math.min(1,66/d);
      drawMarker(pen,78+dx*scale,78+dy*scale);
    }
  }
  return {forSystem,nearby,getById,acceleration,applyGravity,checkCapture,render,drawLocal,drawMarker,drawRadar};
})();
