#!/bin/sh
# Fabrique _preview/ : une copie du site destinée à une preview privée
# (Cloudflare Pages + Access), à relancer après chaque modification.
#
#   sh make-preview.sh
#   npx wrangler pages deploy _preview --project-name langage-preview
#
# Trois différences avec la production, et seulement trois :
#   1. le script Umami est retiré — sans ça les visites des clients
#      atterrissent dans les statistiques du vrai site ;
#   2. les balises robots passent en noindex/nofollow — Access bloque déjà
#      les robots, c'est une ceinture de plus ;
#   3. le fichier CNAME n'est pas copié : il déclare le domaine GitHub Pages
#      (www.langagearchitectes.fr) et n'a rien à faire sur une preview.
#
# Le reste est identique, police sous licence comprise : c'est bien le site
# tel qu'il sera. Photos, dessins et vidéo viennent des releases GitHub et du
# worker (CORS ouvert) — ils s'affichent depuis n'importe quel domaine.
set -e
cd "$(dirname "$0")"

rm -rf _preview
mkdir -p _preview/fonts

cp ./*.html _preview/
cp fonts/Suisse-Intl-Mono.woff2 _preview/fonts/
cp icon-192.png icon-512-maskable.png icon.svg site.webmanifest _preview/

# 1. Umami — le bloc tient sur deux lignes, d'où le mode « slurp » de perl.
perl -0777 -pi -e 's{[ \t]*<script defer src="https://cloud\.umami\.is/script\.js"\n[ \t]*data-website-id="[^"]*"></script>\n}{}g' _preview/*.html

# 2. Indexation
perl -0777 -pi -e 's{(<meta name="(?:robots|googlebot)" content=")[^"]*(")}{$1noindex, nofollow$2}g' _preview/*.html

echo "_preview/ prêt :"
ls _preview
echo
echo "Umami restant   : $(grep -l umami _preview/*.html 2>/dev/null | wc -l | tr -d ' ') fichier(s)"
echo "robots indexant : $(grep -l 'content="index' _preview/*.html 2>/dev/null | wc -l | tr -d ' ') fichier(s)"
