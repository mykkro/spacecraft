"""Isolated real-browser checks: python tests/python/verify_weapons.py.

Uses local files and a fresh context; no player save is modified.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

preview_dir = Path(__file__).resolve().parents[2] / 'docs'
preview_dir.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.goto((Path(__file__).resolve().parents[2]/'index.html').as_uri(),wait_until='networkidle')
    page.wait_for_function("typeof Colony !== 'undefined' && typeof Weapons !== 'undefined'")
    page.locator('#confirmShip').click()
    assert page.evaluate("!Weapons.unlocked('laser') && !Weapons.select('laser')")
    assert page.locator('[data-weapon="laser"]').get_attribute('class').find('locked') >= 0
    # Hardness is a strict gate: repeated low-tier hits cannot chip a core away.
    page.evaluate("""() => {
      const r=rock(2000,2000,95,123,'metal');r.hardness=3;r.hp=20;rocks.push(r);
      for(let i=0;i<100;i++)Weapons.damageRock({tier:2,damage:100},r,false);
      if(r.hp!==20)throw Error('Tier gate bypassed');
      const before=rocks.length;
      if(!Weapons.damageRock({tier:3,damage:20},r,false)||rocks.includes(r))throw Error('Seismic cannot break core');
      const children=rocks.filter(c=>c.seed>=124&&c.seed<=126&&Math.hypot(c.x-2000,c.y-2000)<100);
      if(children.length!==3||children.some(c=>c.hardness!==2))throw Error('Split did not preserve reduced hardness');
    }""")
    # Craft each advanced weapon at a real placed workbench.
    page.evaluate("ship.x=720;ship.y=-870;ship.vx=ship.vy=0;Colony.land()")
    assert page.evaluate("Colony.selectBuild('bench');Colony.editTile(15,13,true)")
    assert page.evaluate("Colony.addItem('ingot',40)&&Colony.addItem('plate',40)&&Colony.addItem('crystal',40)")
    for recipe,weapon in [(7,'laser'),(8,'piercer'),(9,'seismic')]:
        assert page.evaluate(f'Colony.selectRecipe({recipe}) && Colony.craft()')
        assert page.evaluate(f"Colony.count('{weapon}')===1 && Weapons.unlocked('{weapon}')")
    assert page.evaluate("Colony.addItem('ammo_piercer',3)&&Colony.addItem('ammo_seismic',3)")
    # Inventory equip button works while the simulation is paused.
    page.keyboard.press('i')
    page.locator('.bag-grid button[data-item="laser"]').first.click()
    page.locator('#equipWeapon').click()
    assert page.evaluate("Weapons.selected.primary==='laser'")
    page.locator('#resume').click()
    page.evaluate('Colony.launch()')
    # One synchronous step avoids frame timing affecting the collision checks.
    page.evaluate("""() => {
      paused=false;rocks.length=0;shots.length=0;ship.x=ship.y=ship.vx=ship.vy=ship.angle=0;
      Weapons.cooldowns.primary.remaining=0;
      const r=rock(0,-220,45,555,'crystal');r.hardness=2;r.hp=4;rocks.push(r);
      if(!Weapons.fire('primary')||Weapons.fire('primary'))throw Error('Primary cooldown failed');
      Weapons.updateProjectiles(.4);
      if(rocks.includes(r))throw Error('Fast laser missed swept collision');
      if(!Weapons.select('rockbreaker'))throw Error('Cannot select built-in missile');
      Weapons.cooldowns.missile.remaining=0;
      if(!Weapons.fire('missile'))throw Error('Missile failed');
      const cd=Weapons.cooldowns.missile.remaining;
      Weapons.select('piercer');
      if(Weapons.fire('missile')||Weapons.cooldowns.missile.remaining!==cd)throw Error('Switch bypasses recharge');
      Weapons.select('seismic');Weapons.cooldowns.missile.remaining=0;shots.length=0;
      if(!Weapons.fire('missile'))throw Error('Seismic failed');
      paused=true;Weapons.updateHUD();
    }""")
    ring=page.locator('[data-weapon="seismic"] svg')
    assert ring.get_attribute('aria-valuenow') == '0'
    page.evaluate('Weapons.update(2.1)')
    assert ring.get_attribute('aria-valuenow') == '50'
    # Pausing the normal frame loop freezes the cooldown.
    remaining=page.evaluate('Weapons.cooldowns.missile.remaining')
    page.wait_for_timeout(250)
    assert page.evaluate('Weapons.cooldowns.missile.remaining') == remaining
    page.wait_for_function("[...document.querySelectorAll('#weaponHud img')].every(i=>i.complete&&i.naturalWidth>0)")
    page.evaluate('update(0);Weapons.scan()')
    page.screenshot(path=str(preview_dir / 'weapons-preview.png'))
    page.evaluate('Weapons.update(2.2)')
    assert ring.get_attribute('aria-valuenow') == '100'
    # Seismic blast destroys compatible nearby rocks, without hitting fresh shards.
    page.evaluate("""() => {
      rocks.length=0;shots.length=0;paused=false;Weapons.cooldowns.missile.remaining=0;
      const main=rock(0,-180,70,999,'metal');main.hardness=3;main.hp=20;
      const other=rock(70,-180,45,888,'ice');other.hardness=2;other.hp=12;
      rocks.push(main,other);Weapons.fire('missile');Weapons.updateProjectiles(.7);
      if(rocks.includes(main)||rocks.includes(other)||rocks.length!==6)throw Error('Seismic area damage failed');
      paused=true;
    }""")
    # Saved inventory and selected loadout survive a reload.
    page.evaluate('Colony.save()')
    page.reload(wait_until='networkidle')
    assert page.evaluate("Weapons.unlocked('seismic') && Weapons.selected.primary==='laser' && Weapons.selected.missile==='seismic'")
    assert page.evaluate('gl.getError()') == 0
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(150)
    assert page.locator('#weaponHud').bounding_box()['width'] <= 390
    page.evaluate("ship.x=720;ship.y=-870;ship.vx=ship.vy=0;ship.angle=0;rocks.length=0;const r=rock(720,-1100,80,222,'metal');r.hardness=3;rocks.push(r);update(0);Weapons.scan();paused=true")
    scan=page.locator('#rockScan').bounding_box()
    landing=page.locator('#landingPrompt').bounding_box()
    assert scan and landing and scan['y']+scan['height'] <= landing['y']
    page.screenshot(path=str(preview_dir / 'weapons-mobile-preview.png'))
    assert not errors,errors
    print('PASS: weapon crafting/equip, tier immunity, reduced fragment hardness, swept hits, shared cooldown, radial HUD, pause, blast damage, persistence, narrow viewport')
    browser.close()
