/**
 * Les 21 fonctionnalités en français (cahier des charges §14, FP-01…FP-21).
 *
 * Le titre et la description reprennent fidèlement l'exigence du document, en
 * la rendant lisible hors contexte. `where` est l'ancre relative de la section
 * du site où la fonctionnalité est visible : la démo (#demo) exécute le vrai
 * moteur, les maquettes (#screens) rendent les vrais écrans, la section
 * #agents montre les outils MCP.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { FeatureEntry } from './features.js';

export const FEATURES_FR: readonly FeatureEntry[] = [
  {
    code: 'FP-01',
    priority: 'M',
    title: 'Critères structurés par ticket',
    description:
      'Chaque ticket porte des critères d’acceptation avec un code stable (AC-1, AC-2…) et un numéro de version : ce qui était exigé, et quand, ne se perd jamais.',
    where: '#demo',
  },
  {
    code: 'FP-02',
    priority: 'M',
    title: 'Import depuis la description',
    description:
      'L’app reconnaît les critères déjà écrits dans la description (cases à cocher, liste « Critères d’acceptation ») et les propose : un humain valide, rien n’est créé tout seul.',
    where: '#demo',
  },
  {
    code: 'FP-03',
    priority: 'M',
    title: 'Six types de preuve',
    description:
      'Test automatisé, documentation, attestation, pièce jointe, rapport d’agent, lien : à chaque type sa force, calculée par l’app et jamais déclarée par celui qui l’attache.',
    where: '#demo',
  },
  {
    code: 'FP-04',
    priority: 'M',
    title: 'Force des preuves et couverture',
    description:
      'La force de chaque preuve est calculée, puis agrégée en une couverture du ticket : c’est cette ligne unique que lisent le validateur, le champ et l’agent.',
    where: '#demo',
  },
  {
    code: 'FP-05',
    priority: 'M',
    title: 'Exigences par type et par projet',
    description:
      'La grille des forces exigées se règle par type de critère et par projet, au-dessus d’un plancher commun : le projet choisit son niveau, l’app ne l’impose pas.',
    where: '#screens',
  },
  {
    code: 'FP-06',
    priority: 'M',
    title: 'Résumé de CI vérifié',
    description:
      'Une ligne en fin de pipeline suffit : l’app vérifie les tests nommés, le commit et la branche, puis met à jour les preuves de type test.',
    where: '#demo',
  },
  {
    code: 'FP-07',
    priority: 'M',
    title: 'Blocage de la transition « Terminé »',
    description:
      'Le validateur de workflow refuse la transition et nomme les critères en défaut, avec la preuve attendue pour chacun.',
    where: '#demo',
  },
  {
    code: 'FP-08',
    priority: 'M',
    title: 'Indépendance de l’attestation',
    description:
      'Ni l’assigné du ticket ni un agent ne peuvent attester : tout ce qui arrive par MCP est marqué « agent » et ne peut que déclarer.',
    where: '#demo',
  },
  {
    code: 'FP-09',
    priority: 'M',
    title: 'Dérogations motivées',
    description:
      'Une dérogation se demande critère par critère, avec un motif obligatoire, un rôle autorisé, une durée et une révocation possible.',
    where: '#demo',
  },
  {
    code: 'FP-10',
    priority: 'M',
    title: 'Matrice critères × preuves',
    description:
      'Le panneau du ticket affiche l’exigence, les preuves, l’état, et seulement les gestes que la personne qui regarde a vraiment le droit de faire.',
    where: '#screens',
  },
  {
    code: 'FP-11',
    priority: 'M',
    title: 'Outils MCP et agent Rovo',
    description:
      'Sept outils MCP et un agent Rovo : l’agent demande ce qui manque, attache ce qu’il a, sollicite un humain pour le reste — jamais il n’atteste.',
    where: '#agents',
  },
  {
    code: 'FP-12',
    priority: 'M',
    title: 'Modes strict, souple, observation',
    description:
      'Strict (on bloque), souple (on laisse passer ce qui est marqué mineur, en le signalant), observation (on mesure sans bloquer) : le déploiement ne casse pas les équipes.',
    where: '#demo',
  },
  {
    code: 'FP-13',
    priority: 'S',
    title: 'Preuves périmées',
    description:
      'Un critère modifié ou un nouveau commit rend les preuves antérieures « à reconfirmer » : les poteaux ne bougent pas en silence.',
    where: '#demo',
  },
  {
    code: 'FP-14',
    priority: 'S',
    title: 'Paires tests ↔ critères',
    description:
      'L’app propose des rapprochements entre tests et critères, avec une confiance et une justification ; un humain confirme ou rejette.',
    where: '#demo',
  },
  {
    code: 'FP-15',
    priority: 'S',
    title: 'Demande d’attestation notifiée',
    description:
      'Quand il manque une attestation, l’app la demande au rôle compétent et notifie la personne : la preuve circule au lieu d’attendre.',
    where: '#demo',
  },
  {
    code: 'FP-16',
    priority: 'S',
    title: 'Champ « Preuves n / m »',
    description:
      'Un champ de ticket coloré, lisible au tableau et utilisable en JQL, écrit depuis la même ligne que lit le validateur.',
    where: '#screens',
  },
  {
    code: 'FP-17',
    priority: 'S',
    title: 'Dossier de preuve d’une version',
    description:
      'Un instantané figé par version : chaque critère, sa preuve, son attestant, son commit, ses dérogations — exportable en Markdown, collable dans Confluence.',
    where: '#demo',
  },
  {
    code: 'FP-18',
    priority: 'S',
    title: 'Statistiques de preuve',
    description:
      'Couverture par force, dérogations par personne, taux de réouverture selon la force des preuves : la qualité des « Terminé » devient mesurable.',
    where: '#screens',
  },
  {
    code: 'FP-19',
    priority: 'C',
    title: 'Preuve vivante après clôture',
    description:
      'Les tests des critères livrés continuent d’être suivis sur la branche principale : un test qui disparaît ou qui échoue remonte comme régression.',
    where: '#screens',
  },
  {
    code: 'FP-20',
    priority: 'C',
    title: 'Preuve avant code',
    description:
      'Le test prévu pour un critère s’enregistre avant que le code existe : l’intention est datée, donc vérifiable, et ses changements sont visibles.',
    where: '#demo',
  },
  {
    code: 'FP-21',
    priority: 'C',
    title: 'Preuve croisée',
    description:
      'Pour les critères critiques, la grille peut exiger plusieurs types de preuve distincts : une seule preuve, même forte, ne suffit pas.',
    where: '#demo',
  },
];
