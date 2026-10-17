/**
 * Volumetric asteroid meshes and a dedicated depth-tested WebGL pass.
 * Seeded generation is CPU-only; bounded GPU buffers are reused across frames.
 */
const Asteroid3D = (() => {
  const presets = {
    rubble: {axes: [1, .89, .9], roughness: .9, amplitude: .16, craters: 4, metallic: .05},
    cratered: {axes: [.96, .94, .91], roughness: .95, amplitude: .06, craters: 11, metallic: .02},
    elongated: {axes: [1.08, .69, .79], roughness: .85, amplitude: .14, craters: 5, metallic: .08},
    metallic: {axes: [.97, .87, .92], roughness: .38, amplitude: .12, craters: 3, metallic: .65},
    jagged: {axes: [1.02, .83, .88], roughness: .98, amplitude: .25, craters: 6, metallic: .02, jagged: .14, shade: .72},
    fractured: {axes: [1.04, .81, .91], roughness: .96, amplitude: .2, craters: 4, metallic: .04, jagged: .08, clefts: .15, shade: .58},
    basalt: {axes: [.98, .9, .88], roughness: .99, amplitude: .16, craters: 8, metallic: .015, jagged: .08, clefts: .07, shade: .42, tint: [.8,.86,1]},
    ice: {axes: [.97, .85, .98], roughness: .24, amplitude: .1, craters: 3, metallic: .05},
    crystal: {axes: [.85, .95, 1], roughness: .3, amplitude: .18, craters: 0, metallic: .15}
  };
  const colors = {metal: [.32, .29, .25], ice: [.35, .5, .57], crystal: [.36, .3, .4], bulterite: [.24, .31, .27], ion_cube: [.27, .3, .25], blue_ion_cube: [.25, .29, .35]};
  const veins = {metal: [.6, .42, .24], ice: [.75, .9, .95], crystal: [.63, .4, .78], bulterite: [.4, .61, .38], ion_cube: [.25, .95, .45], blue_ion_cube: [.2, .57, 1]};
  const normalize = a => {const n = Math.hypot(...a) || 1; return a.map(v => v / n);};
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  function presetFor(rock) {
    if (rock.type === 'ice') return 'ice';
    if (['crystal', 'ion_cube', 'blue_ion_cube'].includes(rock.type)) return 'crystal';
    if (rock.type === 'bulterite') return 'metallic';
    return ['rubble', 'cratered', 'elongated', 'metallic', 'jagged', 'fractured', 'basalt'][Math.abs(rock.seed) % 7];
  }
  // Seeded charcoal/brown/slate variation preserves the mineral's colored seams.
  function surfaceColor(rock) {
    const preset = presets[presetFor(rock)], seed = Math.abs(rock.seed);
    const value = .72 + ((Math.imul(seed, 1664525) >>> 0) % 101) / 360;
    return (colors[rock.type] || colors.metal).map((v,i)=>v * value * (preset.shade || 1) * (preset.tint?.[i] || 1));
  }
  function buildMesh(seed, presetName, quality = 'balanced', radius = 80) {
    const preset = presets[presetName] || presets.rubble, rng = random(seed ^ 932871);
    const factor = quality === 'high' ? 1.5 : quality === 'low' ? .65 : 1;
    const rows = Math.max(6, Math.round((radius < 32 ? 8 : radius < 65 ? 13 : 20) * factor));
    const columns = rows * 2;
    const phase = rng() * 6.28, craters = [];
    for (let i = 0; i < preset.craters; i++) {
      const z = rng() * 2 - 1, angle = rng() * Math.PI * 2, ring = Math.sqrt(1-z*z);
      craters.push({direction: [ring*Math.cos(angle), ring*Math.sin(angle), z], size: .025 + rng() * .09, depth: .04 + rng() * .07});
    }
    function surface(d) {
      const [x,y,z] = d;
      const coarse = (Math.sin(x*4+phase)*Math.cos(y*3-phase) + Math.sin(y*5+z*3+phase) + Math.cos(z*4-x*3+phase)) / 3;
      // Broad angular ridges break up the potato silhouette without adding vertices.
      const ridge = Math.abs(Math.sin(x*5.3+y*2.7+phase)*Math.cos(z*4.1-x*1.9))-.4;
      const fine = Math.sin(x*17+y*13+phase)*Math.cos(z*19-y*11) * .018;
      let r = .86 + coarse * preset.amplitude + ridge * preset.amplitude * .38 + fine;
      if (preset.jagged) {
        // Direction-based ridges are continuous across the sphere's UV seam.
        // High narrow peaks and broad angular shelves produce chipped silhouettes.
        const chips = Math.abs(Math.sin(x*9+y*5+phase)*Math.cos(z*8-x*4));
        const shelves = Math.abs(Math.sin(y*7-z*5+phase*.6));
        r += preset.jagged * (Math.pow(chips,3)*1.7 + shelves*.55 - .65);
      }
      if (preset.clefts) {
        const splitA=Math.abs(x*.73+y*.45-z*.51-.12);
        const splitB=Math.abs(-x*.34+y*.81+z*.48+.18);
        r -= preset.clefts * (Math.exp(-splitA*30)+Math.exp(-splitB*34));
      }
      for (const crater of craters) {
        const distance = (1 - (x*crater.direction[0]+y*crater.direction[1]+z*crater.direction[2])) / crater.size;
        r -= crater.depth * Math.exp(-distance * 3.5);
        r += .027 * Math.exp(-((distance-.8)**2)*18);
      }
      if (presetName === 'crystal') r += Math.abs(Math.sin(x*7+y*4+z*5+phase)) * .065;
      r = Math.max(.48, Math.min(1.08,r));
      return [x*r*preset.axes[0], y*r*preset.axes[1], z*r*preset.axes[2]];
    }
    const vertices = [], indices = [];
    for (let row = 0; row <= rows; row++) {
      const theta = row / rows * Math.PI;
      for (let col = 0; col <= columns; col++) {
        const phi = col / columns * Math.PI * 2;
        const d = [Math.sin(theta)*Math.cos(phi), Math.sin(theta)*Math.sin(phi), Math.cos(theta)];
        const p = surface(d);
        // Finite differences include dents and ridges in the real surface normals.
        const tangent = normalize(cross(Math.abs(d[2]) > .9 ? [0,1,0] : [0,0,1], d));
        const bitangent = cross(d, tangent);
        const a = surface(normalize(d.map((v,i) => v + tangent[i]*.003)));
        const b = surface(normalize(d.map((v,i) => v + bitangent[i]*.003)));
        let n = normalize(cross(a.map((v,i)=>v-p[i]), b.map((v,i)=>v-p[i])));
        if (n.reduce((sum,v,i)=>sum+v*d[i],0) < 0) n = n.map(v=>-v);
        vertices.push(...p, ...n, .5 + .5*Math.sin(d[0]*9+d[1]*11+d[2]*7+phase));
      }
    }
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const a = row*(columns+1)+col, b = a+columns+1;
      indices.push(a,b,a+1, a+1,b,b+1);
    }
    return {vertices: new Float32Array(vertices), indices: new Uint16Array(indices), rows, columns};
  }
  const vertexShader = `
    attribute vec3 a_position; attribute vec3 a_normal; attribute float a_mineral;
    uniform mediump mat3 u_rotation; uniform vec2 u_center; uniform vec2 u_resolution; uniform float u_radius;
    varying vec3 v_normal; varying vec3 v_local; varying float v_mineral;
    void main() {
      vec3 p = u_rotation * a_position * u_radius;
      vec2 clip = (u_center + p.xy) / u_resolution * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, -p.z/350.0, 1.0);
      v_normal = u_rotation * a_normal; v_local = a_position; v_mineral = a_mineral;
    }`;
  const fragmentShader = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    varying vec3 v_normal; varying vec3 v_local; varying float v_mineral;
    uniform mediump mat3 u_rotation; uniform float u_seed; uniform float u_detail;
    uniform vec3 u_base; uniform vec3 u_vein; uniform float u_roughness; uniform float u_metallic; uniform float u_ice;
    float hash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
    float noise(vec3 p) {
      vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
    void main() {
      vec3 N=normalize(v_normal), L=normalize(vec3(-.45,-.60,.75)), V=vec3(0,0,1), H=normalize(L+V);
      // Object-space texture and normals rotate together, rather than sliding
      // across the surface. Low detail skips extra fragment noise samples.
      vec3 p=v_local+vec3(u_seed,u_seed*.37,-u_seed*.61);
      float broad=noise(p*8.0), middle=noise(p*25.0);
      float grain=broad*.55+middle*.3+noise(p*70.0)*.15;
      float relief=noise(p*18.0);
      if(u_detail>.5) {
        vec3 gradient=vec3(noise(p*18.0+vec3(.08,0,0)),
          noise(p*18.0+vec3(0,.08,0)),noise(p*18.0+vec3(0,0,.08)))-vec3(relief);
        vec3 worldGradient=u_rotation*gradient;
        N=normalize(N-(worldGradient-N*dot(N,worldGradient))*(2.2-u_ice*.9));
      }
      float seams=1.0-smoothstep(.025,.085,abs(noise(p*12.0)-.5));
      float ore=seams*smoothstep(.52,.8,v_mineral);
      // Dusty pockets, narrow fractures and irregular mineral inclusions.
      float fracture=1.0-smoothstep(.012,.045,abs(middle-.49));
      float pockets=smoothstep(.18,.65,relief);
      float occlusion=mix(.58,1.0,pockets)*(1.0-fracture*.28);
      vec3 dust=mix(u_base*.72,u_base*vec3(1.17,1.08,.93),broad);
      vec3 albedo=mix(dust*(.62+grain*.78),u_vein,ore*.58);
      albedo*=1.0-fracture*.22;
      float nl=max(dot(N,L),0.0), nv=max(dot(N,V),.001), nh=max(dot(N,H),0.0), hv=max(dot(H,V),0.0);
      float rough=clamp(u_roughness+(grain-.5)*.25+fracture*.12,.15,.98), a=rough*rough, a2=a*a;
      float denom=nh*nh*(a2-1.0)+1.0;
      float D=a2/(3.14159*denom*denom+.0001);
      float k=(rough+1.0)*(rough+1.0)/8.0;
      float G=(nv/(nv*(1.0-k)+k))*(nl/(nl*(1.0-k)+k+.001));
      vec3 F0=mix(vec3(.04),albedo,u_metallic), F=F0+(1.0-F0)*pow(1.0-hv,5.0);
      vec3 spec=D*G*F/(4.0*nv*max(nl,.001)+.001);
      vec3 diffuse=(1.0-F)*(1.0-u_metallic)*albedo/3.14159;
      vec3 color=albedo*.085*occlusion+(diffuse*occlusion+spec)*nl*3.0;
      color+=albedo*vec3(.07,.095,.14)*max(dot(N,normalize(vec3(.5,.2,.4))),0.0)*occlusion;
      color+=u_vein*ore*.035+vec3(.12,.2,.24)*u_ice*pow(1.0-nv,3.0);
      color=color/(color+vec3(1.0));
      gl_FragColor=vec4(pow(max(color,vec3(0.0)),vec3(.4545)),1.0);
    }`;
  // A column-major 3-axis rotation; the flight collider remains in its 2D plane.
  function rotation(rock) {
    const x = rock.angle*.43+(rock.seed%31), y = rock.angle*.71+(rock.seed%17), z = rock.angle;
    const a=Math.cos(x), b=Math.sin(x), c=Math.cos(y), d=Math.sin(y), e=Math.cos(z), f=Math.sin(z);
    return new Float32Array([e*c,f*c,-d, e*d*b-f*a,f*d*b+e*a,c*b, e*d*a+f*b,f*d*a-e*b,c*a]);
  }
  let renderer = null, failed = false;
  function createRenderer(gl) {
    function shader(type, source) {
      const object = gl.createShader(type); gl.shaderSource(object, source); gl.compileShader(object);
      if (!gl.getShaderParameter(object,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(object));
      return object;
    }
    const program=gl.createProgram(), vs=shader(gl.VERTEX_SHADER,vertexShader), fs=shader(gl.FRAGMENT_SHADER,fragmentShader);
    gl.attachShader(program,vs); gl.attachShader(program,fs); gl.linkProgram(program);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    const attributes=['a_position','a_normal','a_mineral'].map(name=>gl.getAttribLocation(program,name));
    const uniforms=Object.fromEntries(['rotation','center','resolution','radius','base','vein','roughness','metallic','ice','seed','detail'].map(name=>[name,gl.getUniformLocation(program,'u_'+name)]));
    const cache=new Map();
    function meshFor(rock,quality) {
      const preset=presetFor(rock), size=rock.r<32?0:rock.r<65?1:2, key=rock.seed+'|'+preset+'|'+quality+'|'+size;
      if (cache.has(key)) {const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}
      const model=buildMesh(rock.seed,preset,quality,rock.r), vertex=gl.createBuffer(), index=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,vertex);gl.bufferData(gl.ARRAY_BUFFER,model.vertices,gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,model.indices,gl.STATIC_DRAW);
      const value={vertex,index,count:model.indices.length};
      cache.set(key,value);
      if (cache.size>96) {const key=cache.keys().next().value, old=cache.get(key);gl.deleteBuffer(old.vertex);gl.deleteBuffer(old.index);cache.delete(key);}
      return value;
    }
    function render(rocks,screen,w,h,quality) {
      gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.clear(gl.DEPTH_BUFFER_BIT);gl.disable(gl.BLEND);
      try {
      gl.uniform2f(uniforms.resolution,w,h);
      gl.uniform1f(uniforms.detail,quality==='low'?0:1);
      for (const rock of rocks) {
        const [x,y]=screen(rock.x,rock.y);
        if(x < -rock.r*1.2 || x>w+rock.r*1.2 || y < -rock.r*1.2 || y>h+rock.r*1.2) continue;
        const model=meshFor(rock,quality), preset=presets[presetFor(rock)];
        gl.bindBuffer(gl.ARRAY_BUFFER,model.vertex);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,model.index);
        for(const attribute of attributes)gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attributes[0],3,gl.FLOAT,false,28,0);gl.vertexAttribPointer(attributes[1],3,gl.FLOAT,false,28,12);gl.vertexAttribPointer(attributes[2],1,gl.FLOAT,false,28,24);
        gl.uniform1f(uniforms.seed,(Math.abs(rock.seed)%997)/31);
        gl.uniformMatrix3fv(uniforms.rotation,false,rotation(rock));gl.uniform2f(uniforms.center,x,y);gl.uniform1f(uniforms.radius,rock.r);
        gl.uniform3fv(uniforms.base,surfaceColor(rock));gl.uniform3fv(uniforms.vein,veins[rock.type]||veins.metal);
        gl.uniform1f(uniforms.roughness,preset.roughness);gl.uniform1f(uniforms.metallic,preset.metallic);gl.uniform1f(uniforms.ice,rock.type==='ice'?1:0);
        gl.drawElements(gl.TRIANGLES,model.count,gl.UNSIGNED_SHORT,0);
      }
      } finally {
        for(const attribute of attributes)gl.disableVertexAttribArray(attribute);
        gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);
      }
    }
    function dispose() {for(const value of cache.values()){gl.deleteBuffer(value.vertex);gl.deleteBuffer(value.index);}cache.clear();gl.deleteProgram(program);}
    return {render,dispose};
  }
  function render(gl,rocks,screen,w,h,quality='balanced') {
    if (!failed) {
      try {
        if (!renderer) renderer=createRenderer(gl);
        renderer.render(rocks,screen,w,h,quality);
        return;
      } catch (error) {
        failed=true;
        if (renderer) renderer.dispose();
        renderer=null;
        console.warn('Asteroid 3D renderer unavailable:', error);
        if (typeof notify === 'function') notify(typeof I18n !== 'undefined' && I18n.language === 'cs' ? '3D ASTEROIDY NEDOSTUPNÉ · NÁHRADNÍ VYKRESLENÍ' : '3D ASTEROIDS UNAVAILABLE · FALLBACK RENDERING');
      }
    }
    // A failed shader must not stop flight or trigger compilation every frame.
    for (const rock of rocks) {
      const [x,y]=screen(rock.x,rock.y);
      if(x>=-rock.r&&x<=w+rock.r&&y>=-rock.r&&y<=h+rock.r) WorldArt.drawRock(rock,x,y);
    }
  }
  function dispose() {if(renderer)renderer.dispose();renderer=null;failed=false;}
  return {presets,presetFor,surfaceColor,buildMesh,rotation,render,dispose};
})();
