// Démarrage : icônes Lucide + fond 3D (le système solaire est lancé par projects-view.js à la demande)
window.addEventListener('DOMContentLoaded', () => {
    initSpaceBackground();
    if (window.lucide) lucide.createIcons();
});
