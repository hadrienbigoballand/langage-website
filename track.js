/**
 * Mesure d'audience, chargé par les 5 pages après le script Umami.
 *
 * Événements Umami (tableau de bord Umami → Événements) :
 *      Téléchargement {projet, fichier} — bouton ↓ des pages projet
 *      Contact        {page}            — clic sur l'adresse email
 *      Onglet         {projet, onglet}  — DESSIN / RÉCIT / INFOS, au clic comme au doigt
 *      Colonne        {colonne}         — BUREAU / SUBSTANCES sur l'accueil
 *      Lien sortant   {url}             — Instagram, partenaires…
 */
(function () {
    const PAGE = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '') || 'index';

    function track(name, data) {
        try { if (window.umami) window.umami.track(name, data); } catch (e) { /* bloqué */ }
    }

    document.addEventListener('click', (e) => {
        const a = e.target.closest && e.target.closest('a');
        if (!a) return;
        const href = a.getAttribute('href') || '';
        if (a.id === 'download-btn') {
            track('Téléchargement', { projet: PAGE, fichier: href.split('/').pop() });
        } else if (href.startsWith('mailto:')) {
            track('Contact', { page: PAGE });
        } else if (/^https?:/.test(href) && a.hostname !== location.hostname) {
            track('Lien sortant', { url: a.hostname + a.pathname });
        }
    }, true);

    // Les onglets changent au clic comme au glissement : on guette le résultat
    // (la classe `active`) plutôt que les gestes qui y mènent.
    document.querySelectorAll('.project-tab-content').forEach((tab) => {
        new MutationObserver(() => {
            if (tab.classList.contains('active')) {
                track('Onglet', { projet: PAGE, onglet: tab.id.replace('tab-', '') });
            }
        }).observe(tab, { attributes: true, attributeFilter: ['class'] });
    });

    // Accueil : la carte glisse de colonne en colonne via son transform.
    const COLUMNS = ['bureau', 'projets', 'substances'];
    const map = document.getElementById('map');
    if (map) {
        let col = 1;
        new MutationObserver(() => {
            const m = /translateX\(-(\d+)/.exec(map.style.transform);
            const next = m ? Math.round(Number(m[1]) / 100) : 1;
            if (next !== col && COLUMNS[next]) {
                col = next;
                if (next !== 1) track('Colonne', { colonne: COLUMNS[next] });
            }
        }).observe(map, { attributes: true, attributeFilter: ['style'] });
    }
})();
