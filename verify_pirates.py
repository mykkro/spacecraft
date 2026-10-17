"""Isolated pirate combat and persistence checks: python verify_pirates.py."""
from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    url=(Path(__file__).parent/'index.html').as_uri()
    page.goto(url,wait_until='networkidle')
    page.wait_for_function("typeof Raiders!=='undefined'")
    page.locator('#confirmShip').click()
    assert page.evaluate("Raiders.zones().length===1&&Raiders.enemies.length===2")
    assert page.evaluate("(() => {for(let x=-3;x<4;x++)for(let y=-3;y<4;y++){const s=StarChart.system(x,y);if(!Raiders.riskFor(s).level)return Raiders.zones(s).length===0;}return false})()")
    page.evaluate('Raiders.update(4)')
    assert page.evaluate('ship.hull===100&&Raiders.enemies.every(e=>!e.aggro)&&Raiders.projectiles.length===0')
    page.keyboard.press('m')
    page.locator('#localMapTab').click()
    page.locator('[data-pirate-zone]').click()
    assert 'ARMED PIRATE TERRITORY' in page.locator('#mapDetails').inner_text()
    page.screenshot(path='pirate-map-preview.png')
    page.keyboard.press('Escape')
    # Patrols acquire the player, move, fire, and damage the hull.
    page.evaluate("const z=Raiders.zones()[0];ship.x=z.x;ship.y=z.y+450;ship.vx=ship.vy=0;ship.invulnerable=0;rocks.length=0;Raiders.resetEncounter();for(let i=0;i<40;i++){ship.invulnerable=Math.max(0,ship.invulnerable-.1);Raiders.update(.1)};paused=true;update(0);Weapons.scan();radar()")
    assert page.evaluate('Raiders.enemies.some(e=>e.aggro)&&ship.hull<100'),page.evaluate('({ship,enemies:Raiders.enemies,shots:Raiders.projectiles})')
    assert page.locator('#pirateAlert').is_visible()
    page.screenshot(path='pirate-combat-preview.png')
    snapshot=page.evaluate('JSON.stringify([Raiders.enemies,Raiders.projectiles,ship.hull])')
    page.wait_for_timeout(200)
    assert page.evaluate('JSON.stringify([Raiders.enemies,Raiders.projectiles,ship.hull])')==snapshot
    page.evaluate('paused=false;ship.x=800;ship.y=1700;Raiders.update(.1)')
    assert page.evaluate('Raiders.enemies.every(e=>!e.aggro)')
    # Surface visits suspend enemies and discard incoming fire.
    page.evaluate('ship.x=720;ship.y=-870;ship.vx=ship.vy=0;Colony.land()')
    before=page.evaluate('JSON.stringify(Raiders.enemies)')
    page.evaluate('Raiders.update(3)')
    assert page.evaluate('JSON.stringify(Raiders.enemies)')==before
    assert page.evaluate('Raiders.projectiles.length===0')
    assert page.locator('#pirateAlert').is_hidden()
    page.evaluate('Colony.launch()')
    # Rocks intercept player fire before it reaches a pirate.
    page.evaluate("""() => {
      paused=false;ship.x=3000;ship.y=2000;ship.angle=0;ship.vx=ship.vy=0;shots.length=rocks.length=0;
      const [a,b]=Raiders.enemies;a.x=3000;a.y=1800;a.hp=6;b.x=3500;b.y=2200;
      const cover=rock(3000,1900,35,555,'metal');cover.hardness=0;cover.hp=5;rocks.push(cover);
      Weapons.select('pulse');Weapons.cooldowns.primary.remaining=0;Weapons.fire('primary');Weapons.updateProjectiles(.4);
      if(a.hp!==6||cover.hp!==4)throw Error('Player cover failed');
      rocks.length=0;Weapons.cooldowns.primary.remaining=0;Weapons.fire('primary');Weapons.updateProjectiles(.4);
      if(a.hp!==5)throw Error('Player weapon cannot damage pirate');
      b.x=3035;b.y=1800;b.hp=6;
      Colony.addItem('seismic',1);Colony.addItem('ammo_seismic',1);Weapons.select('seismic');Weapons.cooldowns.missile.remaining=0;
      shots.length=0;Weapons.fire('missile');Weapons.updateProjectiles(1);
      if(Raiders.enemies.length||!Raiders.zones()[0].cleared||Raiders.defeated.length!==2)throw Error('Patrol destruction/blast failed');
      if(!drops.some(d=>d.type==='metal')||!drops.some(d=>d.type==='crystal'))throw Error('Missing pirate salvage');
    }""")
    # Pirate fire is also blocked by cover, and uses the shared hull recovery path.
    page.evaluate("""() => {
      ship.x=3000;ship.y=2000;ship.invulnerable=0;ship.hull=100;Raiders.projectiles.length=0;
      const cover=rock(3000,1900,35,555,'metal');rocks.push(cover);
      const bolt=()=>({x:3000,y:1800,vx:0,vy:400,life:2.6,damage:6});
      Raiders.projectiles.push(bolt());Raiders.update(.6);
      if(ship.hull!==100||Raiders.projectiles.length)throw Error('Pirate cover failed');
      rocks.length=0;Raiders.projectiles.push(bolt());Raiders.update(.6);
      if(ship.hull!==94)throw Error('Pirate hull damage failed');
      ship.hull=3;ship.invulnerable=0;Raiders.projectiles.push(bolt());Raiders.update(.6);
      if(ship.x!==0||ship.y!==0||ship.hull!==100||ship.invulnerable!==4)throw Error('Recovery failed');
      Colony.save();Raiders.save();
    }""")
    page.reload(wait_until='networkidle')
    assert page.evaluate('Raiders.defeated.length===2&&Raiders.enemies.length===0&&Raiders.zones()[0].cleared')
    assert page.evaluate('gl.getError()')==0
    assert not errors,errors
    print('PASS: safe start, quiet regions, map warnings, patrol pursuit/fire, hull damage, pause/surface safety, leash, bidirectional asteroid cover, missile blast, salvage, recovery, persistent clearing')
    browser.close()
