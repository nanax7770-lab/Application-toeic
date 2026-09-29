# TOEIC 990

Application web pour préparer le TOEIC : flashcards à répétition espacée, 825 mots et expressions
du vocabulaire professionnel, audio US / UK / AU, suivi de la progression. Installable sur iPhone
et utilisable hors ligne. Aucune inscription, aucun serveur : la progression reste sur l'appareil.

## Lancer l'application sur l'ordinateur

L'application doit être ouverte via un petit serveur local (un simple double-clic sur
`index.html` ne suffit pas, le navigateur bloque le chargement du vocabulaire).

1. Ouvrez l'app **Terminal** (Cmd + Espace, tapez « Terminal »).
2. Collez cette commande puis appuyez sur Entrée :

   ```
   cd ~/Desktop/"Application toeic" && python3 -m http.server 8080
   ```

3. Ouvrez **http://localhost:8080** dans votre navigateur.
4. Pour arrêter : revenez dans le Terminal et appuyez sur Ctrl + C.

## Organisation des fichiers

| Dossier / fichier | Rôle |
|---|---|
| `index.html` | La page de l'application |
| `css/style.css` | Le design (mode clair et sombre automatiques) |
| `js/` | Le fonctionnement (un fichier par partie) |
| `js/srs.js` | L'algorithme de répétition espacée (type SM-2, comme Anki) |
| `data/vocab/` | **Tout le vocabulaire**, un fichier JSON par paquet |
| `data/COMMENT-AJOUTER-DU-CONTENU.md` | Le guide pour ajouter des mots |
| `sw.js` | Le mode hors ligne |
| `manifest.json`, `icons/` | L'installation sur téléphone |

## Mettre à jour la version en ligne

Après une modification, augmentez le numéro `VERSION` en haut de `sw.js`
(par exemple `toeic990-v2`), puis publiez avec GitHub Desktop (« Commit » puis « Push origin »).
Sur le téléphone, la nouvelle version s'affiche à la deuxième ouverture de l'app.
