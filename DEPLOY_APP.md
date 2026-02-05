# Guide de Déploiement de l'Application (Paquetage)

Ce guide explique comment générer les installateurs (.exe, .dmg) pour distribuer votre application Caisse PettyCash aux utilisateurs.

## Étape 1 : Configuration de la Production

Avant de construire l'application, vous **DEVEZ** configurer le fichier `.env` avec les valeurs de votre serveur de production/local, car ces valeurs seront "cuit" (intéqrées) dans le code de l'application.

1.  Ouvrez le fichier `.env` à la racine du projet.
2.  Assurez-vous que l'URL pointe vers votre serveur accessible (pas `localhost` si l'app est sur un autre PC).

Exemple pour une utilisation en réseau local :
```dotenv
VITE_SUPABASE_URL=http://192.168.1.50:8000
VITE_SUPABASE_ANON_KEY=votre_cle_anon_key
```

## Étape 2 : Générer l'Installateur

Ouvrez un terminal dans le dossier du projet et lancez la commande correspondant à votre système cible.

### Pour Windows
```bash
npm run build:win
```
Cela générera un fichier `.exe`.

### Pour macOS
```bash
npm run build:mac
```
Cela générera un fichier `.dmg`.

### Pour Linux
```bash
npm run build:linux
```

## Étape 3 : Récupérer l'Installateur

Une fois la commande terminée (cela peut prendre quelques minutes), les fichiers d'installation se trouveront dans le dossier :

`dist/`

Vous y trouverez des fichiers comme :
-   `caisse-pettycash-1.0.0-setup.exe` (Windows)
-   `caisse-pettycash-1.0.0.dmg` (Mac)

Vous pouvez copier ce fichier sur une clé USB ou le mettre sur un partage réseau pour l'installer sur les postes des caissiers/utilisateurs.

## Note Importante sur les Mises à Jour

Si vous changez l'adresse IP du serveur Supabase, vous devrez :
1.  Modifier le fichier `.env`.
2.  Re-générer l'installateur (`npm run build:...`).
3.  Réinstaller l'application sur les postes clients.
