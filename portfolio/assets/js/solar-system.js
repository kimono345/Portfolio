// ====================================================
// SYSTÈME SOLAIRE NAVIGABLE (ZQSD + souris)
// ====================================================
function makePlanetTexture(p) {
    const w = 512, h = 256;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const base = new THREE.Color(p.color);
    const shade = (k) => {
        const col = base.clone().multiplyScalar(k);
        return `rgb(${Math.min(255, col.r * 255) | 0},${Math.min(255, col.g * 255) | 0},${Math.min(255, col.b * 255) | 0})`;
    };
    ctx.fillStyle = shade(1);
    ctx.fillRect(0, 0, w, h);

    if (p.type === 'gas' || p.type === 'ink') {
        // bandes atmosphériques
        let y = 0;
        while (y < h) {
            const bh = 4 + Math.random() * 22;
            ctx.fillStyle = shade(0.6 + Math.random() * 0.8);
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.03 + y) * 3);
            for (let x = w; x >= 0; x -= 16) ctx.lineTo(x, y + bh + Math.sin(x * 0.025 + y * 2) * 3);
            ctx.fill();
            y += bh;
        }
        ctx.globalAlpha = 1;
        if (p.type === 'ink') {
            for (let i = 0; i < 40; i++) {
                ctx.fillStyle = `rgba(10,6,25,${0.15 + Math.random() * 0.25})`;
                ctx.beginPath();
                ctx.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 4 + Math.random() * 10, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // grande tache façon Jupiter
            ctx.fillStyle = shade(0.55);
            ctx.globalAlpha = 0.7;
            ctx.beginPath(); ctx.ellipse(w * 0.62, h * 0.62, 34, 14, 0, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }
    } else {
        // surfaces rocheuses / continents / glace / lave
        const blobs = p.type === 'earth' ? 70 : 140;
        for (let i = 0; i < blobs; i++) {
            const x = Math.random() * w, y = Math.random() * h, r = 6 + Math.random() * (p.type === 'earth' ? 40 : 24);
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            let k = 0.6 + Math.random() * 0.8;
            let fill = shade(k);
            if (p.type === 'earth') fill = Math.random() < 0.55 ? 'rgb(28,70,150)' : shade(0.7 + Math.random() * 0.5);
            if (p.type === 'ice') fill = Math.random() < 0.5 ? 'rgb(230,250,255)' : shade(k);
            if (p.type === 'lava') fill = Math.random() < 0.3 ? 'rgb(255,190,80)' : 'rgb(45,18,16)';
            g.addColorStop(0, fill);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        if (p.type === 'rock') {
            for (let i = 0; i < 26; i++) {
                const x = Math.random() * w, y = Math.random() * h, r = 2 + Math.random() * 9;
                ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
            }
        }
        if (p.type === 'earth') {
            // calottes polaires
            ctx.fillStyle = 'rgba(240,248,255,0.85)';
            ctx.fillRect(0, 0, w, 10); ctx.fillRect(0, h - 10, w, 10);
        }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
}

function atmosphereMaterial(hex, power = 2.6, strength = 1.1) {
    return new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(hex) }, uPower: { value: power }, uStrength: { value: strength } },
        vertexShader: `
            varying vec3 vN; varying vec3 vV;
            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vN = normalize(normalMatrix * normal);
                vV = normalize(-mv.xyz);
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: `
            uniform vec3 uColor; uniform float uPower; uniform float uStrength;
            varying vec3 vN; varying vec3 vV;
            void main() {
                float f = pow(1.0 - max(dot(vN, vV), 0.0), uPower) * uStrength;
                gl_FragColor = vec4(uColor, f);
            }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
}

