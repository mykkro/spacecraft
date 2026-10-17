/** Short-lived vacuum-style flashes, expanding plasma rings and hot debris. */
const SpaceEffects = (() => {
  const explosions = [];
  function spawn(x,y,size=40,type='metal') {
    const tint=type==='ice'?[.5,.8,1]:type==='crystal'?[.7,.5,1]:[1,.48,.18];
    const debris=Array.from({length:Math.min(24,Math.max(8,Math.round(size/4)))},()=>{
      const angle=Math.random()*Math.PI*2;
      return {dx:Math.cos(angle),dy:Math.sin(angle),speed:50+Math.random()*180,length:3+Math.random()*9};
    });
    explosions.push({x,y,size:Math.min(160,Math.max(12,size)),age:0,life:1.4,tint,debris});
    if(explosions.length>48)explosions.shift();
  }
  function update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for(let i=explosions.length-1;i>=0;i--){explosions[i].age+=dt;if(explosions[i].age>=explosions[i].life)explosions.splice(i,1);}
  }
  function render(screen) {
    for(const e of explosions) {
      const [x,y]=screen(e.x,e.y), t=e.age/e.life;
      if(x < -300 || x>width+300 || y < -300 || y>height+300)continue;
      const flash=Math.max(0,1-e.age/.3);
      if(flash>0) {
        disc(x,y,e.size*(.4+t*3),[...e.tint,flash*.16],24);
        disc(x,y,e.size*.22,[1,.94,.8,flash*.85],20);
      }
      const radius=e.size*(.4+t*2.4), alpha=(1-t)*.3;
      for(let i=0;i<48;i++) {
        const a=i/48*Math.PI*2,b=(i+1)/48*Math.PI*2;
        line([x+Math.cos(a)*radius,y+Math.sin(a)*radius],[x+Math.cos(b)*radius,y+Math.sin(b)*radius],[...e.tint,alpha],(1-t)*2+.4);
      }
      for(const d of e.debris) {
        const distance=d.speed*e.age, px=x+d.dx*distance,py=y+d.dy*distance;
        line([px,py],[px-d.dx*d.length*(1-t),py-d.dy*d.length*(1-t)],[...e.tint,(1-t)*.9],Math.max(.5,1.7*(1-t)));
      }
    }
  }
  return {spawn,update,render,get count(){return explosions.length;}};
})();
