import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';


var scene;
var renderer;
var camera;


//variable 2
var maSecoupe1;
var maSecoupe2;
var maSecoupe3;
var monRayon1;
var maMegaSecoupe1;
var groupeSecoupe;
var groupeStation;
var monVaisseauMere1;
var monVaisseauMere2;
var monVaisseauMere3;
var monVaisseauMere4;
var maStation1;
var secoupesLarguees = [];



//materieux generaux
const metal = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.5,
    roughness: 0.2
});

const verre = new THREE.MeshPhysicalMaterial({
    color: 0x87ceeb,
    metalness: 0,
    roughness: 0.05,     // très lisse = brillant
    transparent: true,
    opacity: 1,        // on voit à travers
    clearcoat: 1,        // couche vernie qui fait les reflets
    clearcoatRoughness: 0
});

const neonBleu = new THREE.MeshStandardMaterial({
    color: 0x00c8ff,
    emissive: 0x00c8ff,
    emissiveIntensity: 3
});
const blanc = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.2, roughness: 0.3 });
const sphereBleue = new THREE.MeshStandardMaterial({
    color: 0x00c8ff, emissive: 0x00c8ff, emissiveIntensity: 0.8,
    metalness: 0.8, roughness: 0.1
});

// creation vaisseau
function secoupe(x = 0, y = 0, z = 0) {
    //sphère plate
    var secoupe1;
    const geometry = new THREE.SphereGeometry(30, 64, 32);
    geometry.scale(1.2, 0.3, 1.2);

    secoupe1 = new THREE.Mesh(geometry, metal);
    scene.add(secoupe1);
    // néon vert autour
    var secoupe1NeonFille = new THREE.Mesh(
        new THREE.TorusGeometry(31, 1.5, 16, 64),
        neonBleu
    );
    secoupe1NeonFille.rotation.x = Math.PI / 2; // on couche l'anneau
    secoupe1.add(secoupe1NeonFille);
    secoupe1NeonFille.position.set(0, -3.5, 0) //mettre neon en doussus de la secoupe

    //cokpit
    const demiRond = new THREE.SphereGeometry(28, 26, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    demiRond.scale(1, 0.5, 1);
    var cokpit = new THREE.Mesh(demiRond, metal);
    secoupe1.add(cokpit);
    //neon autour du cokpit
    var secoupe1NeonCokpit = new THREE.Mesh(
        new THREE.TorusGeometry(26.7, 1.5, 16, 64),
        neonBleu
    );
    secoupe1NeonCokpit.rotation.x = Math.PI / 2; // on couche l'anneau
    secoupe1.add(secoupe1NeonCokpit);
    secoupe1NeonCokpit.position.set(0, 4.5, 0)

    secoupe1.position.set(x, y, z);

    return secoupe1;
}

//fait spawn rayon trateur pour une secoupe donnée
function spawnRayonTracteur(secoupe, delaiDebut, delaiFin) {
    var rayon = new THREE.Mesh(
        new THREE.CylinderGeometry(28, 40, 100, 64, 1, true), // true = tube ouvert
        new THREE.MeshStandardMaterial({
            color: 0x00c8ff,
            emissive: 0x00c8ff,
            emissiveIntensity: 2,
            transparent: true,
            opacity: 0.3,            // rayon translucide
            side: THREE.DoubleSide,  // visible de l'intérieur aussi
            depthWrite: false        // évite les bugs d'affichage avec la transparence demande par ia la texture
        })
    );
    rayon.position.set(0, -50, 0);
    setTimeout(() => { secoupe.add(rayon); }, delaiDebut);  // apparaît après le délai
    setTimeout(() => secoupe.remove(rayon), delaiDebut + delaiFin);
    return rayon; // pratique si tu veux le supprimer après
}


function MegaSecoupe(x, y, z) {
    var vaisseau = new THREE.Group(); // base
    scene.add(vaisseau);

    var base = secoupe(0, 0, 0);
    vaisseau.add(base);
    base.scale.set(8, 4, 8);

    var nbBarres = 8;
    for (let i = 0; i < nbBarres; i++) {
        var pivot = new THREE.Group();           // tourne autour du centre
        pivot.rotation.y = i * (Math.PI * 2 / nbBarres);
        base.add(pivot);

        var barre = new THREE.Mesh(new THREE.BoxGeometry(20, 0.5, 0.8), neonBleu);
        barre.position.set(18, -8.2, 0);         // à mi-chemin entre le centre et l'anneau
        barre.rotation.z = 0.15;                 // légèrement penchée pour suivre la courbe du dessous
        pivot.add(barre);
    }

    var nbSecoupes = 8;
    var secoupesTransportees = [];
    for (let i = 0; i < nbSecoupes; i++) {
        var pivotSecoupe = new THREE.Group();
        pivotSecoupe.rotation.y = Math.PI / 8 + i * (Math.PI * 2 / nbSecoupes); // entre deux barres
        vaisseau.add(pivotSecoupe);

        // pylône qui descend de la coque
        var pylone = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 30, 16), metal);
        pylone.position.set(150, -46, 0);
        pivotSecoupe.add(pylone);

        // anneau de fixation au bout du pylône
        var pince = new THREE.Mesh(new THREE.TorusGeometry(8, 2, 8, 32), neonBleu);
        pince.rotation.x = Math.PI / 2;
        pince.position.set(150, -61, 0);
        pivotSecoupe.add(pince);

        // la petite secoupe accrochée
        var petite = secoupe(0, 0, 0);
        petite.position.set(150, -75, 0);
        pivotSecoupe.add(petite);
        secoupesTransportees.push(petite);
    }
    vaisseau.userData.secoupes = secoupesTransportees;

    vaisseau.position.set(x, y, z);
    return vaisseau;
}