function initSolarSystem() {
    // une seule scène par page : un 2e appel doublerait planètes, étiquettes et boutons
    if (initSolarSystem.started) return;
    initSolarSystem.started = true;
    const wrap = document.getElementById('solar-wrap');
    const canvas = document.getElementById('solar-canvas');
    const labelsEl = document.getElementById('solar-labels');
    if (!wrap || typeof THREE === 'undefined') return;

    const pr = Math.min(window.devicePixelRatio, COARSE_POINTER ? 1.5 : 2);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !COARSE_POINTER });
    renderer.setPixelRatio(pr);
    renderer.setClearColor(0x02030a, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 3000);
    // en portrait (téléphone), la caméra monte et plonge : le système occupe la hauteur au lieu de déborder en largeur
    const portrait = wrap.clientWidth < wrap.clientHeight;
    const HOME = portrait
        ? { pos: new THREE.Vector3(0, 95, 92), yaw: 0, pitch: -0.78 }
        : { pos: new THREE.Vector3(0, 38, 92), yaw: 0, pitch: -0.4 };

    // Fond étoilé + nébuleuse lointaine
    const bgStars = createStarField(COARSE_POINTER ? 1500 : 3500, 1200, { minR: 700, sizeMin: 1, sizeMax: 3, pixelRatio: pr });
    scene.add(bgStars);
    const bgNebulae = [{ c: 0x4b32b0, x: -500, y: 150, z: -900, s: 1400, o: 0.35 }, { c: 0x1a5fa8, x: 700, y: -200, z: -500, s: 1200, o: 0.25 }].map(n => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeNebulaTexture(n.c), transparent: true, opacity: n.o, depthWrite: false, blending: THREE.AdditiveBlending }));
        sp.position.set(n.x, n.y, n.z); sp.scale.set(n.s, n.s, 1);
        sp.userData.o = n.o;
        scene.add(sp);
        return sp;
    });

    // Lumières
    scene.add(new THREE.AmbientLight(0x404a70, 0.35));
    const sunLight = new THREE.PointLight(0xfff1d0, 2.2, 0, 1.2);
    scene.add(sunLight);

    // Soleil
    const sunGroup = new THREE.Group();
    const sunTex = (() => {
        const c = document.createElement('canvas'); c.width = 512; c.height = 256;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffb02e'; ctx.fillRect(0, 0, 512, 256);
        for (let i = 0; i < 900; i++) {
            const x = Math.random() * 512, y = Math.random() * 256, r = 2 + Math.random() * 10;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, Math.random() < 0.6 ? 'rgba(255,236,150,0.55)' : 'rgba(230,110,20,0.45)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        return new THREE.CanvasTexture(c);
    })();
    const sun = new THREE.Mesh(new THREE.SphereGeometry(6, 48, 48), new THREE.MeshBasicMaterial({ map: sunTex }));
    sunGroup.add(sun);
    sunGroup.add(new THREE.Mesh(new THREE.SphereGeometry(6.6, 48, 48), atmosphereMaterial(0xffc04a, 1.6, 1.6)));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture('rgba(255,236,180,1)', 'rgba(255,170,60,0.35)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(46, 46, 1);
    sunGroup.add(glow);
    scene.add(sunGroup);

    // Planètes
    const planets = PROJECTS.map((p, i) => {
        const pivot = new THREE.Group();
        pivot.rotation.y = (i / PROJECTS.length) * Math.PI * 2 + Math.random() * 0.4;
        const tilt = new THREE.Group();
        tilt.rotation.x = (Math.random() - 0.5) * 0.12;
        tilt.add(pivot);
        scene.add(tilt);

        const holder = new THREE.Group();
        holder.position.x = p.orbit;
        pivot.add(holder);

        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(p.size, 48, 48),
            new THREE.MeshStandardMaterial({ map: makePlanetTexture(p), roughness: 0.85, metalness: 0.05, emissive: new THREE.Color(p.color).multiplyScalar(0.06) })
        );
        mesh.rotation.z = 0.25 + Math.random() * 0.2;
        mesh.userData.project = p;
        holder.add(mesh);

        const atmo = new THREE.Mesh(new THREE.SphereGeometry(p.size * 1.12, 48, 48), atmosphereMaterial(p.glow));
        holder.add(atmo);

        if (p.ring) {
            const ringGeo = new THREE.RingGeometry(p.size * 1.45, p.size * 2.3, 96);
            const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: p.glow, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
            ring.rotation.x = Math.PI / 2.3;
            holder.add(ring);
            const ring2 = new THREE.Mesh(new THREE.RingGeometry(p.size * 1.6, p.size * 1.75, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
            ring2.rotation.x = Math.PI / 2.3;
            holder.add(ring2);
        }

        // Orbite
        const pts = [];
        for (let a = 0; a <= 128; a++) {
            const t = (a / 128) * Math.PI * 2;
            pts.push(new THREE.Vector3(Math.cos(t) * p.orbit, 0, Math.sin(t) * p.orbit));
        }
        const orbitLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: 0x8b93c9, transparent: true, opacity: 0.16 }));
        tilt.add(orbitLine);

        // Étiquette HTML
        const label = document.createElement('div');
        label.className = 'planet-label';
        label.textContent = p.preview ? '▶ ' + p.name : p.name;
        labelsEl.appendChild(label);

        return { p, pivot, holder, mesh, orbitLine, label, angle: pivot.rotation.y };
    });

    // Ceinture d'astéroïdes
    const beltCount = 900, beltPos = new Float32Array(beltCount * 3);
    for (let i = 0; i < beltCount; i++) {
        const a = Math.random() * Math.PI * 2, r = 66 + Math.random() * 8;
        beltPos[i * 3] = Math.cos(a) * r;
        beltPos[i * 3 + 1] = (Math.random() - 0.5) * 1.6;
        beltPos[i * 3 + 2] = Math.sin(a) * r;
    }
    const beltGeo = new THREE.BufferGeometry();
    beltGeo.setAttribute('position', new THREE.BufferAttribute(beltPos, 3));
    const belt = new THREE.Points(beltGeo, new THREE.PointsMaterial({ color: 0x9aa0b5, size: 0.35, transparent: true, opacity: 0.7 }));
    scene.add(belt);

    // ---------- Caméra / contrôles ----------
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    let yaw = HOME.yaw, pitch = HOME.pitch;
    camera.position.copy(HOME.pos);
    const velocity = new THREE.Vector3();
    const keys = {};
    let active = false, visible = false, paused = false;
    let flyTarget = null, flyHome = false;

    const modal = document.getElementById('project-modal');
    const modalOpen = () => !modal.classList.contains('hidden');

    function setActive(v) {
        active = v;
        wrap.classList.toggle('is-active', v);
        if (!v) for (const k in keys) keys[k] = false;
    }

    const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight'];
    window.addEventListener('keydown', (e) => {
        if (!active || modalOpen()) return;
        if (e.code === 'Escape') { setActive(false); wrap.blur(); return; }
        if (e.code === 'KeyE') { if (nearest) openProjectModal(nearest.p); return; }
        if (MOVE_KEYS.includes(e.code)) {
            e.preventDefault();
            keys[e.code] = true;
            flyTarget = null; flyHome = false;
        }
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

    // Souris / tactile : glisser pour orienter, clic ou toucher pour sélectionner, pincer pour avancer
    let dragging = false, lastX = 0, lastY = 0, moved = 0;
    const pointer = new THREE.Vector2(-10, -10);
    const raycaster = new THREE.Raycaster();
    const touches = new Map(); // pointeurs actifs, pour le pincement à deux doigts
    let pinchDist = 0;

    function setPointer(e) {
        const r = canvas.getBoundingClientRect();
        pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    }
    // tolerancePx : au doigt, on accepte un toucher proche de la planète (elles sont petites à l'écran)
    const pickV = new THREE.Vector3();
    function pickPlanet(tolerancePx = 0) {
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(planets.map(pl => pl.mesh));
        if (hits.length) return planets.find(pl => pl.mesh === hits[0].object);
        if (!tolerancePx) return null;
        const r = canvas.getBoundingClientRect();
        let best = null, bestD = tolerancePx;
        planets.forEach(pl => {
            pl.holder.getWorldPosition(pickV).project(camera);
            if (pickV.z > 1) return; // derrière la caméra
            const d = Math.hypot((pickV.x - pointer.x) * r.width / 2, (pickV.y - pointer.y) * r.height / 2);
            if (d < bestD) { bestD = d; best = pl; }
        });
        return best;
    }
    const pinchSpan = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

    canvas.addEventListener('pointerdown', (e) => {
        setActive(true);
        wrap.focus({ preventScroll: true });
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2) { pinchDist = pinchSpan(); dragging = false; return; }
        dragging = true; moved = 0;
        lastX = e.clientX; lastY = e.clientY;
        setPointer(e);
        canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse') setPointer(e);
        if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2) {
            // pincer / écarter : reculer / avancer dans la direction du regard
            const d = pinchSpan();
            if (flyTarget || flyHome) { syncAnglesFromCamera(); flyTarget = null; flyHome = false; }
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            velocity.addScaledVector(dir, (d - pinchDist) * 0.6);
            pinchDist = d;
            return;
        }
        if (!dragging) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 4) {
            wrap.classList.add('is-dragging');
            if (flyTarget || flyHome) { syncAnglesFromCamera(); flyTarget = null; flyHome = false; }
            yaw -= dx * 0.0035;
            pitch -= dy * 0.0035;
            pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
        }
    });
    canvas.addEventListener('pointerup', (e) => {
        touches.delete(e.pointerId);
        if (!dragging) return;
        dragging = false;
        wrap.classList.remove('is-dragging');
        if (moved <= 4) {
            // le survol n'existe pas au doigt : on vise directement le point touché
            setPointer(e);
            const target = pickPlanet(e.pointerType === 'mouse' ? 0 : 36);
            // on laisse d'abord la caméra se centrer sur la planète, la fiche s'ouvre à l'arrivée
            if (target) { flyTo(target); pendingOpen = target; pendingSince = performance.now(); }
        }
        if (e.pointerType !== 'mouse') pointer.set(-10, -10);
    });
    canvas.addEventListener('pointercancel', (e) => {
        touches.delete(e.pointerId);
        dragging = false;
        wrap.classList.remove('is-dragging');
    });
    canvas.addEventListener('pointerleave', () => { pointer.set(-10, -10); });
    canvas.addEventListener('wheel', (e) => {
        if (!active) return;
        e.preventDefault();
        flyTarget = null; flyHome = false;
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        velocity.addScaledVector(dir, -Math.sign(e.deltaY) * 6);
    }, { passive: false });

    document.addEventListener('pointerdown', (e) => { if (!wrap.contains(e.target) && !modal.contains(e.target)) setActive(false); });

    function syncAnglesFromCamera() {
        euler.setFromQuaternion(camera.quaternion, 'YXZ');
        yaw = euler.y; pitch = euler.x;
    }

    // planète dont la fiche s'ouvrira quand la caméra sera arrivée (annulé si on reprend la main)
    let pendingOpen = null, pendingSince = 0;
    function flyTo(planet) { flyTarget = planet; flyHome = false; }
    document.getElementById('solar-reset').addEventListener('click', () => { flyTarget = null; flyHome = true; setActive(true); });
    const pauseBtn = document.getElementById('solar-pause');
    pauseBtn.addEventListener('click', () => {
        paused = !paused;
        pauseBtn.querySelector('span').textContent = paused ? 'Relancer les orbites' : 'Figer les orbites';
    });

    // Raccourcis (et navigation mobile)
    const chips = document.getElementById('planet-chips');
    planets.forEach(pl => {
        const b = document.createElement('button');
        b.className = 'planet-chip glass-panel px-3.5 py-2 rounded-full text-xs font-semibold text-slate-300 flex items-center gap-2';
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = '#' + new THREE.Color(pl.p.glow).getHexString();
        dot.style.color = dot.style.background;
        b.append(dot, document.createTextNode(pl.p.name));
        if (pl.p.preview) {
            const live = document.createElement('span');
            live.className = 'text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5';
            live.textContent = 'Démo';
            b.appendChild(live);
        }
        b.addEventListener('click', () => {
            wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setActive(true);
            flyTo(pl);
        });
        chips.appendChild(b);
    });

    // Proximité
    const prox = document.getElementById('solar-proximity');
    const proxCat = document.getElementById('prox-cat');
    const proxTitle = document.getElementById('prox-title');
    const proxShort = document.getElementById('prox-short');
    let nearest = null, hovered = null, shownProx = null;

    // Dimensionnement
    function resize() {
        const w = wrap.clientWidth, h = wrap.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    resize();
    // suit aussi les changements de taille du conteneur (ex. passage en vue Univers)
    new ResizeObserver(() => { if (wrap.clientWidth) resize(); }).observe(wrap);

    // Ne rendre que si la section est visible
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) setActive(false);
    }, { threshold: 0.05 }).observe(wrap);

    const tmp = new THREE.Vector3(), worldPos = new THREE.Vector3(), desired = new THREE.Vector3();
    const lookM = new THREE.Matrix4(), targetQ = new THREE.Quaternion();
    const clock = new THREE.Clock();
    const ACCEL = 70, DAMP = 3.2, MAX_R = 260;

    // Couleurs selon l'ambiance : [mode espace, mode pro]
    const MODE_COLORS = {
        clear: [new THREE.Color(0x02030a), new THREE.Color(0x000000)],
        orbit: [new THREE.Color(0x8b93c9), new THREE.Color(0xd4af37)],
        belt: [new THREE.Color(0x9aa0b5), new THREE.Color(0xc9b27a)]
    };
    const modeColor = new THREE.Color();
    let mix = SiteMode.isPro() ? 1 : 0;

    function applyMode(dt) {
        mix = modeBlend(mix, dt);
        renderer.setClearColor(modeColor.copy(MODE_COLORS.clear[0]).lerp(MODE_COLORS.clear[1], mix), 1);
        bgStars.material.uniforms.uGold.value = mix;
        bgNebulae.forEach(n => n.material.opacity = n.userData.o * (1 - mix));
        belt.material.color.copy(MODE_COLORS.belt[0]).lerp(MODE_COLORS.belt[1], mix);
        planets.forEach(pl => pl.orbitLine.material.color.copy(MODE_COLORS.orbit[0]).lerp(MODE_COLORS.orbit[1], mix));
    }

    function loop() {
        requestAnimationFrame(loop);
        const dt = Math.min(clock.getDelta(), 0.05);
        if (!visible) return;
        const t = clock.elapsedTime;
        applyMode(dt);

        // Orbites et rotations
        if (!paused) {
            planets.forEach(pl => {
                pl.angle += pl.p.speed * dt * 0.6;
                pl.pivot.rotation.y = pl.angle;
            });
            belt.rotation.y += dt * 0.01;
        }
        planets.forEach(pl => pl.mesh.rotation.y += dt * 0.25);
        sun.rotation.y += dt * 0.04;
        glow.material.opacity = 0.9 + Math.sin(t * 1.5) * 0.08;
        scene.children.forEach(o => { if (o.material && o.material.uniforms && o.material.uniforms.uTime) o.material.uniforms.uTime.value = t; });

        // Déplacement
        if (pendingOpen && pendingOpen !== flyTarget) pendingOpen = null; // trajet interrompu : pas d'ouverture
        if (flyTarget) {
            flyTarget.holder.getWorldPosition(worldPos);
            const r = flyTarget.p.size;
            tmp.copy(worldPos).normalize();
            desired.copy(worldPos).addScaledVector(tmp, r * 4.2).add(new THREE.Vector3(0, r * 1.4, 0));
            camera.position.lerp(desired, 1 - Math.pow(0.02, dt));
            lookM.lookAt(camera.position, worldPos, camera.up);
            targetQ.setFromRotationMatrix(lookM);
            camera.quaternion.slerp(targetQ, 1 - Math.pow(0.01, dt));
            velocity.set(0, 0, 0);
            if (pendingOpen === flyTarget) {
                const arrived = camera.position.distanceTo(desired) < r * 0.6 + 0.3 && camera.quaternion.angleTo(targetQ) < 0.06;
                if (arrived || performance.now() - pendingSince > 3500) { pendingOpen = null; openProjectModal(flyTarget.p); }
            }
        } else if (flyHome) {
            camera.position.lerp(HOME.pos, 1 - Math.pow(0.03, dt));
            euler.set(HOME.pitch, HOME.yaw, 0, 'YXZ');
            targetQ.setFromEuler(euler);
            camera.quaternion.slerp(targetQ, 1 - Math.pow(0.02, dt));
            if (camera.position.distanceTo(HOME.pos) < 0.5) { flyHome = false; syncAnglesFromCamera(); }
            velocity.set(0, 0, 0);
        } else {
            euler.set(pitch, yaw, 0, 'YXZ');
            camera.quaternion.setFromEuler(euler);

            const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            const acc = new THREE.Vector3();
            if (keys.KeyW || keys.ArrowUp) acc.add(fwd);
            if (keys.KeyS || keys.ArrowDown) acc.sub(fwd);
            if (keys.KeyD || keys.ArrowRight) acc.add(right);
            if (keys.KeyA || keys.ArrowLeft) acc.sub(right);
            if (keys.Space) acc.y += 1;
            if (keys.ShiftLeft || keys.ShiftRight) acc.y -= 1;
            if (acc.lengthSq() > 0) velocity.addScaledVector(acc.normalize(), ACCEL * dt);
            velocity.multiplyScalar(Math.exp(-DAMP * dt));
            camera.position.addScaledVector(velocity, dt);
        }

        // Collisions simples (soleil + planètes) et limite de zone
        const pushOut = (center, minD) => {
            tmp.copy(camera.position).sub(center);
            const d = tmp.length();
            if (d < minD) { camera.position.copy(center).addScaledVector(tmp.normalize(), minD); velocity.multiplyScalar(0.3); }
        };
        pushOut(new THREE.Vector3(0, 0, 0), 9);
        planets.forEach(pl => { pl.holder.getWorldPosition(worldPos); pushOut(worldPos, pl.p.size * 1.6); });
        if (camera.position.length() > MAX_R) { camera.position.setLength(MAX_R); velocity.multiplyScalar(0.5); }

        // Survol
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(planets.map(pl => pl.mesh));
        hovered = hits.length ? planets.find(pl => pl.mesh === hits[0].object) : null;
        wrap.classList.toggle('is-hovering', !!hovered && !dragging);

        // Planète la plus proche
        nearest = null;
        let best = Infinity;
        planets.forEach(pl => {
            pl.holder.getWorldPosition(worldPos);
            const d = worldPos.distanceTo(camera.position) / pl.p.size;
            if (d < best) { best = d; nearest = pl; }
        });
        if (best > 9) nearest = null;
        if (flyTarget) nearest = flyTarget; // en vol auto : la cible est prioritaire
        if (nearest !== shownProx) {
            shownProx = nearest;
            if (nearest) {
                proxCat.textContent = nearest.p.category;
                proxTitle.textContent = nearest.p.name;
                proxShort.textContent = nearest.p.short;
                document.getElementById('prox-live').classList.toggle('hidden', !nearest.p.preview);
                prox.classList.remove('hidden-card');
            } else prox.classList.add('hidden-card');
        }

        // Étiquettes HTML projetées
        const w = wrap.clientWidth, h = wrap.clientHeight;
        planets.forEach(pl => {
            pl.holder.getWorldPosition(worldPos);
            worldPos.y += pl.p.size * 1.35;
            tmp.copy(worldPos).project(camera);
            const behind = tmp.z > 1;
            const dist = camera.position.distanceTo(worldPos);
            pl.label.style.opacity = behind ? 0 : Math.max(0.25, Math.min(1, 140 / dist));
            pl.label.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
            pl.label.classList.toggle('is-hover', pl === hovered || pl === nearest);
            pl.orbitLine.material.opacity = (pl === hovered || pl === nearest) ? 0.45 : 0.16;
        });

        renderer.render(scene, camera);
    }
    loop();
}
