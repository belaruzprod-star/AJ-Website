# AJ — site vitrine

Site de la marque AJ : des vestes en pièces uniques, cousues par Julia dans des tissus achetés en France. Une seule veste de chaque.

Le site est **statique** (HTML, CSS, un peu de JavaScript), **sans framework ni étape de build**, et se publie **gratuitement** avec GitHub Pages. Aucun service payant n'est nécessaire.

## Structure

| Fichier ou dossier | Rôle |
|---|---|
| `index.html` | Accueil : six scènes enchaînées (hero, manifeste, pièces, campagne, Julia, contact) |
| `pieces.html` | Anneau 3D des pièces |
| `veste-bleue.html`, `surchemise-ecrue.html`, `veste-indigo.html` | Fiche d'une pièce (lien profond ; sur l'accueil la même fiche s'ouvre en overlay) |
| `atelier.html` | Julia |
| `retouches.html`, `visuels.html`, `contact.html`, `mentions-legales.html`, `404.html` | Pages de texte et contact |
| `partials/` | Fragments HTML de chaque scène, à partir desquels les pages ont été assemblées |
| `assets/css/site.css`, `assets/css/scenes/*.css` | Base (couleurs, typographie, boutons) et feuille de chaque scène |
| `assets/js/core.js` | Socle : contexte `window.AJ` (données, bibliothèques, préchargeur) |
| `assets/js/photo3d.js` | Effet « photo 3D » en WebGL : parallaxe par pixel guidée par les cartes de profondeur |
| `assets/js/scenes/*.js` | Comportement de chaque scène (chrome, hero, manifeste, pieces, campagne, julia, contact, detail) |
| `assets/js/config.js` | **Coordonnées de contact, à remplir** |
| `assets/js/site.js`, `lenis.min.js`, `gsap.min.js`, `ScrollTrigger.min.js` | Injection des coordonnées ; bibliothèques embarquées (Lenis MIT, GSAP licence standard gratuite) |
| `assets/data/pieces.json` | Toutes les données : textes, pièces, images (embarquées dans chaque page) |
| `assets/depth/` | Cartes de profondeur des neuf images (heuristiques, remplaçables : voir `assets/depth/README.md`) |
| `assets/img/`, `assets/fonts/`, `assets/logo/`, `favicon.svg`, `apple-touch-icon.png` | Images optimisées, polices, monogramme |
| `demo/` | Une page de démonstration par scène, pour travailler une scène isolément |
| `.github/workflows/pages.yml` | Publication automatique sur GitHub Pages à chaque commit sur `main` |
| `.nojekyll`, `.gitignore` | Réglages GitHub Pages ; sources de campagne exclues du dépôt |

Les pages ont été assemblées à partir des fragments `partials/` et de `pieces.json` par un script qui n'est pas dans le dépôt : modifiez directement les pages HTML (et, pour rester cohérent, le fragment correspondant).

## Publier sur GitHub Pages

0. Le dépôt doit être **public** pour utiliser GitHub Pages avec un compte gratuit (**Settings → General → Danger Zone → Change repository visibility**). Lire d'abord la section « Avant la mise en ligne » ci-dessous : elle explique ce qui deviendra visible.
1. Fusionner cette branche dans `main`.
2. Sur GitHub, ouvrir **Settings → Pages**.
3. Le workflow `.github/workflows/pages.yml` publie le site tout seul à chaque commit sur `main` (il active Pages au premier passage ; on peut aussi le lancer à la main dans **Actions → Publier sur GitHub Pages → Run workflow**). Dans **Settings → Pages**, la source doit être **GitHub Actions**. Les dossiers `demo/` et `partials/` ne sont pas publiés.
4. Après une ou deux minutes, le site est en ligne à l'adresse `https://belaruzprod-star.github.io/AJ-Website/`.

