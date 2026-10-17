/** One profile-saved quest target. Resolved live as the ship/courier moves. */
const QuestTracker = (() => {
  const tr=(en,cs)=>I18n.language==='cs'?cs:en;
  let selected=null, clock=0;
  try { const id=JSON.parse((typeof Profiles==='undefined'?localStorage:Profiles).getItem('spacecraft-save-v1')||'null')?.trackedQuest;
    if(typeof id==='string')selected=id; } catch {}
  const hud=document.createElement('div');hud.id='trackedQuest';hud.hidden=true;document.body.append(hud);
  function definition() { return typeof QuestLog==='undefined'?null:QuestLog.getDefinition(selected); }
  function track(id) {
    if(id!==null&&(!QuestLog.getDefinition(id)||Colony.questProgress().claimed.includes(id)))return false;
    selected=id;Colony.save();QuestLog.refresh();update(1);return true;
  }
  function target() {
    const q=definition();
    if(!q||Colony.questProgress().claimed.includes(q.id))return null;
    if(q.kind==='delivery') {
      if(MissionContracts.state(q.id)!=='active')return null;
      return {...Starbases.station(...q.destination.split(':').map(Number)),system:q.destination};
    }
    if(q.kind==='escort') {
      const courier=MissionContracts.courier;
      if(courier?.status==='active')return {...courier,system:'0:0',name:tr('Protect courier','Chraňte kurýra')};
      if(courier?.status==='complete')return {...Starbases.station(0,0),system:'0:0'};
      return {x:-1800,y:-900,system:'0:0',name:tr('Courier rendezvous','Setkání s kurýrem')};
    }
    if(QuestLog.canClaim(q.id))return null;
    const candidates=q.kind==='mined'
      ? (typeof rocks==='undefined'?[]:rocks).filter(r=>r.type===q.material)
      : Colony.getMoons().filter(m=>!Colony.getBases().some(b=>b.id===m.id&&b.isBase));
    const nearest=candidates.slice().sort((a,b)=>Math.hypot(a.x-ship.x,a.y-ship.y)-Math.hypot(b.x-ship.x,b.y-ship.y))[0];
    return nearest?{...nearest,system:StarChart.system(Math.floor((nearest.x+6000)/12000),Math.floor((nearest.y+6000)/12000)).id,
      name:q.kind==='mined'?Colony.items[q.material].name:nearest.name}:null;
  }
  function waypoint() {
    const goal=target();if(!goal)return null;
    const current=StarChart.current();
    if(goal.system===current.id)return {...goal,via:false};
    const [gx,gy]=goal.system.split(':').map(Number);
    // Wormholes connect cardinal neighbours. Pick a hop that reduces system distance.
    const portals=StarChart.portals().filter(p=>{
      const [x,y]=p.to.split(':').map(Number);
      return Math.abs(x-gx)+Math.abs(y-gy)<Math.abs(current.gx-gx)+Math.abs(current.gy-gy);
    }).sort((a,b)=>Math.hypot(a.x-ship.x,a.y-ship.y)-Math.hypot(b.x-ship.x,b.y-ship.y));
    return portals[0]?{...portals[0],via:true,name:tr('Wormhole to ','Vormhoul do ')+portals[0].to}:null;
  }
  function update(dt) {
    clock+=dt;if(clock<.25)return;clock=0;
    const q=definition();
    hud.hidden=!q;
    if(!q)return;
    const p=waypoint();
    const status=Colony.questProgress().claimed.includes(q.id)?tr('Reward claimed','Odměna vyzvednuta'):
      QuestLog.canClaim(q.id)?tr('Reward ready — open J','Odměna připravena — otevřete J'):
      p?p.name+' · '+Math.round(Math.hypot(p.x-ship.x,p.y-ship.y))+' m':
      tr('Explore for resources / accept contract in J','Hledejte suroviny / přijměte zakázku klávesou J');
    hud.textContent=q.title+' · '+status;
  }
  function marker(pen,x,y,label) {
    pen.save();pen.strokeStyle='#ffdb75';pen.fillStyle='#ffdb75';pen.lineWidth=2;
    pen.beginPath();pen.moveTo(x,y-7);pen.lineTo(x+7,y);pen.lineTo(x,y+7);pen.lineTo(x-7,y);pen.closePath();pen.stroke();
    if(label){pen.font='12px monospace';pen.fillText(label,x+11,y-9);}pen.restore();
  }
  function drawRadar(pen) {
    const p=waypoint();if(!p)return;
    const dx=p.x-ship.x,dy=p.y-ship.y,d=Math.hypot(dx,dy)||1,s=Math.min(1,65/(d/16));
    const x=78+dx/16*s,y=78+dy/16*s;
    marker(pen,x,y);
    if(d/16>65) {
      pen.save();pen.translate(x,y);pen.rotate(Math.atan2(dy,dx));pen.fillStyle='#ffdb75';
      pen.beginPath();pen.moveTo(6,0);pen.lineTo(-3,-4);pen.lineTo(-3,4);pen.closePath();pen.fill();pen.restore();
    }
  }
  function drawLocal(pen,project) {
    const p=waypoint();if(!p)return;
    const a=project(ship.x,ship.y),b=project(p.x,p.y);
    pen.save();pen.strokeStyle='#ffdb7580';pen.setLineDash([5,5]);pen.beginPath();pen.moveTo(a.x,a.y);pen.lineTo(b.x,b.y);pen.stroke();pen.restore();
    marker(pen,b.x,b.y,p.name);
  }
  function drawGlobal(pen,project) {
    const goal=target();if(!goal)return;
    const [gx,gy]=goal.system.split(':').map(Number),p=project({gx,gy});
    marker(pen,p.x,p.y,definition().title);
    const next=waypoint();
    if(next?.via) {
      const a=project(StarChart.current()),[x,y]=next.to.split(':').map(Number),b=project({gx:x,gy:y});
      pen.save();pen.strokeStyle='#ffdb75';pen.setLineDash([5,5]);pen.beginPath();pen.moveTo(a.x,a.y);pen.lineTo(b.x,b.y);pen.stroke();pen.restore();
    }
  }
  return {track,target,waypoint,update,drawRadar,drawLocal,drawGlobal,get selected(){return selected;},snapshot:()=>selected};
})();
