"""Isolated browser checks for scanner, maps, discovery, and wormhole travel.

Run: python tests/python/verify_navigation.py
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
    url=(Path(__file__).resolve().parents[2]/'index.html').as_uri()
    page.goto(url,wait_until='networkidle')
    page.wait_for_function("typeof StarChart !== 'undefined'")
    page.locator('#confirmShip').click()
    assert page.evaluate("!StarChart.online()&&StarChart.signals().length===0&&StarChart.located.length===1&&StarChart.visited.length===1")
    assert page.evaluate("(() => {let n=0;const c=new Proxy({}, {get:(t,k)=>k==='fill'?()=>{if(['#7cd5e2','#dfb878'].includes(t.fillStyle))n++}:()=>{}});StarChart.drawRadar(c);return n===0})()")
    page.keyboard.press('m')
    assert page.evaluate('StarChart.mapOpen&&paused')
    assert page.locator('[data-portal]').count()==0
    page.locator('#globalMapTab').click()
    assert page.locator('[data-system]').count()==1
    page.keyboard.press('Escape')
    assert page.evaluate('!StarChart.mapOpen&&!paused')
    # Map overlays preserve an existing inventory pause and restore that dialog.
    page.keyboard.press('i')
    page.keyboard.press('m')
    assert page.locator('#overlay').is_hidden()
    page.keyboard.press('m')
    assert page.evaluate('paused&&!StarChart.mapOpen')
    assert page.locator('#overlay').is_visible()
    page.keyboard.press('Escape')
    # Craft the machine using its actual station and recipe.
    page.evaluate('ship.x=720;ship.y=-870;ship.vx=ship.vy=0;Colony.land()')
    assert page.evaluate("Colony.selectBuild('bench');Colony.editTile(15,13,true)")
    assert page.evaluate("Colony.addItem('ingot',3)&&Colony.addItem('plate',2)&&Colony.addItem('glass',1)")
    assert page.evaluate('Colony.selectRecipe(10)&&Colony.craft()')
    assert page.evaluate("Colony.count('scanner')===1&&StarChart.online()")
    assert page.evaluate("Colony.count('ingot')===0&&Colony.count('plate')===0&&Colony.count('glass')===0")
    assert page.evaluate("(() => {const old=[ship.x,ship.y],north=StarChart.portals()[0].id;ship.x=5900;ship.y=5900;const ok=!StarChart.signals().some(p=>p.id===north);[ship.x,ship.y]=old;return ok})()")
    page.keyboard.press('m')
    page.locator('#localMapTab').click()
    assert page.locator('[data-portal]').count()==4
    assert page.evaluate('StarChart.located.length===5&&StarChart.visited.length===1')
    page.locator('[data-portal]').first.click()
    tracked=page.evaluate('StarChart.tracked')
    assert tracked
    # A receiver supplies offscreen bearing arrows to the minimap.
    assert page.evaluate("(() => {let n=0;const c=new Proxy({}, {get:(t,k)=>k==='fill'?()=>{if(['#7cd5e2','#dfb878'].includes(t.fillStyle))n++}:()=>{}});StarChart.drawRadar(c);return n===4})()")
    page.screenshot(path=str(preview_dir / 'local-map-preview.png'))
    page.locator('#globalMapTab').click()
    unvisited=page.locator('[data-system]').filter(has_text='NOT VISITED').first
    old_pos=page.evaluate('[ship.x,ship.y]')
    unvisited.click()
    assert page.evaluate('[ship.x,ship.y]')==old_pos
    assert 'NOT YET VISITED' in page.locator('#mapDetails').inner_text()
    assert not page.evaluate('StarChart.enter()')
    page.screenshot(path=str(preview_dir / 'global-map-preview.png'))
    page.keyboard.press('m')
    assert page.evaluate('!paused&&Colony.onSurface')
    page.evaluate('Colony.launch()')
    source=page.evaluate('StarChart.current().id')
    portal=page.evaluate('StarChart.portals()[0]')
    # Entry requires proximity, slow speed, and active flight.
    page.evaluate(f"ship.x={portal['x']+200};ship.y={portal['y']};ship.vx=ship.vy=0")
    assert not page.evaluate('StarChart.enter()')
    page.evaluate(f"ship.x={portal['x']};ship.y={portal['y']};ship.vx=200;ship.vy=0")
    assert not page.evaluate('StarChart.enter()')
    page.evaluate('ship.vx=0')
    page.keyboard.press('e')
    assert page.evaluate('StarChart.current().id')==portal['to']
    assert page.evaluate('StarChart.visited.length')==2
    assert page.evaluate('Math.hypot(ship.vx,ship.vy)===0')
    reverse=page.evaluate(f"StarChart.portals().find(p=>p.to==='{source}')")
    page.evaluate(f"ship.x={reverse['x']};ship.y={reverse['y']};ship.vx=ship.vy=0")
    assert not page.evaluate('StarChart.enter()')  # transit stabilization
    page.evaluate('StarChart.update(2.6);StarChart.discover()')
    assert page.evaluate('StarChart.located.length>StarChart.visited.length')
    # Tracking and visited knowledge survive reloading at the destination.
    destination=page.evaluate('StarChart.current().id')
    page.evaluate('StarChart.track(StarChart.signals()[0].id);Colony.save();StarChart.save()')
    selected=page.evaluate('StarChart.tracked')
    page.reload(wait_until='networkidle')
    assert page.evaluate('StarChart.current().id')==destination
    assert page.evaluate('StarChart.tracked')==selected
    assert page.evaluate('StarChart.visited.length')==2
    page.evaluate('StarChart.update(2.6)')
    assert page.evaluate('StarChart.enter()')
    assert page.evaluate('StarChart.current().id')==source
    # The original moon base remains in the same physical universe.
    page.evaluate('ship.x=720;ship.y=-870;ship.vx=ship.vy=0;Colony.land()')
    assert page.evaluate("Colony.surface[13][15]==='bench'")
    page.keyboard.press('m')
    page.locator('#globalMapTab').click()
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(150)
    assert page.locator('#mapOverlay section').bounding_box()['width']<=390
    assert page.locator('#chart').bounding_box()['height']>=230
    page.screenshot(path=str(preview_dir / 'map-mobile-preview.png'))
    page.keyboard.press('Escape')
    assert not page.evaluate('StarChart.mapOpen')
    page.evaluate('Colony.launch();ship.x=36000;ship.y=0;StarChart.update(0)')
    assert page.evaluate("StarChart.visited.includes('3:0')")  # ordinary flight also records visits
    assert page.evaluate('gl.getError()')==0
    assert not errors,errors
    print('PASS: scanner crafting/gating, radar bearings, local/global maps, pause restoration, located vs visited, travel limits, reciprocal transit, persistence, bases, mobile layout')
    browser.close()
