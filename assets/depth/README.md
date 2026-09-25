# Cartes de profondeur (`assets/depth/`)

Neuf cartes `NN-nom.png`, une par rendu de `assets/img/NN-nom-1536.jpg` : 768 × 512 px (3:2), niveaux de gris 8 bits, **blanc = proche, noir = loin**. Elles sont lues par `AJ.Photo3D` (`assets/js/photo3d.js`) via `AJ.images[clé].depth`.

## Méthode (heuristique, sans modèle)

Aucun modèle d'estimation monoculaire n'est disponible hors ligne, donc les cartes sont calculées par le script `make_depth.py` reproduit en fin de fichier (Python, Pillow + numpy + scipy) :

1. **Netteté locale** : l'image en gris est réduite à 768 × 512, légèrement lissée, puis on prend la valeur absolue du laplacien, lissée à σ = 10 px et normalisée au 97ᵉ percentile. Dans les rendus, le sujet est net et le fond (shoji, arbres, brume) est flou : la netteté sépare donc grossièrement proche/loin.
2. **A priori de composition** :
   - dégradé vertical `(y/H)^1.3` : sol proche en bas, fond loin en haut ;
   - ellipse de proximité centrée sur le mannequin, x = `pieces.json → images[clé].pos[0]`, y = 0,50 H, demi-axes 0,17 W × 0,47 H, bord adouci.
3. **Combinaison** : `0,45 · netteté · porte + 0,40 · vertical + 0,55 · ellipse`, où « porte » (ellipse élargie + sol) évite que le grain net du fond remonte.
4. **Lissage** gaussien σ = 11 px puis normalisation 1ᵉʳ–99,5ᵉ percentile → 0–255.

Les réglages sont dans le dictionnaire `P` en tête du script (poids, rayons, sigmas) et se surchargent en ligne de commande : `python3 make_depth.py w_ell=0.7 final_sigma=12`. Résultat typique : fond en haut ≈ 8/255, sujet ≈ 255, sol en bas ≈ 120.

## Vérification

`demo/depth.html` affiche pour chaque image le rendu, la carte et une superposition (mode « screen »). Une carte crédible : sujet clair, sol un peu clair en bas, fond sombre, transitions douces sans halos durs (Photo3D déplace les pixels selon la carte ; un bord dur donne un déchirement, une imprécision douce passe inaperçue).

## Remplacer par de meilleures cartes

Conserver exactement les mêmes noms de fichiers, le même format (PNG gris 768 × 512) et la convention **blanc = proche**. Pour des cartes issues d'un modèle (Depth Anything, MiDaS, Marigold…) :

- inverser si le modèle sort « noir = proche » (`255 − v`) ;
- redimensionner en 768 × 512 (Lanczos) et lisser légèrement (σ ≈ 2–4 px) pour éviter le bruit ;
- normaliser en percentiles (1–99,5) pour utiliser toute la dynamique ;
- déposer les fichiers dans `assets/depth/` puis ouvrir `demo/depth.html` et `demo/photo3d.html` pour contrôler.

Aucune autre partie du site ne dépend du contenu des cartes ; seul le chemin compte.

## Script `make_depth.py` (à placer dans `assets/depth/` pour régénérer)

```python
#!/usr/bin/env python3
"""Cartes de profondeur heuristiques pour les 9 rendus AJ.
Sortie : assets/depth/<nom>.png, 768x512, L, blanc = proche, noir = loin.
Voir assets/depth/README.md pour la methode."""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # racine du site si le script est dans assets/depth/
W, H = 768, 512
NAMES = ['01-bleu-ouvert','02-bleu-dos','03-bleu-ferme','04-ecru-face','05-ecru-dos',
         '06-indigo-face','07-indigo-dos','08-indigo-duo','09-ecru-porte']

# ---- reglages (modifiables) ----
P = dict(
    sharp_sigma=10.0,     # lissage de la carte de nettete (px)
    sharp_pct=97.0,       # percentile de normalisation de la nettete
    w_sharp=0.45,         # poids nettete
    w_vert=0.40,          # poids degrade vertical (sol proche en bas)
    w_ell=0.55,           # poids ellipse de proximite (mannequin)
    ell_rx=0.17,          # demi-largeur ellipse (fraction de W)
    ell_ry=0.47,          # demi-hauteur ellipse (fraction de H)
    ell_cy=0.50,          # centre vertical ellipse (fraction de H)
    ell_soft=2.2,         # douceur du bord (exposant)
    final_sigma=11.0,      # flou gaussien final (px)
    lo_pct=1.0, hi_pct=99.5,  # normalisation finale
)
P.update({k: float(v) for k, v in (a.split('=') for a in sys.argv[1:])})

data = json.load(open(f'{ROOT}/assets/data/pieces.json'))
POS = {k: v['pos'] for k, v in data['images'].items()}

def sharpness(gray):
    g = ndi.gaussian_filter(gray, 1.0)
    lap = np.abs(ndi.laplace(g))
    s = ndi.gaussian_filter(lap, P['sharp_sigma'])
    hi = np.percentile(s, P['sharp_pct']) + 1e-6
    return np.clip(s / hi, 0, 1)

def priors(cx):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    vert = (yy / (H - 1)) ** 1.3                      # 0 en haut (loin) -> 1 en bas (proche)
    dx = (xx / W - cx) / P['ell_rx']
    dy = (yy / H - P['ell_cy']) / P['ell_ry']
    r = np.sqrt(dx * dx + dy * dy)
    ell = np.clip(1 - r, 0, 1) ** (1 / P['ell_soft'])   # 1 au centre, 0 hors ellipse
    ell = ndi.gaussian_filter(ell, 12)
    return vert, ell

def make(name):
    key = name[:2]
    im = Image.open(f'{ROOT}/assets/img/{name}-1536.jpg').convert('L').resize((W, H), Image.LANCZOS)
    gray = np.asarray(im, dtype=np.float32) / 255.0
    s = sharpness(gray)
    vert, ell = priors(POS[key][0])
    # la nettete compte surtout la ou le sujet peut etre (ellipse elargie) ou au sol
    gate = np.clip(ell * 1.6 + vert * 0.6, 0, 1)
    d = P['w_sharp'] * s * gate + P['w_vert'] * vert + P['w_ell'] * ell
    d = ndi.gaussian_filter(d, P['final_sigma'])
    lo, hi = np.percentile(d, P['lo_pct']), np.percentile(d, P['hi_pct'])
    d = np.clip((d - lo) / (hi - lo + 1e-6), 0, 1)
    out = Image.fromarray((d * 255).round().astype(np.uint8), 'L')
    out.save(f'{ROOT}/assets/depth/{name}.png', optimize=True)
    return d.mean()

for n in NAMES:
    print(n, 'mean=%.2f' % make(n))
```
