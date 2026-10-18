"""Run against the local server: python tests/python/verify_browser.py.

Uses an isolated browser context; the player's save is unaffected.
"""
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('requestfailed', lambda r: print('REQUEST FAILED:', r.url, r.failure, flush=True))
    url = (Path(__file__).resolve().parents[2] / 'index.html').as_uri() if '--file' in sys.argv else 'http://127.0.0.1:3333'
    page.goto(url, wait_until='networkidle')
    page.wait_for_function("typeof Colony !== 'undefined'")
    page.locator('#confirmShip').click()
    # Every defined item has a local generated icon, including items not yet crafted.
    for item in page.evaluate("Object.entries(Colony.items).map(([type,item])=>item.asset||((item.image||type)+'.png'))"):
        path = Path(__file__).resolve().parents[2] / 'assets' / 'items' / item
        with path.open('rb') as asset:
            if path.suffix == '.png':
                assert asset.read(8) == b'\x89PNG\r\n\x1a\n', f'Invalid PNG: {item}'
            else:
                assert b'<svg' in asset.read(), f'Invalid SVG: {item}'
    page.keyboard.press('i')
    assert page.locator('.bag-grid .item-slot').count() == 30
    assert page.locator('[data-station="bench"]').is_disabled()
    assert page.locator('[data-station="furnace"]').is_disabled()
    before = page.evaluate("Colony.count('stone')")
    page.locator('[data-recipe="1"]').click()
    page.locator('#craftItem').click()
    assert page.evaluate("Colony.count('stone')") == before - 2
    assert page.evaluate("Colony.count('block')") == 16
    assert page.evaluate("(() => {const n=Colony.count('stone');return !Colony.addItem('stone',1920)&&Colony.count('stone')===n})()")
    page.locator('#resume').click()
    page.evaluate('ship.x=720;ship.y=-870;ship.vx=ship.vy=0;Colony.land()')
    assert page.evaluate('Colony.onSurface')
    assert page.evaluate("Colony.selectBuild('bench');Colony.editTile(15,13,true)")
    assert page.evaluate('Colony.selectRecipe(2) && Colony.craft()')
    assert page.evaluate("Colony.count('furnace')") == 1
    assert page.evaluate("Colony.selectBuild('furnace');Colony.editTile(15,12,true)")
    assert page.evaluate('Colony.selectRecipe(5) && Colony.craft() && Colony.craft()')
    assert page.evaluate("Colony.count('ingot')") == 2
    assert page.evaluate('Colony.selectRecipe(3) && Colony.craft()')
    assert page.evaluate("Colony.count('plate')") == 2
    assert page.evaluate('Colony.selectRecipe(6) && Colony.craft()')
    assert page.evaluate("Colony.count('glass')") == 2
    # Crafting requires a physical station, even with a previously selected recipe.
    assert page.evaluate("(() => {const x=Colony.player.x;Colony.player.x=40;const ok=!Colony.craft()&&!Colony.selectRecipe(2);Colony.player.x=x;return ok})()")
    assert not page.evaluate('Colony.editTile(90,30,false)')
    assert not page.evaluate('Colony.editTile(16,14,false)')  # bench blocks line of sight
    assert page.evaluate('Colony.editTile(14,14,false)')
    page.keyboard.press('i')
    assert page.locator('[data-station="bench"]').is_enabled()
    assert page.locator('[data-station="furnace"]').is_enabled()
    try:
        page.wait_for_function("[...document.querySelectorAll('#slots img.item-icon')].every(img => img.complete && img.naturalWidth > 0)", timeout=15000)
    except Exception:
        print(page.locator('#slots img.item-icon').evaluate_all('(imgs) => imgs.map(img => ({src:img.src,complete:img.complete,width:img.naturalWidth}))'), flush=True)
        raise
    page.screenshot(path='inventory-preview.png')
    assert page.locator('#slots img.item-icon').evaluate_all('(imgs) => imgs.length > 0 && imgs.every(img => img.complete && img.naturalWidth > 0)')
    page.locator('#resume').click()
    page.evaluate('Colony.save()')
    page.reload(wait_until='networkidle')
    assert page.evaluate("Colony.onSurface && Colony.surface[13][15]==='bench' && Colony.surface[12][15]==='furnace'")
    assert page.evaluate("Colony.count('plate')") == 2
    # Walking/jumping continue to work in the surface physics mode.
    page.keyboard.down('Space')
    page.wait_for_timeout(250)
    page.keyboard.up('Space')
    assert page.evaluate('Colony.player.y < 14')
    page.wait_for_timeout(1200)
    page.screenshot(path='surface-preview.png')
    page.evaluate('Colony.launch()')
    page.reload(wait_until='networkidle')
    assert not page.evaluate('Colony.onSurface')
    page.evaluate('ship.x=720;ship.y=-870;ship.vx=ship.vy=0;Colony.land()')
    assert page.evaluate("Colony.surface[13][15]==='bench'")
    page.evaluate('Colony.launch();ship.x=0;ship.y=0;ship.vx=ship.vy=0')
    page.keyboard.down('w')
    page.wait_for_timeout(450)
    page.keyboard.up('w')
    assert page.evaluate('ship.vy < 0')
    page.screenshot(path='flight-preview.png')
    page.evaluate("for(const type of Object.keys(Colony.items))Colony.addItem(type,1);showPanel()")
    page.wait_for_function("[...document.querySelectorAll('#slots img.item-icon')].every(img => img.complete && img.naturalWidth > 0)")
    page.screenshot(path='items-preview.png')
    assert page.evaluate('gl.getError()') == 0
    assert not errors, errors
    print('PASS: WebGL, crafting UI, capacity, landing, stations, refining, reach, save/reload, liftoff, flight')
    browser.close()