Un nom de domaine personnalisé (par exemple `aj-vestes.fr`) peut être branché plus tard dans la même page de réglages. Le domaine lui-même est payant (quelques euros par an chez un registrar), l'hébergement reste gratuit. Dans ce cas, deux endroits à mettre à jour : la balise `<base href="/AJ-Website/">` de `404.html` (devient `<base href="/">`) et l'URL absolue des balises `og:image` en tête de chaque page.

## Avant la mise en ligne

### Bloquant

- **Les sources de la campagne.** Le dossier `pour-claude-shinobi/` (rendus originaux, prompts complets, galerie sans mention IA, `manifest.json` avec des chemins de l'ordinateur d'Antoine, note interne sur la maquette V8) et le zip de 24 Mo ont été retirés de la branche et ajoutés au `.gitignore` : GitHub Pages ne les servira pas. Ils restent toutefois dans **l'historique git** (les deux premiers commits « Add files via upload ») et seront lisibles par quiconque une fois le dépôt public. Si vous voulez les retirer vraiment, c'est facile tant que le dépôt est privé et que personne d'autre ne l'a cloné : repartir d'une branche orpheline ne contenant que le site, puis remplacer `main` (`git checkout --orphan site && git add -A && git commit -m "Site AJ" && git branch -M main && git push --force origin main`). Gardez une copie du dossier sur votre ordinateur avant.
- **L'adresse e-mail dans l'historique git.** Les deux premiers commits portent l'adresse e-mail du compte GitHub. Pour éviter qu'elle soit publique : **Settings → Emails → cocher « Keep my email addresses private »** ; la réécriture ci-dessus supprime aussi ces deux commits.
- **Les mentions légales.** La loi française (LCEN, art. 1-1) impose d'identifier l'éditeur, le directeur de la publication et l'hébergeur, même pour un site édité par des particuliers. La page `mentions-legales.html` contient des champs à compléter, ainsi qu'une formulation possible pour un éditeur non professionnel. Ceci n'est pas un conseil juridique : faites vérifier la page si vous avez un doute. Point d'attention : une fois un nom et une adresse publiés, la phrase « conseillère de vente en prêt-à-porter féminin dans le Marais » rend Julia identifiable sur son lieu de travail. À elle de décider si elle veut la garder.
- **Le contact.** Ouvrir `assets/js/config.js` et renseigner l'adresse e-mail (et, si vous voulez, le compte Instagram). Tant que c'est vide, la page Contact affiche un texte d'attente et les boutons « Nous écrire » des fiches et « Demander une retouche » renvoient vers cette page.
- **Faire relire les descriptions des pièces par Julia.** Elles ont été rédigées à partir des descriptions des vêtements fournies pour générer les rendus (`pour-claude-shinobi/PROMPTS.md`), pas à partir des vraies vestes. Coupe, poches, fermetures, motifs du dos : tout est à confirmer. En particulier : le terme « toile de Jouy » (employé pour les dos, parements et bords de poches) vient de ces descriptions et non du brief ; et le rendu de face de la veste indigo montre un liseré clair sur l'épaule que la description ne mentionne pas ; le site n'en dit rien, à faire confirmer par Julia.
- **Les noms des pièces sont provisoires** (« Veste bleue ceinturée », « Surchemise écrue côtelée », « Veste indigo »). À remplacer par les vrais noms s'il y en a.

### Volontairement absent

Conformément au brief, le site ne mentionne **ni prix, ni tailles, ni composition des tissus, ni disponibilité**. Rien n'a été inventé. Si vous souhaitez les ajouter, le tableau « Coupe / Fermeture / Poches / Dos » de chaque page de pièce est l'endroit naturel.

### À décider

- Le rôle d'Antoine n'est pas décrit sur le site (le brief ne le précise pas). La page Julia (`atelier.html`) dit seulement « AJ est le projet de Julia et Antoine ».
- La page Retouches ne donne ni liste précise ni tarifs, faute d'information.
- La rubrique qui présente Julia s'appelle « Julia » dans la navigation (le fichier reste `atelier.html`) : le brief ne mentionne pas d'atelier, et le mot aurait laissé entendre un lieu de fabrication.
- Le site ne dit nulle part qu'une pièce est disponible ou vendue. Les boutons « Nous écrire » renvoient vers le contact sans présumer de la disponibilité.

