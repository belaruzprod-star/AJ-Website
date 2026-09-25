# AJ — site vitrine

Site de la marque AJ : des vestes en pièces uniques, cousues par Julia dans des tissus achetés en France. Une seule veste de chaque.

Le site est **statique** (HTML, CSS, un peu de JavaScript), **sans framework ni étape de build**, et se publie **gratuitement** avec GitHub Pages. Aucun service payant n'est nécessaire.

## Structure

| Fichier ou dossier | Rôle |
|---|---|
| `index.html` | Accueil |
| `pieces.html` | Liste des pièces |
| `veste-bleue.html`, `surchemise-ecrue.html`, `veste-indigo.html` | Une page par pièce |
| `atelier.html` | Julia, la machine, les tissus |
| `retouches.html` | Ourlets et autres retouches |
| `visuels.html` | Note sur les rendus générés par IA |
| `contact.html` | Contact |
| `mentions-legales.html` | Mentions légales, **à compléter** |
| `404.html` | Page introuvable |
| `assets/css/site.css` | Feuille de style (couleurs, typographie, mise en page) |
| `assets/css/fonts.css`, `assets/fonts/` | Polices auto-hébergées (Cormorant Garamond, Inter, licence OFL) |
| `assets/js/config.js` | **Coordonnées de contact, à remplir** (voir plus bas) |
| `assets/js/site.js` | Injecte les coordonnées dans les pages |
| `assets/js/motion.js` | Animations et effets (voir plus bas) |
| `assets/js/lenis.min.js` | Défilement inertiel, bibliothèque libre Lenis (licence MIT, embarquée) |
| `assets/img/` | Les neuf rendus, en WebP et JPEG, en 768 et 1536 px de large |
| `assets/logo/`, `favicon.svg`, `apple-touch-icon.png` | Monogramme AJ (silhouette vectorielle, optimisée) |
| `.nojekyll` | Indique à GitHub Pages de servir les fichiers tels quels |
| `.gitignore` | Exclut les sources de la campagne (`pour-claude-shinobi/`, zip) du dépôt publié |

## Publier sur GitHub Pages

0. Le dépôt doit être **public** pour utiliser GitHub Pages avec un compte gratuit (**Settings → General → Danger Zone → Change repository visibility**). Lire d'abord la section « Avant la mise en ligne » ci-dessous : elle explique ce qui deviendra visible.
1. Fusionner cette branche dans `main`.
2. Sur GitHub, ouvrir **Settings → Pages**.
3. Dans **Build and deployment**, choisir **Source : Deploy from a branch**, puis **Branch : `main`**, dossier **`/ (root)`**, et enregistrer.
4. Après une ou deux minutes, le site est en ligne à l'adresse `https://belaruzprod-star.github.io/AJ-Website/`.

Chaque nouveau commit sur `main` met le site à jour automatiquement.

Un nom de domaine personnalisé (par exemple `aj-vestes.fr`) peut être branché plus tard dans la même page de réglages. Le domaine lui-même est payant (quelques euros par an chez un registrar), l'hébergement reste gratuit. Dans ce cas, deux endroits à mettre à jour : la balise `<base href="/AJ-Website/">` de `404.html` (devient `<base href="/">`) et l'URL absolue des balises `og:image` en tête de chaque page.

## Avant la mise en ligne

### Bloquant

- **Les sources de la campagne.** Le dossier `pour-claude-shinobi/` (rendus originaux, prompts complets, galerie sans mention IA, `manifest.json` avec des chemins de l'ordinateur d'Antoine, note interne sur la maquette V8) et le zip de 24 Mo ont été retirés de la branche et ajoutés au `.gitignore` : GitHub Pages ne les servira pas. Ils restent toutefois dans **l'historique git** (les deux premiers commits « Add files via upload ») et seront lisibles par quiconque une fois le dépôt public. Si vous voulez les retirer vraiment, c'est facile tant que le dépôt est privé et que personne d'autre ne l'a cloné : repartir d'une branche orpheline ne contenant que le site, puis remplacer `main` (`git checkout --orphan site && git add -A && git commit -m "Site AJ" && git branch -M main && git push --force origin main`). Gardez une copie du dossier sur votre ordinateur avant.
- **L'adresse e-mail dans l'historique git.** Les deux premiers commits portent l'adresse e-mail du compte GitHub. Pour éviter qu'elle soit publique : **Settings → Emails → cocher « Keep my email addresses private »** ; la réécriture ci-dessus supprime aussi ces deux commits.
- **Les mentions légales.** La loi française (LCEN, art. 1-1) impose d'identifier l'éditeur, le directeur de la publication et l'hébergeur, même pour un site édité par des particuliers. La page `mentions-legales.html` contient des champs à compléter, ainsi qu'une formulation possible pour un éditeur non professionnel. Ceci n'est pas un conseil juridique : faites vérifier la page si vous avez un doute. Point d'attention : une fois un nom et une adresse publiés, la phrase « conseillère de vente en prêt-à-porter féminin dans le Marais » rend Julia identifiable sur son lieu de travail. À elle de décider si elle veut la garder.
- **Le contact.** Ouvrir `assets/js/config.js` et renseigner l'adresse e-mail (et, si vous voulez, le compte Instagram). Tant que c'est vide, la page Contact affiche un texte d'attente et les boutons « Demander cette pièce » renvoient vers cette page.
- **Faire relire les descriptions des pièces par Julia.** Elles ont été rédigées à partir des descriptions des vêtements fournies pour générer les rendus (`pour-claude-shinobi/PROMPTS.md`), pas à partir des vraies vestes. Coupe, poches, fermetures, motifs du dos : tout est à confirmer. En particulier : le terme « toile de Jouy » (employé pour les dos, parements et bords de poches) vient de ces descriptions et non du brief ; et le rendu de face de la veste indigo montre un liseré clair sur l'épaule que la description ne mentionne pas, la page le signale comme un artefact du rendu, à confirmer.
- **Les noms des pièces sont provisoires** (« Veste bleue ceinturée », « Surchemise écrue côtelée », « Veste indigo »). À remplacer par les vrais noms s'il y en a.