//largue la prochaine secoupe du vaisseau après un délai en ms
function larguerSecoupe(vaisseau, delai) {
    setTimeout(() => {
        var s = vaisseau.userData.secoupes.shift(); // prend la première secoupe
        scene.attach(s);                            // la détache du vaisseau
        secoupesLarguees.push(s);                   // toRender() va l'animer
    }, delai);
}

function vaisseauMere(x, y, z) {
    var base = new THREE.Group(); // base
    scene.add(base);

    var hauteursLignes = [-8, 8]; // mêmes hauteurs pour le cylindre et les bras

    // cylindre principal, creusé en demi-cercle sur le dessus ia pour creuser
    var profil = [];
    profil.push(new THREE.Vector2(0, -37.5));    // centre du dessous
    profil.push(new THREE.Vector2(100, -37.5));  // bord du dessous
    profil.push(new THREE.Vector2(100, 37.5));   // bord du dessus
    profil.push(new THREE.Vector2(70, 37.5));    // début du creux (rayon 70)
    for (let i = 1; i <= 16; i++) {              // le creux en arrondi
        var t = (i / 16) * (Math.PI / 2);
        profil.push(new THREE.Vector2(70 * Math.cos(t), 37.5 - 40 * Math.sin(t)));
    }
    var colonne = new THREE.Mesh(new THREE.LatheGeometry(profil, 64), blanc);
    base.add(colonne);

    // 2 ronds autour de l'anneau
    for (let h of hauteursLignes) {
        var ronds = new THREE.Mesh(new THREE.TorusGeometry(101, 1.5, 8, 64), metal);
        ronds.rotation.x = Math.PI / 2;
        ronds.position.y = h;
        base.add(ronds);
    }
    var ronds1 = new THREE.Mesh(new THREE.TorusGeometry(101, 1.5, 8, 64), metal);
    ronds1.rotation.x = Math.PI / 2;
    ronds1.position.y = -35;
    base.add(ronds1);
    var ronds2 = new THREE.Mesh(new THREE.TorusGeometry(101, 3, 8, 64), metal);
    ronds2.rotation.x = Math.PI / 2;
    ronds2.position.y = 35;
    base.add(ronds2);
    // haut du vaisseau
    for (let i = 0; i < 8; i++) {
        var arche = new THREE.Mesh(new THREE.TorusGeometry(90, 5, 12, 48, Math.PI), metal);
        arche.scale.set(1, 1, 1);
        arche.rotation.y = i * Math.PI / 8;
        arche.position.y = 37.5;
        base.add(arche);
    }

    // ---- gyroscope autour de la sphère ----
    var gyro = new THREE.Group();
    gyro.position.y = 60;
    base.add(gyro);

    for (let i = 0; i < 6; i++) {
        var anneau = new THREE.Mesh(new THREE.TorusGeometry(55, 3, 12, 64), metal);
        anneau.rotation.x = i * Math.PI / 3;   // chaque anneau penché différemment
        anneau.rotation.y = i * Math.PI / 4;
        gyro.add(anneau);
        gyro.scale.set(0.8, 0.8, 0.8);
    }
    base.userData.gyro = gyro; // pour l'animer dans toRender()

    // sphère bleue au centre
    var coeur = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), neonBleu);
    coeur.position.y = 60;
    coeur.scale.set(0.8, 0.8, 0.8);
    base.add(coeur);

    // demi rond en bas
    var bol = new THREE.Mesh(
        new THREE.SphereGeometry(100, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), blanc);
    bol.scale.y = 0.4;
    bol.position.y = -37.5;
    base.add(bol);

    // moyeu + barres en croix
    var moyeu = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 20, 32), metal);
    moyeu.position.y = -85;
    base.add(moyeu);
    for (let i = 0; i < 2; i++) {
        var barre = new THREE.Mesh(new THREE.BoxGeometry(180, 8, 8), metal);
        barre.rotation.y = Math.PI / 4 + i * Math.PI / 2;
        barre.position.y = -85;
        base.add(barre);
    }

    // 4 bras avec vitre bleue au bout
    var angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
    for (let a of angles) {
        var pivot = new THREE.Group(); // tourne autour du centre
        pivot.rotation.y = a;
        base.add(pivot);

        var bras = new THREE.Mesh(new THREE.BoxGeometry(110, 40, 55), blanc);
        bras.position.x = 150;
        pivot.add(bras);

        // 2 lignes le long du bras, alignées avec les ronds du cylindre
        for (let h of hauteursLignes) {
            for (let cote of [-1, 1]) {
                var ligne = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 110, 8), metal);
                ligne.rotation.z = Math.PI / 2;      // couché le long du bras
                ligne.position.set(150, h, cote * 27.5); // collé sur chaque flanc
                pivot.add(ligne);
            }
        }

        var bout = new THREE.Mesh(
            new THREE.CylinderGeometry(27.5, 27.5, 40, 32, 1, false, 0, Math.PI),
            blanc
        );
        bout.position.x = 205;
        pivot.add(bout);

        var vitre = new THREE.Mesh(
            new THREE.CylinderGeometry(28.5, 28.5, 30, 32, 1, false, 0, Math.PI),
            neonBleu
        );
        vitre.position.x = 205;
        pivot.add(vitre);
    }

    // canon fait avec ia
    var canon = new THREE.Group();
    base.add(canon);

    var nbTentacules = 10;
    for (let t = 0; t < nbTentacules; t++) {
        var pivotTentacule = new THREE.Group();          // tourne autour du centre
        pivotTentacule.rotation.y = t * (Math.PI * 2 / nbTentacules);
        canon.add(pivotTentacule);

        var sens = (t % 2 === 0) ? 1 : -1;               // une sur deux tourne dans l'autre sens
        var points = [];
        for (let i = 0; i < 8; i++) {
            var r = 24;
            var angle = i * 0.35 * sens;                 // tourne un peu plus à chaque point
            points.push(new THREE.Vector3(
                r * Math.cos(angle),
                -95 - i * 12,                            // descend de -95 à -193
                r * Math.sin(angle)
            ));
        }
        var courbe = new THREE.CatmullRomCurve3(points);
        var tentacule = new THREE.Mesh(new THREE.TubeGeometry(courbe, 64, 3, 8), blanc);
        pivotTentacule.add(tentacule);
    }

    // anneau néon  (sortie du laser)
    var sortie = new THREE.Mesh(new THREE.TorusGeometry(14, 2, 8, 32), neonBleu);
    sortie.rotation.x = Math.PI / 2;
    sortie.position.y = -95;
    canon.add(sortie);

    base.userData.canon = canon;       // pour l'animer

    base.position.set(x, y, z);
    return base;
}