## Modifier le site

- **Un texte** : `assets/data/pieces.json` contient tous les textes (clés `texts`, `pieces`, `brand`, `nav`) ; ils sont recopiés dans chaque page HTML dans la balise `<script id="aj-data">` et dans les fragments `partials/`. Le plus simple est de modifier le texte dans la page HTML concernée (chercher la phrase).
- **Les coordonnées** : `assets/js/config.js`, deux champs.
- **Une scène** : sa feuille dans `assets/css/scenes/`, son script dans `assets/js/scenes/` (réglages en constantes en tête de fichier), son balisage dans `partials/`, sa démo dans `demo/`.
- **Les cartes de profondeur** : remplacer les PNG de `assets/depth/` par de meilleures cartes (mêmes noms, 768×512, blanc = proche) améliore directement l'effet 3D ; méthode dans `assets/depth/README.md`.
- **Les couleurs et polices** : en tête de `assets/css/site.css`, dans le bloc `:root`.

## Licences

- Polices Cormorant Garamond et Inter : SIL Open Font License 1.1, texte dans `assets/fonts/OFL.txt`.
- Lenis (défilement inertiel) : licence MIT, texte dans `assets/js/LICENSE-lenis.txt`.
- GSAP et ScrollTrigger (animations) : licence standard gratuite de GSAP, note dans `assets/js/LICENSE-gsap.txt`.
- Monogramme, textes et rendus : AJ.

## Animations et effets

Le site est une expérience à défilement, sans barre de navigation classique :

- préchargeur (compteur, rideau qui s'ouvre) ; menu plein écran avec aperçus d'images ; curseur personnalisé ; indicateur de scènes à droite ; transitions de page ;
- **fausse 3D** à partir des images : effet « photo 3D » (parallaxe par pixel selon une carte de profondeur, qui réagit à la souris, au défilement et au gyroscope), manifeste traversé en profondeur, anneau 3D des pièces, tunnel de la campagne ;
- titres qui entrent en 3D, textes qui se décodent ou se lisent mot à mot au défilement, images révélées.

Tout se désactive avec le réglage système « réduire les animations », et chaque page reste lisible sans JavaScript et sans WebGL (les images s'affichent telles quelles).

## Les visuels

Les neuf images sont des rendus de campagne générés par IA à partir de photos des vraies pièces, avec des mannequins et des décors fictifs. À la demande d'Antoine, **aucune mention n'apparaît sur ou sous les images**, ni dans les textes alternatifs. L'information n'existe plus qu'à un endroit : la page `visuels.html` (« À propos des visuels »), liée depuis le menu, le pied de page et les mentions légales.

Point de vigilance, à décider avant publication : en droit français, présenter comme des photos des images qui ne montrent pas fidèlement le produit peut relever de la pratique commerciale trompeuse (Code de la consommation, art. L121-2), et le règlement européen sur l'IA impose depuis août 2026 de signaler les contenus générés qui pourraient passer pour authentiques. Garder la page « À propos des visuels » accessible est le minimum ; l'endroit et la forme du signalement restent votre choix. Les pantalons noirs, sous-pulls et masques visibles sur les rendus sont un stylisme généré, pas des créations AJ. Le rendu de face de la veste indigo montre un liseré clair sur l'épaule que la description ne mentionne pas : à faire confirmer par Julia.

Les PNG originaux produits par ChatGPT portent des Content Credentials (C2PA) qui attestent leur origine ; les versions optimisées du site (WebP et JPEG redimensionnés) ne les conservent pas. Gardez les PNG originaux hors du dépôt : ils en font foi si besoin.
