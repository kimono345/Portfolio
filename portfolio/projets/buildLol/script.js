// ================= VARIABLES GLOBALES =================
var version = "";            // version du jeu (ex : "15.20.1")
var champions = [];          // tous les champions
var objets = [];             // tous les objets
var championChoisi = null;   // le champion sélectionné
var build = [null, null, null, null, null, null]; // les 6 slots du build
var niveau = 1;

var LANGUE = "fr_FR";
var URL_DDRAGON = "https://ddragon.leagueoflegends.com";


// ================= CHARGEMENT DES DONNEES =================
// async / await : on attend que chaque fichier soit téléchargé avant de continuer
async function chargerDonnees() {
    // 1. la dernière version du jeu
    var reponse = await fetch(URL_DDRAGON + "/api/versions.json");
    var versions = await reponse.json();
    version = versions[0]; // la plus récente est en premier
    document.getElementById("version").textContent = "Patch " + version;

    // 2. les champions
    reponse = await fetch(URL_DDRAGON + "/cdn/" + version + "/data/" + LANGUE + "/champion.json");
    var donneesChampions = await reponse.json();
    champions = Object.values(donneesChampions.data); // on transforme l'objet en tableau
    champions.sort(function (a, b) { return a.name.localeCompare(b.name); });

    // 3. les objets
    reponse = await fetch(URL_DDRAGON + "/cdn/" + version + "/data/" + LANGUE + "/item.json");
    var donneesObjets = await reponse.json();
    for (var id in donneesObjets.data) {
        var objet = donneesObjets.data[id];
        objet.id = id; // on garde l'identifiant pour retrouver l'image
        if (objetValide(objet)) {
            objets.push(objet);
        }
    }
    objets.sort(function (a, b) { return a.gold.total - b.gold.total; });

    afficherChampions();
    afficherObjets();
    afficherBuild();
    afficherStats();
}

// garde seulement les objets achetables sur la Faille de l'invocateur
function objetValide(objet) {
    if (!objet.gold.purchasable) return false;      // pas achetable
    if (!objet.maps || !objet.maps["11"]) return false; // pas sur la Faille (carte 11)
    if (objet.inStore === false) return false;      // pas dans la boutique
    if (objet.requiredChampion) return false;       // réservé à un champion
    if (objet.tags && objet.tags.indexOf("Consumable") != -1) return false; // potions...
    if (objet.tags && objet.tags.indexOf("Trinket") != -1) return false;    // balises
    return true;
}


// ================= AFFICHAGE DES CHAMPIONS =================
function afficherChampions() {
    var liste = document.getElementById("liste-champions");
    var recherche = document.getElementById("recherche-champion").value.toLowerCase();
    liste.innerHTML = "";

    for (var i = 0; i < champions.length; i++) {
        var champion = champions[i];

        // filtre de recherche
        if (champion.name.toLowerCase().indexOf(recherche) == -1) continue;

        var carte = document.createElement("div");
        carte.className = "carte";
        if (championChoisi && championChoisi.id == champion.id) {
            carte.className += " selection";
        }
        carte.innerHTML =
            '<img src="' + URL_DDRAGON + "/cdn/" + version + "/img/champion/" + champion.image.full + '" alt="">' +
            champion.name;
        carte.title = champion.name + " - " + champion.title;

        // on garde le champion dans la carte pour le retrouver au clic
        carte.dataset.index = i;
        carte.addEventListener("click", function () {
            choisirChampion(champions[this.dataset.index]);
        });

        liste.appendChild(carte);
    }
}

function choisirChampion(champion) {
    championChoisi = champion;

    var zone = document.getElementById("champion-choisi");
    zone.innerHTML =
        '<img src="' + URL_DDRAGON + "/cdn/" + version + "/img/champion/" + champion.image.full + '" alt="">' +
        "<div>" +
            "<h3>" + champion.name + "</h3>" +
            '<p class="titre">' + champion.title + "</p>" +
            '<p class="tags">' + champion.tags.join(" · ") + "</p>" +
        "</div>";

    afficherChampions(); // pour mettre à jour le contour bleu
    afficherStats();
}


