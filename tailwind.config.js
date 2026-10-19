// Configuration Tailwind du portfolio (anciennement portfolio/assets/js/tailwind.config.js pour le CDN).
// Après avoir ajouté des classes dans le HTML ou le JS : npm run build:css
module.exports = {
    // Les classes sont aussi écrites dans le JS (cartes, filtres, système solaire) : il faut le scanner
    content: ['./portfolio/index.html', './portfolio/assets/js/**/*.js'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                brand: {
                    bg: '#04050c',       // Deep space
                    card: '#111115',     // Card Surface
                    cardHover: '#181820',
                    border: 'rgba(255, 255, 255, 0.08)',
                    gold: '#d4af37',     // Soft Champagne Gold
                    indigo: '#6366f1',   // Slate Indigo
                    muted: '#94a3b8'
                }
            },
            fontFamily: {
                sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
            }
        }
    }
};
