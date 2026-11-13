/**
 * Le dépôt Git RÉEL de la démonstration.
 *
 * Une preuve « test » ne vaut que si elle pointe vers un test qui existe.
 * Le catalogue des tickets cite donc des tests réels, dans ce dépôt public :
 * chaque branche porte le fichier de test du ticket, et chaque empreinte est
 * le commit réel qui l'a ajouté. Le rejoueur s'en sert pour les résumés de CI
 * (dépôt, branche, commit), donc la démo pointe vers du vérifiable.
 *
 * Ce fichier est la SEULE source des empreintes : le catalogue ne les
 * réécrit pas.
 *
 * Le dépôt : https://github.com/Tradoooo/preuve-a-l-appui-demo
 * Une branche par ticket, nommée comme dans le catalogue
 * (`feature/PRF-<clé>-<slug>`), plus un alias court `feature/PRF-<clé>` qui
 * pointe sur le même commit. `main` porte les deux états rejoués par la démo :
 * `complete` (tous les tests présents), puis `regressed` (le test de latence
 * de PRF-7 a disparu de la branche principale).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */

/** Le dépôt où vivent les tests cités par les preuves. */
export const DEMO_REPO = 'Tradoooo/preuve-a-l-appui-demo';

/** Le commit réel de chaque ticket : la branche `feature/<clé>` de son test. */
export const DEMO_COMMITS = {
  'PRF-1': 'e5af91baf7e5aa2c56fab12dd8a18c08327ebbbe',
  'PRF-2': 'dc0fe32cdb1f4f0d0b2b4b230427b8f9dfcc5837',
  'PRF-3': 'cb09f370d3da0c29046cc93cef9f2da094d86177',
  'PRF-4': '21f35e4e8311a21ca57464356d97c31ecb775c1f',
  'PRF-5': '75bdee06c90f84310a5e6186f99fae009e611b7e',
  'PRF-6': '24cc0cb88b3b6d66daf2b45457e12deaebe89fea',
  'PRF-7': '3f5f6bd0c179d49111b3b3de50cd7259dca0603d',
  'PRF-8': '485d7f15ebcc2d772e49251269e29e41424da0a4',
  'PRF-9': '05b29a6205483bb3f149105da9cc6ba914f9b9c4',
};

/** Les deux empreintes réelles de `main` : l'état complet, puis l'état régressé. */
export const DEMO_MAIN_COMMITS = {
  complete: 'ab843b19f2edbac2f01a4bd2736052fd28f362eb',
  // Le commit qui retire le test de latence de PRF-7 de `main` : c'est lui la
  // régression. `main` a depuis un commit de documentation, qui ne touche à
  // aucune suite de tests.
  regressed: '3a522b8beb47dbfb6ee2f602c3212e7146201a25',
};
