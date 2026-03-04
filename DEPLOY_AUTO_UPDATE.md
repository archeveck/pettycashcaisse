# Guide de Déploiement avec Mises à Jour Automatiques

Ce guide explique comment déployer votre application Caisse PettyCash avec le système de mises à jour automatiques via GitHub Releases.

## Prérequis

1. Un compte GitHub avec un dépôt pour votre projet
2. Node.js et npm installés
3. Les variables d'environnement configurées dans `.env`

## Configuration Initiale

### 1. Configurer le Dépôt GitHub

Dans `package.json` et `electron-builder.yml`, remplacez `VOTRE-USERNAME` par votre nom d'utilisateur GitHub :

```json
// package.json
"repository": {
  "type": "git",
  "url": "https://github.com/VOTRE-USERNAME/caissePettycash.git"
}
```

```yaml
# electron-builder.yml
publish:
  provider: github
  owner: VOTRE-USERNAME
  repo: caissePettycash
```

### 2. Créer un Token GitHub

Pour publier automatiquement les releases, vous avez besoin d'un token GitHub :

1. Allez sur GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Cliquez sur "Generate new token (classic)"
3. Donnez un nom au token (ex: "Caisse PettyCash Releases")
4. Cochez les permissions : `repo` (accès complet)
5. Générez et copiez le token

### 3. Configurer le Token Localement

Créez une variable d'environnement pour le token :

**macOS/Linux:**
```bash
export GH_TOKEN="votre_token_github"
```

**Windows:**
```cmd
set GH_TOKEN=votre_token_github
```

Pour une configuration permanente, ajoutez-le à votre fichier `.bashrc`, `.zshrc` ou variables d'environnement système.

## Processus de Release

### Étape 1 : Préparer la Nouvelle Version

1. **Mettre à jour le numéro de version** dans `package.json` :

```json
{
  "version": "1.0.1"
}
```

2. **Committer les changements** :

```bash
git add .
git commit -m "Release v1.0.1 - Description des changements"
```

3. **Créer un tag Git** :

```bash
git tag v1.0.1
```

4. **Pousser vers GitHub** :

```bash
git push origin main
git push origin v1.0.1
```

### Étape 2 : Construire et Publier

Exécutez la commande de build qui publiera automatiquement sur GitHub :

**Pour macOS:**
```bash
npm run build:mac
```

**Pour Windows:**
```bash
npm run build:win
```

**Pour Linux:**
```bash
npm run build:linux
```

Electron Builder va :
- Compiler l'application
- Créer les installateurs
- Générer les fichiers de mise à jour (`latest.yml`, `latest-mac.yml`)
- Créer automatiquement une release GitHub
- Uploader tous les fichiers

### Étape 3 : Vérifier la Release

1. Allez sur `https://github.com/VOTRE-USERNAME/caissePettycash/releases`
2. Vérifiez que la release a été créée avec :
   - Les installateurs (`.exe`, `.dmg`, etc.)
   - Les fichiers de mise à jour (`latest.yml`, `latest-mac.yml`)
   - Les notes de version

## Expérience Utilisateur

### Pour les Utilisateurs Existants

1. **Détection automatique** : Au démarrage de l'application (ou toutes les 4 heures), le système vérifie les mises à jour
2. **Notification** : Une notification apparaît en bas à droite si une mise à jour est disponible
3. **Téléchargement** : L'utilisateur clique sur "Télécharger" et voit la progression
4. **Installation** : Une fois téléchargée, l'utilisateur clique sur "Installer et redémarrer"
5. **Redémarrage** : L'application se ferme, s'installe et redémarre automatiquement

### Pour les Nouveaux Utilisateurs

Les nouveaux utilisateurs téléchargent l'installateur depuis la page des releases GitHub et l'installent normalement. Ils recevront ensuite les mises à jour automatiques.

## Notes de Version

Vous pouvez ajouter des notes de version sur GitHub après la publication :

1. Allez sur la page de la release
2. Cliquez sur "Edit release"
3. Ajoutez une description des changements
4. Sauvegardez

Ces notes seront affichées dans la notification de mise à jour.

## Dépannage

### La mise à jour ne se détecte pas

- Vérifiez que les fichiers `latest.yml` sont présents dans la release
- Vérifiez que le numéro de version dans `package.json` est supérieur à la version installée
- Consultez les logs dans `~/Library/Logs/caisse-pettycash/` (macOS) ou `%APPDATA%/caisse-pettycash/logs/` (Windows)

### Erreur lors de la publication

- Vérifiez que le token GitHub (`GH_TOKEN`) est correctement configuré
- Vérifiez que le token a les permissions `repo`
- Vérifiez que le tag Git existe et a été poussé

### L'application ne démarre pas après la mise à jour

- Vérifiez que la configuration `.env` est correcte
- Consultez les logs d'erreur
- Réinstallez manuellement si nécessaire

## Rollback (Retour Arrière)

Si une version pose problème :

1. Supprimez la release problématique sur GitHub
2. Les utilisateurs ne recevront plus cette mise à jour
3. Créez une nouvelle version corrigée avec un numéro supérieur

## Sécurité

- **Ne partagez jamais** votre token GitHub
- Utilisez des secrets GitHub Actions pour l'automatisation (voir section suivante)
- Signez vos applications pour macOS et Windows en production (code signing)

## Prochaines Étapes

Pour automatiser complètement le processus, consultez le fichier `.github/workflows/release.yml` qui sera créé pour automatiser les builds via GitHub Actions.