//fait tirer le canon du vaisseau mere
function tirerCanon(vaisseau, delaiD, delaiF) {
    var yDepart = -95;

    // boule de charge
    var charge = new THREE.Mesh(new THREE.SphereGeometry(13, 16, 8), neonBleu);
    charge.position.y = yDepart;

    // laser du tir
    var laser = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 1000, 16, 1, true), neonBleu);
    laser.position.y = yDepart - 500;
    var flash = new THREE.PointLight(0x00c8ff, 1000, 1000,1);
    flash.position.y = -150;

    // 1. charge
    setTimeout(() => {
        vaisseau.add(charge);
        vaisseau.userData.enCharge = true;
    }, delaiD);

    // 2. tir (1.5 s après le début de la charge)
    setTimeout(() => {
        vaisseau.remove(charge);
        vaisseau.add(laser);
        vaisseau.add(flash);
    }, delaiD + 1500);

    // 3. fin
    setTimeout(() => {
        vaisseau.remove(laser);
        vaisseau.remove(flash);
        vaisseau.userData.enCharge = false;
    }, delaiD + 1500 + delaiF);
}


function stationCombat(x, y, z) {
    var base = new THREE.Group();
    scene.add(base);

    var rayon = 150;
    var hauteurMilieu = 20; // hauteur du cylindre central

    // demi-sphère du haut
    var haut = new THREE.Mesh(
        new THREE.SphereGeometry(rayon, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), metal);
    haut.position.y = hauteurMilieu / 2;
    base.add(haut);

    // demi-sphère du bas
    var bas = new THREE.Mesh(
        new THREE.SphereGeometry(rayon, 64, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), metal);
    bas.position.y = -hauteurMilieu / 2;
    base.add(bas);

    // cylindre au milieu, un peu plus large pour qu'il ressorte
    var milieu = new THREE.Mesh(
        new THREE.CylinderGeometry(rayon - 5, rayon - 5, hauteurMilieu, 64), blanc);
    base.add(milieu);

    // néons bleus en haut et en bas du cylindre
    for (let cote of [-1, 1]) {
        var neon = new THREE.Mesh(new THREE.TorusGeometry(rayon - 5, 2, 8, 96), neonBleu);
        neon.rotation.x = Math.PI / 2;
        neon.position.y = cote * hauteurMilieu / 2;
        base.add(neon);
    }

    base.position.set(x, y, z);
    return base;
}