// ================= AFFICHAGE DES OBJETS =================
function afficherObjets() {
    var liste = document.getElementById("liste-objets");
    var recherche = document.getElementById("recherche-objet").value.toLowerCase();
    var composants = document.getElementById("afficher-composants").checked;
    liste.innerHTML = "";

    for (var i = 0; i < objets.length; i++) {
        var objet = objets[i];

        // un objet "final" ne se transforme en rien d'autre (pas de "into")
        var estFinal = !objet.into || objet.into.length == 0;
        if (!composants && !estFinal) continue;

        if (objet.name.toLowerCase().indexOf(recherche) == -1) continue;

        var carte = document.createElement("div");
        carte.className = "carte";
        carte.innerHTML =
            '<img src="' + URL_DDRAGON + "/cdn/" + version + "/img/item/" + objet.image.full + '" alt="">' +
            objet.gold.total;
        carte.title = objet.name + " (" + objet.gold.total + " po)\n" + objet.plaintext;

        carte.dataset.index = i;
        carte.addEventListener("click", function () {
            ajouterObjet(objets[this.dataset.index]);
        });

        liste.appendChild(carte);
    }
}


// ================= BUILD =================
function ajouterObjet(objet) {
    // on cherche le premier slot vide
    for (var i = 0; i < 6; i++) {
        if (build[i] == null) {
            build[i] = objet;
            afficherBuild();
            afficherStats();
            return;
        }
    }
    alert("Le build est plein (6 objets maximum)");
}

function retirerObjet(index) {
    build[index] = null;
    afficherBuild();
    afficherStats();
}

function afficherBuild() {
    var zone = document.getElementById("slots-build");
    zone.innerHTML = "";
    var prix = 0;

    for (var i = 0; i < 6; i++) {
        var slot = document.createElement("div");
        slot.className = "slot";

        if (build[i] != null) {
            slot.className += " rempli";
            slot.innerHTML = '<img src="' + URL_DDRAGON + "/cdn/" + version + "/img/item/" + build[i].image.full + '" alt="">';
            slot.title = build[i].name + " (clic pour retirer)";
            prix += build[i].gold.total;
        }

        slot.dataset.index = i;
        slot.addEventListener("click", function () {
            retirerObjet(this.dataset.index);
        });

        zone.appendChild(slot);
    }

    document.getElementById("prix-build").textContent = prix + " po";
}


// ================= CALCUL DES STATS =================
// formule officielle de croissance des stats par niveau
function croissance(parNiveau, niv) {
    return parNiveau * (niv - 1) * (0.7025 + 0.0175 * (niv - 1));
}

// additionne une stat de tous les objets du build (ex : "FlatPhysicalDamageMod")
function bonusObjets(nomStat) {
    var total = 0;
    for (var i = 0; i < 6; i++) {
        if (build[i] != null && build[i].stats && build[i].stats[nomStat]) {
            total += build[i].stats[nomStat];
        }
    }
    return total;
}