### Volontairement absent

Conformément au brief, le site ne mentionne **ni prix, ni tailles, ni composition des tissus, ni disponibilité**. Rien n'a été inventé. Si vous souhaitez les ajouter, le tableau « Coupe / Fermeture / Poches / Dos » de chaque page de pièce est l'endroit naturel.

### À décider

- Le rôle d'Antoine n'est pas décrit sur le site (le brief ne le précise pas). La page Atelier dit seulement « AJ est le projet de Julia et Antoine ».
- La page Retouches ne donne ni liste précise ni tarifs, faute d'information.
- La rubrique qui présente Julia s'appelle « Julia » dans la navigation (le fichier reste `atelier.html`) : le brief ne mentionne pas d'atelier, et le mot aurait laissé entendre un lieu de fabrication.
- Le site ne dit nulle part qu'une pièce est disponible ou vendue. Les boutons « Nous écrire » renvoient vers le contact sans présumer de la disponibilité.

## Modifier le site

- **Un texte** : ouvrir le fichier HTML concerné et modifier directement. Les pages sont courtes et lisibles.
- **Les coordonnées** : `assets/js/config.js`, deux champs.
- **Ajouter une pièce** : dupliquer une page de pièce (par exemple `veste-indigo.html`), adapter le texte et les images, puis ajouter une carte dans `index.html` et `pieces.html` en copiant un bloc `<a class="card" …>`.
- **Ajouter des images** : déposer dans `assets/img/` quatre fichiers par image, aux noms `nom-1536.webp`, `nom-768.webp`, `nom-1536.jpg`, `nom-768.jpg`. Un outil gratuit comme [Squoosh](https://squoosh.app) permet de redimensionner et convertir depuis un navigateur.
- **Les couleurs et polices** : en tête de `assets/css/site.css`, dans le bloc `:root`.

## Licences

- Polices Cormorant Garamond et Inter : SIL Open Font License 1.1, texte dans `assets/fonts/OFL.txt`.
- Lenis (défilement inertiel) : licence MIT, texte dans `assets/js/LICENSE-lenis.txt`.
- Monogramme, textes et rendus : AJ.

## Animations et effets

Le site utilise un système d'animations léger, sans service externe :

- rideau d'introduction avec le monogramme sur l'accueil, une seule fois par session ;
- titres qui montent mot à mot, textes et cartes qui apparaissent au défilement, images révélées par balayage ;
- zoom lent et parallaxe sur l'image d'accueil ;
- en-tête fixe qui devient un bandeau de verre flouté au défilement et se cache quand on descend ;
- bande défilante, galerie horizontale de la campagne, cartes qui basculent vers la vue de dos au survol ;
- boutons magnétiques, grain de film, transitions animées entre les pages (navigateurs récents) ;
- défilement inertiel (Lenis) sur les appareils à souris.

Tout est désactivé automatiquement pour les personnes qui ont demandé à leur système de réduire les animations, et le site reste entièrement lisible sans JavaScript. Pour retirer un effet, supprimer le bloc correspondant dans `assets/js/motion.js` ou dans la section « Mouvement » de `assets/css/site.css`.

## Les visuels

Les neuf images sont des rendus de campagne générés par IA à partir de photos des vraies pièces, avec des mannequins et des décors fictifs. Le site le signale sous chaque image, sous les grilles, dans le pied de page, et l'explique sur `visuels.html`. Les pantalons noirs, sous-pulls et masques visibles sur les rendus sont un stylisme généré, pas des créations AJ.

Les PNG originaux produits par ChatGPT portent des Content Credentials (C2PA) qui attestent leur origine ; les versions optimisées du site (WebP et JPEG redimensionnés) ne les conservent pas. Gardez les PNG originaux hors du dépôt : ils en font foi si besoin.