function destroyer(x, y, z) {
    var vaisseau = new THREE.Group();
    scene.add(vaisseau);

    // corps : secoupe de base agrandie (même échelle sur les 3 axes = pas de déformation)
    var corps = secoupe(0, 0, 0);
    corps.scale.set(3, 3, 3);              // rayon 108, demi-épaisseur 27
    vaisseau.add(corps);

    // ---- réglages des tourelles ----
    var nbTourelles = 8;
    var tx = 70;                           // distance du centre
    var longueur = 25;                     // longueur des canons
    var angleBas = Math.PI / 4;            // inclinaison vers le bas (0 = horizontal, Math.PI / 2 = vertical)

    // hauteur calculée pour coller sous la coque à cette distance
    var ty = -27 * Math.sqrt(1 - (tx / 108) ** 2);

    // direction des canons, calculée à partir de l'angle
    var dirX = Math.cos(angleBas);         // part vers l'extérieur
    var dirY = -Math.sin(angleBas);        // part vers le bas

    for (let i = 0; i < nbTourelles; i++) {
        var pivot = new THREE.Group();
        pivot.rotation.y = i * (Math.PI * 2 / nbTourelles);
        vaisseau.add(pivot);

        var tourelle = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 8), metal);
        tourelle.position.set(tx, ty, 0);
        pivot.add(tourelle);

        for (let decal of [-3, 3]) {       // deux canons côte à côte
            var canon = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.5, longueur, 8), metal);
            canon.rotation.z = -(Math.PI / 2 + angleBas); // oriente le canon selon l'angle
            canon.position.set(
                tx + dirX * longueur / 2,  // milieu du canon
                ty + dirY * longueur / 2,
                decal
            );
            pivot.add(canon);

            var bout = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), neonBleu);
            bout.position.set(
                tx + dirX * longueur,      // bout du canon
                ty + dirY * longueur,
                decal
            );
            pivot.add(bout);
        }
    }

    vaisseau.position.set(x, y, z);
    return vaisseau;
}


