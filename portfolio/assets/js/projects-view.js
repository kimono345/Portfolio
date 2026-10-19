// ====================================================
// SECTION PROJETS : bascule entre la vue Grille et la vue Univers 3D
// Le système solaire n'est créé qu'à la première ouverture de la vue Univers
// (économise le GPU et le chargement pour ceux qui restent sur la grille).
// ====================================================
const ProjectsView = (() => {
    const KEY = 'portfolio-projects-view';
    const panels = { grid: document.getElementById('view-grid'), universe: document.getElementById('view-universe') };
    const tabs = document.querySelectorAll('.view-switch [data-view]');
    const texts = document.querySelectorAll('[data-view-text]');
    let solarReady = false;

    function show(view) {
        if (!panels[view]) view = 'grid';
        Object.entries(panels).forEach(([k, el]) => { el.hidden = k !== view; });
        tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === view)));
        texts.forEach(t => { t.hidden = t.dataset.viewText !== view; });
        if (view === 'universe' && !solarReady && typeof initSolarSystem === 'function' && typeof THREE !== 'undefined') {
            solarReady = true;
            initSolarSystem();
            if (window.lucide) lucide.createIcons();
        }
        try { localStorage.setItem(KEY, view); } catch (e) {}
    }

    tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.view)));

    // La vue Univers n'est restaurée qu'une fois Three.js chargé (scripts différés)
    let saved = 'grid';
    try { saved = localStorage.getItem(KEY) || 'grid'; } catch (e) {}
    window.addEventListener('DOMContentLoaded', () => show(saved));

    return { show };
})();
