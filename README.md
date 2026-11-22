# StSo · Planning équipes

Application web de planning interne : consultation publique des fiches catering/bar et administration protégée.

## Ce qui est inclus
- Page équipes : tableau de la semaine en cours, semaine suivante en retrait, agenda mensuel.
- Clic sur un événement : fiche complète catering + bar/loges.
- Page `/admin` : connexion, création, modification et suppression de tous les événements à venir.
- Base Supabase partagée entre les téléphones et ordinateurs.

## Mise en service (gratuite avec les offres gratuites disponibles)

### 1. Créer la base Supabase
1. Crée un projet sur https://supabase.com/.
2. Dans **SQL Editor**, colle et exécute le contenu de `supabase/schema.sql`.
3. Dans **Project Settings > API**, récupère l'URL du projet et la clé `anon` / publishable. Ne prends jamais la `service_role` key.

### 2. Créer ton compte administrateur
1. Dans Supabase, ouvre **Authentication > Users** et crée ton utilisateur avec ton adresse e-mail et un mot de passe.
2. Copie son **User UID**.
3. Dans SQL Editor, exécute cette requête en remplaçant l'UUID :
   ```sql
   insert into public.admins (user_id) values ('TON-USER-UUID');
   ```
4. Dans **Authentication > Settings**, désactive les inscriptions publiques si l'option est disponible. Le compte admin est créé depuis le tableau de bord Supabase, pas depuis le site.
5. L'accès admin se fait sur `https://ton-site.vercel.app/admin`.

### 3. Lancer en local
Installe Node.js (version LTS), puis dans le dossier du projet :
```bash
npm install
cp .env.example .env
```
Renseigne `.env` :
```env
VITE_SUPABASE_URL=https://TON-PROJET.supabase.co
VITE_SUPABASE_ANON_KEY=TA_CLE_ANON_OU_PUBLISHABLE
```
Puis :
```bash
npm run dev
```
Vite affiche l'adresse locale à ouvrir.

### 4. Mettre le site en ligne avec Vercel
1. Dépose le dossier du projet dans un dépôt GitHub privé.
2. Sur https://vercel.com/, importe ce dépôt.
3. Framework preset : **Vite** ; commande de build : `npm run build` ; dossier de sortie : `dist`.
4. Dans **Environment Variables**, ajoute `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` avec les valeurs de Supabase.
5. Déploie. Le site public est à la racine `/`, l'administration à `/admin`.

## Sécurité / confidentialité
- La clé `anon` (ou publishable) est prévue pour être utilisée dans le navigateur. Les règles RLS de `schema.sql` empêchent les visiteurs non-admin de modifier les événements.
- Ne jamais mettre la clé `service_role` dans le site ou dans les variables `VITE_`.
- Les fiches d'événements sont lisibles par toute personne disposant du lien public. Ne pas y mettre de données personnelles ou sensibles.
- Pour ajouter un autre administrateur, crée son utilisateur dans Supabase Authentication puis ajoute son UUID dans `public.admins`.
- Supabase Auth doit autoriser les URL de redirection de ton domaine Vercel si tu ajoutes plus tard des fonctions d'authentification par e-mail.

## Limites de cette première version
- Le calendrier ouvre la première fiche lorsqu'il y a plusieurs événements le même jour.
- La semaine est calculée du lundi au dimanche selon la date locale du navigateur.
- Les données sont sauvegardées dans Supabase uniquement après connexion et configuration.

## Mise à jour — paramètres et fiches groupes

Pour activer la page **Administration > Paramètres**, exécuter une seule fois le fichier `supabase/migration_v2.sql` dans **Supabase > SQL Editor**.

Cette migration ajoute des colonnes JSONB pour les futures fiches de production, les effectifs et les groupes, ainsi qu'une table `app_settings` réservée aux administrateurs. Elle ne supprime ni ne remplace les événements existants.

La page Paramètres permet d'enregistrer le lien du Google Sheet. À ce stade, le lien est stocké dans Supabase, mais l'import automatique des lignes n'est pas encore activé : il faudra connecter le document réel et vérifier ses colonnes et ses droits de partage avant de mettre en place la synchronisation.


## Nouvelle fiche événement (version enrichie)

La fiche d'administration comprend maintenant cinq onglets : Général, Technique / production, Effectifs, Catering et Bar / loges. Les fiches groupes peuvent être saisies manuellement, avec calcul de leur effectif par catégorie. Le total événement additionne les groupes et l'effectif StSo. Le déroulé permet d'ajouter, supprimer et réordonner des lignes.

Les champs supplémentaires sont enregistrés dans les colonnes JSONB `production`, `staffing` et `groups` ajoutées par `supabase/migration_v2.sql`. Si cette migration a déjà été exécutée sur le projet Supabase, il n'y a pas de nouvelle migration à lancer pour cette version.

La connexion et la synchronisation Google Sheets ne sont pas encore actives : le lien enregistré dans Paramètres est conservé, mais les fiches groupes sont pour l'instant créées manuellement.