function chasseurSecoupe(x, y, z) {
    var vaisseau = new THREE.Group();
    scene.add(vaisseau);

    // corps : secoupe de base, taille normale
    var corps = secoupe(0, 0, 0);
    vaisseau.add(corps);

    // une tourelle de chaque côté, sur le bord
    for (let cote of [-1, 1]) {
        var tourelle = new THREE.Group();
        tourelle.position.x = cote * 34;   // collée au bord (rayon de la secoupe : 36)
        vaisseau.add(tourelle);

        tourelle.add(new THREE.Mesh(new THREE.SphereGeometry(4, 16, 8), metal));

        for (let decal of [-1.5, 1.5]) {   // deux petits canons vers l'avant
            var canon = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 12, 8), metal);
            canon.rotation.x = Math.PI / 2;
            canon.position.set(0, decal, 7);
            tourelle.add(canon);

            var bout = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), neonBleu);
            bout.position.set(0, decal, 13.5);
            tourelle.add(bout);
        }
    }

    vaisseau.position.set(x, y, z);
    return vaisseau;
}
// ================= SCÈNE + RENDU =================
function start() {
    // ---------------- SCENE ----------------
    scene = new THREE.Scene();

    // ---------------- RENDERER ----------------
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // ---------------- CAMERA ----------------
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 30000);
    camera.position.set(1200, 1500, 1000);
    //camera.lookAt(new THREE.Vector3(0, 0, 0));
    //scene.add(camera);

    //class pour la cam https://threejs.org/manual/#cameras j'ai aps compris comment ca marche mais ca marche
    class MinMaxGUIHelper {
        constructor(obj, minProp, maxProp, minDif) {
            this.obj = obj;
            this.minProp = minProp;
            this.maxProp = maxProp;
            this.minDif = minDif;
        }
        get min() {
            return this.obj[this.minProp];
        }
        set min(v) {
            this.obj[this.minProp] = v;
            this.obj[this.maxProp] = Math.max(this.obj[this.maxProp], v + this.minDif);
        }
        get max() {
            return this.obj[this.maxProp];
        }
        set max(v) {
            this.obj[this.maxProp] = v;
            this.min = this.min;  // this will call the min setter
        }
    }

    function updateCamera() {
        camera.updateProjectionMatrix();
    }

    const gui = new GUI();
    gui.add(camera, 'fov', 1, 180).onChange(updateCamera);
    const minMaxGUIHelper = new MinMaxGUIHelper(camera, 'near', 'far', 0.1);
    gui.add(minMaxGUIHelper, 'min', 0.1, 50, 0.1).name('near').onChange(updateCamera);
    gui.add(minMaxGUIHelper, 'max', 100, 30000, 1).name('far').onChange(updateCamera);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 5, 0);
    controls.update();
    // ---------------- LIGHTS ----------------
    var myAmbientLight = new THREE.AmbientLight(0x8899ff, 0.3);
    scene.add(myAmbientLight);

    var directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1000, 2000, 500); 
    scene.add(directionalLight);

    // ---------------- OBJECTS ----------------
    maSecoupe1 = secoupe(0, -100, 0);
    maSecoupe2 = secoupe(-90, -100, -60);
    maSecoupe3 = secoupe(90, -100, -60);
    monRayon1 = spawnRayonTracteur(maSecoupe1, 2000, 1000);
    monRayon1 = spawnRayonTracteur(maSecoupe2, 3000, 1000);
    monRayon1 = spawnRayonTracteur(maSecoupe3, 4000, 1000);
    maMegaSecoupe1 = MegaSecoupe(0, 500, 500);

    monVaisseauMere1 = vaisseauMere(0, 800, 0);
    monVaisseauMere1.scale.set(2, 2, 2);
    monVaisseauMere2 = vaisseauMere(3500, 1200, 0);
    monVaisseauMere2.scale.set(2, 2, 2);
    monVaisseauMere3 = vaisseauMere(-1750, 1200, 3031);
    monVaisseauMere3.scale.set(2, 2, 2);
    monVaisseauMere4 = vaisseauMere(-1750, 1200, -3031);
    monVaisseauMere4.scale.set(2, 2, 2);


    maStation1 = stationCombat(0, 0, -4000); 
    maStation1.scale.set(15, 15, 15);

    destroyer(0, 600, 1000);

    for (let i = -2; i <= 2; i++) {
        chasseurSecoupe(i * 90, 600, 600 - Math.abs(i) * 60);
    }

    // groupage pour escoudron de secoupes
    groupeSecoupe = new THREE.Group();
    //groupeSecoupe.position.copy(maSecoupe1.position);
    scene.add(groupeSecoupe);
    groupeSecoupe.add(maSecoupe1);
    groupeSecoupe.add(maSecoupe2);
    groupeSecoupe.add(maSecoupe3);

    // groupage pour vaisseau nomai orbite autoir de la station
    groupeStation = new THREE.Group();
    groupeStation.position.copy(maStation1.position);
    scene.add(groupeStation);
    groupeStation.add(monVaisseauMere2);
    groupeStation.add(monVaisseauMere3);
    groupeStation.add(monVaisseauMere4);




    //les fonctionnalitées
    window.addEventListener('keydown', (event) => {
        if (event.key === ' ') {
            if (!monVaisseauMere1.userData.enCharge) {
                tirerCanon(monVaisseauMere1, 0, 2000);
                tirerCanon(monVaisseauMere2, 0, 2000);
                tirerCanon(monVaisseauMere3, 0, 2000);
                tirerCanon(monVaisseauMere4, 0, 2000);
            }
        }

        if (event.key === 'ArrowUp') {
            monVaisseauMere1.position.z -= 30;
        }
        if (event.key === 'ArrowDown') {
            monVaisseauMere1.position.z += 30;
        }
        if (event.key === 'ArrowLeft') {
            monVaisseauMere1.position.x -= 30;
        }
        if (event.key === 'ArrowRight') {
            monVaisseauMere1.position.x += 30;
        }

        if (event.key === '&') {
            larguerSecoupe(maMegaSecoupe1, 0);
        }
        if (event.key === 'r') {
            monVaisseauMere1.position.set(0, 800, 0);
        }
        if (event.key === 'z') {
            camera.position.z -= 30;
        }
        if (event.key === 's') {
            camera.position.z += 30;
        }
        if (event.key === 'q') {
            camera.position.x -= 30;
        }
        if (event.key === 'd') {
            camera.position.x += 30;
        }
        if (event.key === 'a') {
            camera.position.y -= 30;
        }
        if (event.key === 'e') {
            camera.position.y += 30;
        }
    });


    // ---------------- RENDER SCENE ----------------
    toRender();
}

