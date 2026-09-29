# Comment ajouter du vocabulaire

Tout le vocabulaire se trouve dans le dossier `data/vocab/`, avec **un fichier par paquet**
(`finance.json`, `rh.json`, `phrasal.json`…). Vous pouvez les ouvrir avec n'importe quel éditeur
de texte (TextEdit en mode « texte brut », ou mieux : Visual Studio Code, gratuit).

## Ajouter une carte dans un paquet existant

Chaque carte ressemble à ceci :

```json
{
  "word": "invoice",
  "ipa": "/ˈɪnvɔɪs/",
  "pos": "nom, verbe",
  "fr": "facture ; facturer",
  "def": "A document that lists goods or services provided and the amount the customer must pay.",
  "examples": [
    { "en": "Please find attached the **invoice** for last month’s services.", "fr": "Veuillez trouver ci-joint la facture des services du mois dernier." },
    { "en": "All **invoices** must be paid within 30 days.", "fr": "Toutes les factures doivent être réglées sous 30 jours." }
  ],
  "note": { "type": "tip", "text": "Aussi un verbe : **invoice a client** = facturer un client." }
}
```

- `word` et `fr` sont **obligatoires**, tout le reste est facultatif.
- `ipa` : la prononciation (vous pouvez la copier depuis le dictionnaire Cambridge en ligne).
- `pos` : la nature du mot (nom, verbe, adjectif…).
- `examples` : une ou deux phrases. Entourez le mot de `**` pour qu'il apparaisse **en gras**.
- `note` : `"type": "tip"` pour une astuce (bleue), `"type": "warn"` pour un piège (orange).

Pour ajouter une carte : copiez un bloc `{ ... }` complet, collez-le juste après un autre,
et **n'oubliez pas la virgule** entre deux blocs. Pas de virgule après le dernier bloc de la liste.

## Créer un nouveau paquet

1. Copiez un fichier existant (par exemple `finance.json`) et renommez-le (`immobilier-luxe.json`).
2. En haut du fichier, changez `id` (un mot sans espace ni accent), `name`, `short`
   (nom court affiché sur la carte), `group` (`theme` ou `special`) et `description`.
3. Remplacez les cartes par les vôtres.
4. Ajoutez le nom du fichier dans `data/vocab/index.json`, dans la liste `decks`.

## Vérifier qu'il n'y a pas d'erreur

Une virgule oubliée suffit à empêcher le chargement d'un paquet. Pour vérifier un fichier,
collez son contenu sur un site comme jsonlint.com : il vous indiquera la ligne fautive.

## Votre progression ne sera pas perdue

La progression est liée au mot anglais (`word`) et au paquet. Vous pouvez corriger une traduction
ou un exemple sans rien perdre. Si vous changez l'orthographe du mot anglais lui-même,
la carte sera considérée comme nouvelle.

## Plus simple encore

Dans l'application, l'onglet **Cartes → Ajouter une carte** permet d'ajouter vos propres mots
sans toucher aux fichiers. Ils sont enregistrés sur votre appareil (pensez à exporter votre
progression de temps en temps dans Réglages → Exporter).
