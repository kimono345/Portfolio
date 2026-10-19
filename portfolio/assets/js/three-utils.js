// Outils 3D partagés (fond spatial + système solaire)
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Écran tactile (téléphone, tablette) : 3D allégée et contrôles adaptés
const COARSE_POINTER = window.matchMedia('(pointer: coarse)').matches;

// Étoiles rondes, scintillantes, couleurs variées
function createStarField(count, radius, opts = {}) {
    const { minR = radius * 0.3, sizeMin = 0.6, sizeMax = 2.4, pixelRatio = 1 } = opts;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const palette = [
        new THREE.Color(0xffffff), new THREE.Color(0xcfe0ff), new THREE.Color(0xa9c4ff),
        new THREE.Color(0xfff1c9), new THREE.Color(0xffd9a0), new THREE.Color(0xe7d6ff)
    ];
    for (let i = 0; i < count; i++) {
        const u = Math.random(), v = Math.random();
        const theta = 2 * Math.PI * u, phi = Math.acos(2 * v - 1);
        const r = minR + Math.random() * (radius - minR);
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.75;
        pos[i * 3 + 2] = r * Math.cos(phi);
        const c = palette[(Math.random() * palette.length) | 0];
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        const big = Math.random() < 0.04;
        size[i] = big ? sizeMax * (1.4 + Math.random()) : sizeMin + Math.random() * (sizeMax - sizeMin);
        phase[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const mat = new THREE.ShaderMaterial({
        // uGold : 0 = couleurs naturelles (mode espace), 1 = nuances d'or (mode pro)
        // uFade : opacité globale (0 = étoiles masquées)
        uniforms: { uTime: { value: 0 }, uPR: { value: pixelRatio }, uGold: { value: 0 }, uFade: { value: 1 } },
        vertexShader: `
            attribute vec3 aColor; attribute float aSize; attribute float aPhase;
            uniform float uTime; uniform float uPR; uniform float uGold;
            varying vec3 vColor; varying float vAlpha;
            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = aSize * uPR * (300.0 / -mv.z);
                gl_Position = projectionMatrix * mv;
                vec3 gold = mix(vec3(0.80, 0.58, 0.20), vec3(1.0, 0.91, 0.64), fract(aPhase * 3.7));
                vColor = mix(aColor, gold, uGold);
                vAlpha = 0.55 + 0.45 * sin(uTime * (0.6 + fract(aPhase) * 1.8) + aPhase);
            }`,
        fragmentShader: `
            uniform float uFade;
            varying vec3 vColor; varying float vAlpha;
            void main() {
                float d = length(gl_PointCoord - 0.5);
                float core = smoothstep(0.5, 0.0, d);
                float glow = pow(core, 3.0);
                gl_FragColor = vec4(vColor, (core * 0.35 + glow) * vAlpha * uFade);
            }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    return new THREE.Points(geo, mat);
}

// Texture de nuage pour les nébuleuses
function makeNebulaTexture(hex) {
    const s = 256, c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const col = new THREE.Color(hex);
    const rgb = `${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0}`;
    for (let i = 0; i < 26; i++) {
        const x = s / 2 + (Math.random() - 0.5) * s * 0.55;
        const y = s / 2 + (Math.random() - 0.5) * s * 0.55;
        const r = s * (0.12 + Math.random() * 0.3);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${rgb},${0.08 + Math.random() * 0.1})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
    }
    // masque radial pour éviter les bords
    ctx.globalCompositeOperation = 'destination-in';
    const m = ctx.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s / 2);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = m; ctx.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
}

function makeGlowTexture(inner, outer) {
    const s = 256, c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.25, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
}
