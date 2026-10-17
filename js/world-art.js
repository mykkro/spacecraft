/**
 * Procedural surface models for the existing batched WebGL renderer.
 * No textures, extra draw calls, shadow passes or per-frame mesh generation.
 * Light stays fixed in world space while bodies rotate beneath it.
 */
const WorldArt = (() => {
  const meshes = new WeakMap();
  const light = [-.48, -.58, .66];
  const stone = {
    metal: [.40, .37, .33], ice: [.34, .47, .52], crystal: [.35, .32, .37],
    bulterite: [.29, .34, .30], ion_cube: [.33, .36, .32], blue_ion_cube: [.31, .34, .39]
  };
  const deposits = {
    metal: [.62, .46, .30], ice: [.65, .84, .88], crystal: [.65, .47, .78],
    bulterite: [.49, .62, .43], ion_cube: [.35, .95, .52], blue_ion_cube: [.32, .65, 1]
  };
  function shade(base, nx, ny, nz, rough = 1, alpha = 1) {
    const length = Math.hypot(nx, ny, nz) || 1;
    const diffuse = Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / length);
    const value = (.19 + diffuse * .94) * rough;
    return [Math.min(1, base[0] * value), Math.min(1, base[1] * value), Math.min(1, base[2] * value), alpha];
  }
  function meshFor(rock) {
    if (meshes.has(rock)) return meshes.get(rock);
    const rng = random(rock.seed ^ 71093), outline = [];
    for (let i = 0; i < rock.points.length; i++) {
      const a = rock.points[i], b = rock.points[(i + 1) % rock.points.length];
      outline.push([a[0] / rock.r, a[1] / rock.r]);
      if (rock.r >= 35) {
        const rough = 1 + (rng() - .5) * .08;
        outline.push([(a[0] + b[0]) / (2 * rock.r) * rough, (a[1] + b[1]) / (2 * rock.r) * rough]);
      }
    }
    const nodes = [{x: -.06, y: -.04, rough: 1}], faces = [], count = outline.length;
    // Concentric irregular rings approximate a rounded, chipped surface.
    for (const radius of [.4, .73, 1]) {
      for (const [x, y] of outline) nodes.push({
        x: x * radius, y: y * radius,
        rough: .84 + rng() * .28
      });
    }
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      faces.push([0, 1 + i, 1 + j]);
      for (let ring = 0; ring < 2; ring++) {
        const a = 1 + ring * count + i, b = 1 + ring * count + j;
        faces.push([a, a + count, b + count], [a, b + count, b]);
      }
    }
    const craters = [], veins = [];
    for (let i = 0; i < (rock.r > 65 ? 5 : rock.r >= 35 ? 3 : 1); i++) {
      const angle = rng() * Math.PI * 2, radius = Math.sqrt(rng()) * .54;
      craters.push({x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, r: .055 + rng() * .105});
    }
    for (let i = 0; i < (rock.r < 35 ? 2 : 4); i++) {
      const angle = rng() * Math.PI * 2, radius = .18 + rng() * .35;
      veins.push({x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, angle: rng() * 6.28, size: .06 + rng() * .1});
    }
    const mesh = {nodes, faces, craters, veins};
    meshes.set(rock, mesh);
    return mesh;
  }
  function drawRock(rock, x, y) {
    const mesh = meshFor(rock), c = Math.cos(rock.angle), s = Math.sin(rock.angle);
    const project = (a, b) => [x + (a * c - b * s) * rock.r, y + (a * s + b * c) * rock.r];
    const base = stone[rock.type] || stone.metal;
    const nodes = mesh.nodes.map(node => {
      const nx = node.x * c - node.y * s, ny = node.x * s + node.y * c;
      const nz = Math.sqrt(Math.max(.035, 1 - Math.min(.98, node.x ** 2 + node.y ** 2)));
      return {p: project(node.x, node.y), color: shade(base, nx, ny, nz, node.rough)};
    });
    for (const [a, b, d] of mesh.faces)
      triGradient(nodes[a].p, nodes[b].p, nodes[d].p, nodes[a].color, nodes[b].color, nodes[d].color);
    // Crater bowls and their sunlit lips replace the former circular decals.
    for (const crater of mesh.craters) {
      const [cx, cy] = project(crater.x, crater.y), radius = crater.r * rock.r;
      const brightness = shade(base, crater.x * c - crater.y * s, crater.x * s + crater.y * c, .8);
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * Math.PI * 2, b = (i + 1) / 10 * Math.PI * 2;
        const p = [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius * .76];
        const q = [cx + Math.cos(b) * radius, cy + Math.sin(b) * radius * .76];
        triGradient([cx - radius * .15, cy - radius * .12], p, q,
          [brightness[0] * .38, brightness[1] * .38, brightness[2] * .38, 1],
          [...brightness.slice(0, 3).map(v => v * .78), 1],
          [...brightness.slice(0, 3).map(v => v * .78), 1]);
        if (i >= 1 && i <= 4)
          line(p, q, [...brightness.slice(0, 3).map(v => Math.min(1, v * 1.3)), .65], Math.max(.6, rock.r * .008));
      }
    }
    const mineral = deposits[rock.type] || deposits.metal;
    for (const vein of mesh.veins) {
      const p = project(vein.x, vein.y);
      const a = project(vein.x + Math.cos(vein.angle) * vein.size, vein.y + Math.sin(vein.angle) * vein.size);
      const b = project(vein.x - Math.cos(vein.angle + .35) * vein.size, vein.y - Math.sin(vein.angle + .35) * vein.size);
      line(b, p, [...mineral, .78], Math.max(.7, rock.r * .016));
      line(p, a, [...mineral, .8], Math.max(.7, rock.r * .024));
      if (rock.type === 'ice' || rock.type === 'crystal') {
        const tip = project(vein.x + vein.size * .3, vein.y - vein.size * .5);
        triGradient(b, a, tip, [...mineral, .55], [...mineral, .3], [.9, .96, 1, .9]);
      }
    }
  }
  function drawShip(kind, ox, oy, angle, alpha = 1, scale = 1, thrust = false) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const p = (x, y) => [ox + (x * c - y * s) * scale, oy + (x * s + y * c) * scale];
    const pirate = kind === 'pirate' || kind === 'heavy';
    const hull = kind === 'kraxna' ? [.51, .55, .36] : pirate ? [.47, .27, .24] : kind === 'starfox' ? [.48, .61, .68] : [.60, .59, .52];
    const steel = [.28, .34, .38], dark = [.10, .15, .19];
    function plate(points, color = hull, height = 6) {
      const center = points.reduce((sum, point) => [sum[0] + point[0] / points.length, sum[1] + point[1] / points.length], [0, 0]);
      // Thin extruded sides establish thickness without a depth buffer.
      for (let i = 0; i < points.length; i++) {
        const a = p(...points[i]), b = p(...points[(i + 1) % points.length]);
        const downA = [a[0] + 1.2 * scale, a[1] + height * .55 * scale];
        const downB = [b[0] + 1.2 * scale, b[1] + height * .55 * scale];
        tri(a, b, downB, [.09, .12, .14, alpha]);
        tri(a, downB, downA, [.09, .12, .14, alpha]);
      }
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        const nx = (a[0] + b[0]) / 2 - center[0], ny = (a[1] + b[1]) / 2 - center[1];
        const colorAtEdge = shade(color, nx * c - ny * s, nx * s + ny * c, height, 1, alpha);
        triGradient(p(...center), p(...a), p(...b), shade(color, 0, 0, 1, 1.15, alpha), colorAtEdge, colorAtEdge);
        line(p(...a), p(...b), [.68, .73, .72, alpha * .32], .65 * scale);
      }
    }
    function panel(x, y, w, h, color = steel) { plate([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], color, 3); }
    function engine(x, y) {
      panel(x - 4, y - 9, 8, 12, steel);
      const a = p(x, y + 3), b = p(x, y + (thrust ? 17 : 5));
      line(a, b, [.16, .62, 1, alpha * (thrust ? .18 : .06)], (thrust ? 10 : 5) * scale);
      line(a, b, [.55, .87, 1, alpha * (thrust ? .9 : .35)], (thrust ? 3 : 2) * scale);
      line(p(x - 4, y + 2), p(x + 4, y + 2), [.1, .12, .14, alpha], 3 * scale);
      line(p(x - 2, y + 3), p(x + 2, y + 3), [.7, .9, 1, alpha], 1.5 * scale);
    }
    if (kind === 'starfox' || pirate) {
      for (const side of [-1, 1]) {
        plate([[side * 5, -6], [side * (pirate ? 24 : 29), 19], [side * 8, 13]], hull, 4);
        panel(side * 18 - 2, 8, 4, 14, steel);
        line(p(side * 18, 4), p(side * 18, 13), [.17, .22, .25, alpha], 2 * scale);
      }
      plate([[0, -31], [-6, -8], [-8, 19], [8, 19], [6, -8]], hull, 10);
      engine(-5, 21); engine(5, 21);
    } else if (kind === 'kraxna' || kind === 'courier') {
      panel(-11, -25, 22, 47, hull);
      for (const side of [-1, 1]) {
        panel(side * 20 - 6, -12, 12, 33, kind === 'courier' ? [.28, .48, .41] : [.37, .40, .26]);
        for (let y = -7; y < 19; y += 8) {
          line(p(side * 20 - 5, y), p(side * 20 + 5, y), [.12, .18, .18, alpha], 1.5 * scale);
          const bolt = p(side * 20 + 3, y + 3);
          disc(bolt[0], bolt[1], .7 * scale, [.66, .68, .57, alpha], 5);
        }
        engine(side * 19, 23);
      }
      panel(-8, -4, 16, 15, steel);
      line(p(-7, 3), p(7, 3), [.12, .18, .2, alpha], 2 * scale);
    } else {
      plate([[-8, -24], [9, -24], [23, -8], [22, 13], [10, 24], [-13, 24], [-24, 10], [-23, -7]], hull, 10);
      for (const side of [-1, 1]) { panel(side * 7 - 3, -32, 6, 21, steel); engine(side * 11, 22); }
      panel(19, -19, 9, 15, hull);
      panel(-16, 2, 10, 12, steel); panel(4, 1, 11, 13, steel);
    }
    // Dark laminated canopy, an offset reflection and discrete navigation lamps.
    plate([[-4, -20], [4, -20], [5, -9], [-5, -9]], dark, 2);
    triGradient(p(-3, -19), p(3, -19), p(-3, -10),
      [.53, .78, .83, alpha], [.09, .29, .38, alpha], [.11, .23, .30, alpha]);
    line(p(-3, -19), p(2, -19), [.8, .91, .92, alpha * .8], .7 * scale);
    for (let y = 7; y < 18; y += 3)
      line(p(-3, y), p(3, y), [.09, .13, .15, alpha], 1.1 * scale);
    const port = p(-17, 14), starboard = p(17, 14);
    disc(port[0], port[1], 1.1 * scale, [1, .25, .18, alpha], 5);
    disc(starboard[0], starboard[1], 1.1 * scale, [.25, 1, .55, alpha], 5);
  }
  return {drawRock, drawShip};
})();