// BOUCLE DE RENDU
function toRender() {
    maSecoupe1.rotateY(0.02);  // pivote sur son axe y
    groupeSecoupe.position.z += 0.5;
    if (groupeSecoupe.position.z == 200) {
        groupeSecoupe.position.z -= 200;
        monRayon1 = spawnRayonTracteur(maSecoupe1, 2000, 1000);
        monRayon1 = spawnRayonTracteur(maSecoupe2, 3000, 1000);
        monRayon1 = spawnRayonTracteur(maSecoupe3, 4000, 1000);
    }
    //maMegaSecoupe1.rotateY(0.02);
    monVaisseauMere1.userData.gyro.rotation.y += 0.01;
    monVaisseauMere1.userData.gyro.rotation.x += 0.005;

    if (monVaisseauMere1.userData.enCharge) {
        monVaisseauMere1.userData.canon.rotation.y += 0.1;
        monVaisseauMere2.userData.canon.rotation.y += 0.1;
        monVaisseauMere3.userData.canon.rotation.y += 0.1;
        monVaisseauMere4.userData.canon.rotation.y += 0.1;
    }

    groupeStation.rotateY(0.005)


    for (let s of secoupesLarguees) {
        if (s.position.y >= 300) {
            s.position.y -= 1;
        }
    }


    renderer.render(scene, camera);
    requestAnimationFrame(toRender);
}



start();