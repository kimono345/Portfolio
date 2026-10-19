// ====================================================
// ARRIÈRE-PLAN : VOYAGE DANS L'ESPACE
// ====================================================
function initSpaceBackground() {
    const container = document.getElementById('canvas-container');
    if (!container || typeof THREE === 'undefined') return;

    const pr = Math.min(window.devicePixelRatio, COARSE_POINTER ? 1.25 : 1.5);
    const lite = COARSE_POINTER ? 0.5 : 1; // moins de particules sur mobile
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.z = 0;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(pr);
    container.appendChild(renderer.domElement);

    const world = new THREE.Group();
    scene.add(world);

    // 3 couches d'étoiles pour la profondeur (parallaxe)
    const farStars = createStarField(Math.round(2600 * lite), 900, { minR: 500, sizeMin: 0.8, sizeMax: 2.2, pixelRatio: pr });
    const midStars = createStarField(Math.round(900 * lite), 450, { minR: 180, sizeMin: 0.7, sizeMax: 2.0, pixelRatio: pr });
    const nearStars = createStarField(180, 160, { minR: 60, sizeMin: 0.5, sizeMax: 1.4, pixelRatio: pr });
    world.add(farStars, midStars, nearStars);

    // Nébuleuses
    const nebulae = new THREE.Group();
    const nebulaDefs = [
        { c: 0x5b3cc4, x: -260, y: 120, z: -620, s: 760, o: 0.55 },
        { c: 0x1d6fb8, x: 300, y: -60, z: -700, s: 820, o: 0.45 },
        { c: 0xb8366f, x: 120, y: 220, z: -820, s: 640, o: 0.30 },
        { c: 0xd4af37, x: -120, y: -240, z: -760, s: 520, o: 0.16 },
        { c: 0x0f8a8a, x: 420, y: 260, z: -900, s: 700, o: 0.22 }
    ];
    nebulaDefs.forEach(n => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
            map: makeNebulaTexture(n.c), color: 0xffffff, transparent: true,
            opacity: n.o, depthWrite: false, blending: THREE.AdditiveBlending
        }));
        sp.position.set(n.x, n.y, n.z);
        sp.scale.set(n.s, n.s, 1);
        sp.material.rotation = Math.random() * Math.PI;
        sp.userData.spin = (Math.random() - 0.5) * 0.00015;
        sp.userData.o = n.o;
        nebulae.add(sp);
    });
    world.add(nebulae);

    // MODE PRO : vague de particules dorées (remplace étoiles et nébuleuses)
    // Le groupe suit la caméra : la vague reste toujours sous l'horizon, quel que soit le scroll.
    const proGroup = new THREE.Group();
    scene.add(proGroup);
    const WAVE = COARSE_POINTER
        ? { cols: 92, rows: 46, step: 10, halfW: 455, y: -28, zNear: -40 }
        : { cols: 130, rows: 64, step: 7, halfW: 455, y: -28, zNear: -40 };
    const wavePos = new Float32Array(WAVE.cols * WAVE.rows * 3);
    for (let r = 0, i = 0; r < WAVE.rows; r++) {
        for (let c = 0; c < WAVE.cols; c++, i += 3) {
            wavePos[i] = -WAVE.halfW + c * WAVE.step;
            wavePos[i + 1] = WAVE.y;
            wavePos[i + 2] = WAVE.zNear - r * WAVE.step;
        }
    }
    const waveGeo = new THREE.BufferGeometry();
    waveGeo.setAttribute('position', new THREE.BufferAttribute(wavePos, 3));
    const waveMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uPR: { value: pr }, uHalfW: { value: WAVE.halfW }, uScroll: { value: 0 } },
        vertexShader: `
            uniform float uTime; uniform float uOpacity; uniform float uPR; uniform float uHalfW; uniform float uScroll;
            varying float vAlpha; varying float vCrest;
            void main() {
                vec3 p = position;
                float w = sin(p.x * 0.045 + uTime * 0.6) * 2.4
                        + cos((p.z + uScroll) * 0.05 + uTime * 0.45) * 2.4
                        + sin((p.x + p.z + uScroll) * 0.028 + uTime * 0.3) * 1.8;
                p.y += w;
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_PointSize = min(5.0, 2.4 * uPR * (110.0 / -mv.z));
                gl_Position = projectionMatrix * mv;
                float depth = smoothstep(470.0, 70.0, -mv.z);
                float edge = 1.0 - smoothstep(0.6, 1.0, abs(position.x) / uHalfW);
                vCrest = smoothstep(-4.0, 6.0, w);
                vAlpha = uOpacity * depth * edge * (0.35 + 0.65 * vCrest);
            }`,
        fragmentShader: `
            varying float vAlpha; varying float vCrest;
            void main() {
                float d = length(gl_PointCoord - 0.5);
                if (d > 0.5) discard;
                vec3 gold = mix(vec3(0.62, 0.45, 0.14), vec3(1.0, 0.88, 0.55), vCrest);
                gl_FragColor = vec4(gold, smoothstep(0.5, 0.1, d) * vAlpha);
            }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const wave = new THREE.Points(waveGeo, waveMat);
    proGroup.add(wave);

    // Étoiles filantes
    const shooting = [];
    function spawnShootingStar() {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 1, 1, 0, 0, 0]), 3));
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
            vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        const start = new THREE.Vector3((Math.random() - 0.2) * 400, 120 + Math.random() * 120, -300 - Math.random() * 150);
        const dir = new THREE.Vector3(-1 - Math.random(), -0.45 - Math.random() * 0.3, 0).normalize();
        line.userData = { head: start, dir, speed: 6 + Math.random() * 5, life: 0, max: 60 + Math.random() * 40, len: 40 + Math.random() * 40 };
        scene.add(line);
        shooting.push(line);
    }
    let nextShoot = 2;

    // Interaction : souris + scroll
    let mx = 0, my = 0, tx = 0, ty = 0;
    window.addEventListener('mousemove', (e) => {
        mx = (e.clientX / window.innerWidth - 0.5);
        my = (e.clientY / window.innerHeight - 0.5);
    });

    let mix = SiteMode.isPro() ? 1 : 0;
    const clock = new THREE.Clock();
    function render() {
        requestAnimationFrame(render);
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;
        mix = modeBlend(mix, dt);

        [farStars, midStars, nearStars].forEach(s => {
            s.material.uniforms.uTime.value = t;
            s.material.uniforms.uFade.value = 1 - mix;
        });
        nebulae.children.forEach(n => n.material.opacity = n.userData.o * (1 - mix));
        world.visible = mix < 0.99;

        // vague dorée (mode pro)
        wave.visible = mix > 0.01;
        waveMat.uniforms.uOpacity.value = mix;
        waveMat.uniforms.uTime.value = REDUCED_MOTION ? 0 : t;

        // dérive lente + parallaxe souris
        tx += (mx - tx) * 0.04;
        ty += (my - ty) * 0.04;
        const drift = REDUCED_MOTION ? 0 : t;
        world.rotation.y = drift * 0.006 + tx * 0.12;
        world.rotation.x = ty * 0.08;
        nearStars.rotation.y = tx * 0.25;
        midStars.rotation.y = tx * 0.08;
        proGroup.position.copy(camera.position);
        proGroup.rotation.y = tx * 0.15;
        proGroup.rotation.x = ty * 0.05;
        waveMat.uniforms.uScroll.value = camera.position.z * 2.5;

        // le scroll fait "avancer" dans l'espace
        const scrollMax = Math.max(1, document.body.scrollHeight - window.innerHeight);
        const progress = window.scrollY / scrollMax;
        camera.position.z += ((-progress * 260) - camera.position.z) * 0.06;
        camera.position.y += ((-progress * 40) - camera.position.y) * 0.06;

        nebulae.children.forEach(n => n.material.rotation += n.userData.spin);

        if (!REDUCED_MOTION) {
            nextShoot -= dt;
            if (nextShoot <= 0) { if (!SiteMode.isPro()) spawnShootingStar(); nextShoot = 3 + Math.random() * 5; }
        }
        for (let i = shooting.length - 1; i >= 0; i--) {
            const l = shooting[i], d = l.userData;
            d.life++;
            d.head.addScaledVector(d.dir, d.speed);
            const tail = d.head.clone().addScaledVector(d.dir, -d.len);
            const p = l.geometry.attributes.position.array;
            p[0] = d.head.x; p[1] = d.head.y; p[2] = d.head.z;
            p[3] = tail.x; p[4] = tail.y; p[5] = tail.z;
            l.geometry.attributes.position.needsUpdate = true;
            l.material.opacity = Math.sin(Math.PI * d.life / d.max);
            if (d.life >= d.max) {
                scene.remove(l); l.geometry.dispose(); l.material.dispose();
                shooting.splice(i, 1);
            }
        }

        renderer.render(scene, camera);
    }
    render();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}