function afficherStats() {
    var tableau = document.getElementById("tableau-stats");

    if (championChoisi == null) {
        tableau.innerHTML = '<tr><td class="vide">Aucun champion sélectionné</td></tr>';
        return;
    }

    var s = championChoisi.stats; // stats de base du champion
    var n = niveau;

    // ---- stats du champion seul (base + niveaux) ----
    var pvBase = s.hp + croissance(s.hpperlevel, n);
    var manaBase = s.mp + croissance(s.mpperlevel, n);
    var adBase = s.attackdamage + croissance(s.attackdamageperlevel, n);
    var armureBase = s.armor + croissance(s.armorperlevel, n);
    var rmBase = s.spellblock + croissance(s.spellblockperlevel, n);
    var regenPvBase = s.hpregen + croissance(s.hpregenperlevel, n);

    // ---- bonus des objets ----
    var pvBonus = bonusObjets("FlatHPPoolMod");
    var manaBonus = bonusObjets("FlatMPPoolMod");
    var adBonus = bonusObjets("FlatPhysicalDamageMod");
    var apBonus = bonusObjets("FlatMagicDamageMod");
    var armureBonus = bonusObjets("FlatArmorMod");
    var rmBonus = bonusObjets("FlatSpellBlockMod");
    var critBonus = bonusObjets("FlatCritChanceMod") * 100;            // 0.25 -> 25 %
    var volDeVie = bonusObjets("PercentLifeStealMod") * 100;
    var vitesseAttaqueBonus = bonusObjets("PercentAttackSpeedMod") * 100; // 0.25 -> 25 %
    var vitesseFlat = bonusObjets("FlatMovementSpeedMod");
    var vitessePourcent = bonusObjets("PercentMovementSpeedMod");

    // ---- totaux ----
    var pv = pvBase + pvBonus;
    var mana = manaBase + manaBonus;
    var ad = adBase + adBonus;
    var armure = armureBase + armureBonus;
    var rm = rmBase + rmBonus;

    // vitesse d'attaque : base x (1 + bonus des niveaux % + bonus des objets %)
    var vitesseAttaque = s.attackspeed * (1 + (croissance(s.attackspeedperlevel, n) + vitesseAttaqueBonus) / 100);
    vitesseAttaque = Math.min(vitesseAttaque, 2.5); // plafond du jeu

    // vitesse de déplacement : (base + bonus fixe) x (1 + bonus %)
    var vitesse = (s.movespeed + vitesseFlat) * (1 + vitessePourcent);

    // PV effectifs : combien de dégâts il faut pour te tuer
    var pvEffPhysique = pv * (1 + armure / 100);
    var pvEffMagique = pv * (1 + rm / 100);

    // ---- affichage ----
    var lignes = [
        ["Points de vie", pv, pvBonus],
        ["Mana", mana, manaBonus],
        ["Dégâts d'attaque (AD)", ad, adBonus],
        ["Puissance (AP)", apBonus, apBonus],
        ["Armure", armure, armureBonus],
        ["Résistance magique", rm, rmBonus],
        ["Vitesse d'attaque", vitesseAttaque, vitesseAttaqueBonus, "%"],
        ["Chances de coup critique", critBonus, critBonus, "%"],
        ["Vol de vie", volDeVie, volDeVie, "%"],
        ["Vitesse de déplacement", vitesse, 0],
        ["Portée", s.attackrange, 0],
        ["Régénération PV (5 s)", regenPvBase, 0],
        ["PV effectifs (physique)", pvEffPhysique, 0],
        ["PV effectifs (magique)", pvEffMagique, 0]
    ];

    var html = "";
    for (var i = 0; i < lignes.length; i++) {
        var nom = lignes[i][0];
        var valeur = lignes[i][1];
        var bonus = lignes[i][2];
        var unite = lignes[i][3] || "";

        // la vitesse d'attaque s'affiche avec 2 décimales, le reste arrondi
        var texteValeur;
        if (nom == "Vitesse d'attaque") {
            texteValeur = valeur.toFixed(2);
        } else {
            texteValeur = Math.round(valeur) + (unite == "%" ? " %" : "");
        }

        var texteBonus = "";
        if (bonus > 0 && nom != "Puissance (AP)" && nom != "Chances de coup critique" && nom != "Vol de vie") {
            texteBonus = "+" + Math.round(bonus) + unite + " objets";
        }

        html += "<tr><td>" + nom + "</td><td>" + texteValeur + "</td><td class='bonus'>" + texteBonus + "</td></tr>";
    }
    tableau.innerHTML = html;
}


// ================= EVENEMENTS =================
document.getElementById("recherche-champion").addEventListener("input", afficherChampions);
document.getElementById("recherche-objet").addEventListener("input", afficherObjets);
document.getElementById("afficher-composants").addEventListener("change", afficherObjets);

document.getElementById("niveau").addEventListener("input", function () {
    niveau = Number(this.value);
    document.getElementById("valeur-niveau").textContent = niveau;
    afficherStats();
});


// ================= DEMARRAGE =================
chargerDonnees().catch(function (erreur) {
    document.getElementById("version").textContent = "Erreur de chargement des données";
    console.error(erreur);
});