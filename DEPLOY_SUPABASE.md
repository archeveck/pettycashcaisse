# Guide de Déploiement Local de Supabase

Ce guide vous explique comment déployer l'instance Supabase sur votre serveur local et connecter votre application Caisse PettyCash.

## Prérequis sur le Serveur

1.  **Docker** et **Docker Compose** doivent être installés.
    - [Installer Docker Desktop sur Mac/Windows](https://www.docker.com/products/docker-desktop)
    - [Installer Docker Engine sur Linux](https://docs.docker.com/engine/install/)

## Étape 1 : Préparation de la Configuration

1.  Copiez le dossier `supabase` généré à la racine de ce projet vers votre serveur (si ce n'est pas le même ordinateur).
2.  Ouvrez le fichier `supabase/.env` sur le serveur.
3.  **IMPORTANT** : Remplacez `localhost` par l'adresse IP de votre serveur pour que l'API soit accessible depuis d'autres machines du réseau.

    Modifiez les lignes suivantes :

    ```dotenv
    # Remplacez 192.168.x.x par l'adresse IP réelle de votre serveur
    SUPABASE_PUBLIC_URL=http://192.168.x.x:8000
    API_EXTERNAL_URL=http://192.168.x.x:8000

    # Pour le lien du Studio (Dashboard)
    SITE_URL=http://192.168.x.x:3000
    ```

## Étape 2 : Lancement des Services

Dans votre terminal, naviguez vers le dossier `supabase` et lancez :

```bash
cd supabase
docker-compose up -d
```

- L'option `-d` lance les conteneurs en tâche de fond (détaché).
- La première fois, cela peut prendre quelques minutes pour télécharger les images Docker.

### Vérification

Assurez-vous que tous les conteneurs sont "Up" (en cours d'exécution) :

```bash
docker-compose ps
```

## Étape 3 : Accéder au Dashboard (Supabase Studio)

Ouvrez votre navigateur et allez à l'adresse :
`http://<IP_DU_SERVEUR>:3000` (ex: `http://192.168.1.50:3000`)

- **Projet** : `default`
- **Organisation** : `supabase`

## Étape 4 : Configuration de l'Application Electron

Une fois votre serveur Supabase en ligne, vous devez connecter votre application Caisse PettyCash.

1.  Ouvrez le fichier `.env` à la racine du projet `caissePettycash`.
2.  Mettez à jour les variables avec l'adresse de votre serveur :

```dotenv
# Dans le fichier .env du projet (pas celui dans supabase/)

# URL de l'API (Port 8000 par défaut via Kong)
VITE_SUPABASE_URL=http://192.168.x.x:8000

# Clé Anonyme (ANON_KEY)
# Copiez la clé "ANON_KEY" qui se trouve dans supabase/.env
VITE_SUPABASE_ANON_KEY=votre_cle_copiee_depuis_supabase_env
```

## Résolution de problèmes courants

- **Conflit de ports** : Si le port 5432 (Postgres) ou 8000 (API) est déjà utilisé, modifiez les ports dans `docker-compose.yml` et `.env`.
- **Base de données non initialisée** : Le fichier `supabase_schema.sql` est monté automatiquement. S'il ne se charge pas, vous pouvez le copier/coller dans l'éditeur SQL du Supabase Studio (`http://<IP>:3000/project/default/sql`).
- **Accès réseau** : Vérifiez que le pare-feu du serveur autorise les connexions entrantes sur les ports 8000 (API) et 3000 (Studio).
