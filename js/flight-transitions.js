/**
 * Bounded screen-space travel/recovery animation in the existing WebGL batch.
 * Game state changes remain immediate and saved by their original callers.
 * Physics waits briefly for the visual transition; menus keep their pause state.
 */
const FlightTransitions = (() => {
  let effect=null;
  function start(kind) {
    if(!['wormhole','respawn'].includes(kind))return false;
    const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    effect={kind,elapsed:0,duration:reduced ? .3 : kind==='wormhole'?1.1:1.35,reduced};
    keys.clear();GameAudio.setEngine(0);
    return true;
  }
  function update(dt) {
    if(!effect||!Number.isFinite(dt)||dt<=0)return;
    effect.elapsed=Math.min(effect.duration,effect.elapsed+Math.min(dt,.05));
    GameAudio.setEngine(0);keys.clear();
    if(effect.elapsed>=effect.duration){effect=null;keys.clear();}
  }
  function render() {
    if(!effect)return;
    const p=effect.elapsed/effect.duration, fade=Math.sin(p*Math.PI);
    const cx=width/2,cy=height/2,reach=Math.hypot(width,height)*.6;
    const cover=effect.kind==='wormhole'?[.015,.035,.09]:[.025,.012,.018];
    // Gentle dark fade avoids full-screen white flashes.
    const color=[...cover,fade*.96];
    tri([0,0],[width,0],[width,height],color);
    tri([0,0],[width,height],[0,height],color);
    if(!effect.reduced) {
      if(effect.kind==='wormhole') {
        for(let ring=0;ring<10;ring++) {
          const phase=(ring/10+p*1.8)%1,r=12+phase*phase*reach;
          const alpha=fade*(1-phase)*.7;
          for(let i=0;i<40;i++) {
            const a=i/40*Math.PI*2+p*1.6+ring*.12,b=(i+1)/40*Math.PI*2+p*1.6+ring*.12;
            line([cx+Math.cos(a)*r,cy+Math.sin(a)*r*.68],
              [cx+Math.cos(b)*r,cy+Math.sin(b)*r*.68],[.25,.6+ring*.025,1,alpha],1+phase*3);
          }
        }
        for(let i=0;i<48;i++) {
          const a=i*2.39996,phase=(i*.137+p*2)%1,r=20+phase*phase*reach;
          line([cx+Math.cos(a)*r,cy+Math.sin(a)*r*.68],
            [cx+Math.cos(a)*(r+12+phase*65),cy+Math.sin(a)*(r+12+phase*65)*.68],
            [.55,.85,1,fade*(1-phase)],1.5);
        }
      } else {
        // Hull fragments spread, then a cool reconstruction wave closes in.
        if(p<.62) for(let i=0;i<36;i++) {
          const a=i*2.39996,r=(30+i%7*9)*p*6,size=2+i%4;
          const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
          tri([x-size,y+size],[x+size,y],[x,y-size],[1,.35+(i%4)*.1,.12,(1-p/.62)*.9]);
        }
        if(p>.35) {
          const r=15+(1-p)*150;
          for(let i=0;i<48;i++){
            const a=i/48*Math.PI*2,b=(i+1)/48*Math.PI*2;
            line([cx+Math.cos(a)*r,cy+Math.sin(a)*r],[cx+Math.cos(b)*r,cy+Math.sin(b)*r],
              [.35,.85,1,fade*.85],2);
          }
        }
      }
      const scale=p<.4?Math.max(.05,1-p/.4):Math.min(1,Math.max(.05,(p-.55)/.45));
      Shipyard.drawFlightShip(cx,cy,ship.angle,fade,scale);
    }
    flush2D();
  }
  return {start,update,render,get active(){return !!effect;}};
})();
