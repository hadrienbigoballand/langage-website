/**
 * Cloudflare Worker — proxy pour afficher les SVG stockés dans les GitHub releases.
 *
 * Pourquoi : GitHub sert les assets de release en `application/octet-stream`
 * avec `content-disposition: attachment` et SANS header CORS. Résultat :
 *   - un <img> charge les octets mais refuse d'afficher un SVG (mauvais MIME)
 *   - un <object> télécharge le fichier (attachment)
 *   - un fetch() est bloqué (pas de CORS)
 * Ce Worker récupère le fichier côté serveur (aucune contrainte CORS), puis le
 * renvoie avec `content-type: image/svg+xml`, en inline, avec CORS ouvert.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * DÉPLOIEMENT : `npx wrangler deploy` depuis ce dossier (config : wrangler.jsonc).
 * Déployé sur https://langage-svg.langage-fonts.workers.dev — l'URL est reprise
 * dans la constante SVG_PROXY de chaque page projet.
 *
 * AJOUTER UN PROJET : ajoute son tag de release à RELEASE_TAGS ci-dessous, puis
 * redéploie. Sans ça, ses dessins renvoient 400 « Unknown release tag ».
 * ──────────────────────────────────────────────────────────────────────────
 */

// Chaque projet a sa propre release. La page passe son tag via `?tag=…`, mais
// SEULS les tags de cette liste sont proxifiables (on ne proxifie pas une URL
// arbitraire → pas d'open proxy / SSRF). Ajoute ici le tag de chaque nouveau projet.
const RELEASE_TAGS = ["meule-habitee", "cabane-lisiere", "agora", "pierre"];
const DEFAULT_TAG = "meule-habitee"; // pages qui n'envoient pas encore `tag`
const RELEASE_ROOT =
  "https://github.com/hadrienbigoballand/website/releases/download/";

// Largeur minimale d'un trait, en pixels écran.
// Les SVG exportés depuis la CAO ont des traits ultra-fins (0.01 à 0.04 unité) qui
// deviennent invisibles à l'écran. Les lecteurs PDF imposent un minimum (hairline) ;
// on reproduit ce comportement ici. Augmente cette valeur pour des traits plus épais.
//
// ⚠️ Ce plancher ne fait pas que rattraper les traits invisibles : il écrase aussi
// les épaisseurs voulues qui passent en dessous. Les planches d'Agora et de Pierre
// sont dessinées sur trois niveaux (0.24 / 0.375 / 0.6) — au-dessus de 0.6 le
// plancher les aplatit toutes à la même valeur et le dessin perd sa hiérarchie de
// traits. D'où 0.4 : les hairlines de CAO restent visibles, et le niveau lourd
// (0.6) se détache à nouveau des deux autres.
// Pour comparer d'autres valeurs sur les vrais dessins, voir la page de réglage
// générée dans le scratchpad (curseur 0.2 → 1.2).
const MIN_STROKE_PX = 0.4;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const file = url.searchParams.get("file");
    const tag = url.searchParams.get("tag") || DEFAULT_TAG;

    // Réponse au préflight CORS si jamais nécessaire
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // Validation stricte : un nom de fichier .svg, rien d'autre.
    if (!file || !/^[\w.\-]+\.svg$/i.test(file)) {
      return new Response("Invalid file parameter", {
        status: 400,
        headers: corsHeaders(),
      });
    }

    // …et une release connue, sinon on ne va rien chercher.
    if (!RELEASE_TAGS.includes(tag)) {
      return new Response("Unknown release tag", {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const upstream = await fetch(RELEASE_ROOT + tag + "/" + file, {
      cf: { cacheTtl: 86400, cacheEverything: true },
    });

    if (!upstream.ok) {
      return new Response("Upstream error", {
        status: upstream.status,
        headers: corsHeaders(),
      });
    }

    let svgText = await upstream.text();

    // 1. Plancher sur la largeur des traits : tout stroke-width sous MIN_STROKE_PX
    //    est remonté à MIN_STROKE_PX (les traits plus épais sont conservés).
    svgText = svgText.replace(
      /stroke-width\s*[=:]\s*"?([\d.]+)"?/gi,
      (match, w) => {
        const v = Math.max(parseFloat(w), MIN_STROKE_PX);
        return match.includes(":") ? `stroke-width:${v}` : `stroke-width="${v}"`;
      }
    );

    // 2. vector-effect: non-scaling-stroke → la largeur de trait est interprétée
    //    en pixels écran, identique quelle que soit la taille d'affichage du SVG.
    const modified = svgText.replace(
      /(<svg[^>]*>)/,
      '$1<style>* { vector-effect: non-scaling-stroke; }</style>'
    );

    return new Response(modified, {
      headers: {
        ...corsHeaders(),
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=86400",
      },
    });
  },
};

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
  };
}
