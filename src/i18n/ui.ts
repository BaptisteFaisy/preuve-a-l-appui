/**
 * Messages localisés des écrans de l'app (SPEC §16, §20, lot L6).
 *
 * Tous les libellés de la matrice, du champ de couverture, des réglages projet
 * et de la page projet vivent ici, traduits en anglais (en) et en français (fr).
 * Zéro chaîne visible en dur dans les composants UI ni les view-models : tout
 * passe par `translate()`/`text()` (src/i18n/index.ts, fichier gelé).
 *
 * Format compact (une clé par ligne) pour rester sous la limite de 500 lignes.
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Messages } from './index.js';

export const UI_MESSAGES: Messages = {
  // Générique
  'ui.app.title': { en: 'Proof at hand', fr: 'Fait, preuve à l’appui' },
  'ui.common.loading': { en: 'Loading proofs…', fr: 'Chargement des preuves…' },
  'ui.common.error': { en: 'An error occurred: {error}', fr: 'Une erreur est survenue : {error}' },
  'ui.common.refresh': { en: 'Refresh', fr: 'Actualiser' },
  'ui.common.unknown': { en: 'Unknown', fr: 'Inconnu' },
  'ui.common.none': { en: 'None', fr: 'Aucun' },
  'ui.common.yes': { en: 'Yes', fr: 'Oui' },
  'ui.common.no': { en: 'No', fr: 'Non' },
  'ui.common.save': { en: 'Save', fr: 'Enregistrer' },
  'ui.common.cancel': { en: 'Cancel', fr: 'Annuler' },
  'ui.common.success': { en: 'Operation completed successfully.', fr: 'Opération effectuée avec succès.' },

  // 1. Matrice (SPEC §16.1)
  'ui.matrix.title': { en: 'Acceptance Criteria & Proofs', fr: 'Critères d’acceptation et preuves' },
  'ui.matrix.coverageSummary': { en: '{proven} of {total} criteria proven', fr: '{proven} sur {total} critères prouvés' },
  'ui.matrix.waivedCount': { en: '({waived} waived)', fr: '({waived} dérogés)' },
  'ui.matrix.empty': { en: 'No acceptance criteria defined for this issue.', fr: 'Aucun critère d’acceptation défini pour ce ticket.' },
  'ui.matrix.col.code': { en: 'Code', fr: 'Code' },
  'ui.matrix.col.criterion': { en: 'Criterion', fr: 'Critère' },
  'ui.matrix.col.type': { en: 'Type', fr: 'Type' },
  'ui.matrix.col.required': { en: 'Required', fr: 'Requis' },
  'ui.matrix.col.evidences': { en: 'Evidences', fr: 'Preuves' },
  'ui.matrix.col.status': { en: 'Status', fr: 'État' },
  'ui.matrix.col.actions': { en: 'Actions', fr: 'Actions' },

  // Actions de la matrice
  'ui.matrix.action.attach': { en: 'Attach', fr: 'Attacher' },
  'ui.matrix.action.attest': { en: 'I verified', fr: 'J’ai vérifié' },
  'ui.matrix.action.requestAttestation': { en: 'Request attestation', fr: 'Demander une attestation' },
  'ui.matrix.action.waive': { en: 'Waive', fr: 'Déroger' },
  'ui.matrix.action.history': { en: 'History', fr: 'Historique' },
  'ui.matrix.action.hideHistory': { en: 'Hide history', fr: 'Masquer l’historique' },
  'ui.matrix.action.reconfirm': { en: 'Reconfirm', fr: 'Reconfirmer' },

  // Statuts de critères
  'ui.matrix.status.proven': { en: 'Proven', fr: 'Prouvé' },
  'ui.matrix.status.waived': { en: 'Waived', fr: 'Dérogé' },
  'ui.matrix.status.missing': { en: 'Missing proof', fr: 'Preuve manquante' },
  'ui.matrix.status.toReconfirm': { en: 'To reconfirm', fr: 'À reconfirmer' },

  // Dialogues / formulaires de la matrice
  'ui.matrix.form.evidenceType': { en: 'Evidence type', fr: 'Type de preuve' },
  'ui.matrix.form.reference': { en: 'Reference (URL, test, attachment)', fr: 'Référence (URL, test, pièce jointe)' },
  'ui.matrix.form.note': { en: 'Note (optional)', fr: 'Note (optionnelle)' },
  'ui.matrix.form.waiverReason': { en: 'Waiver justification', fr: 'Motif de la dérogation' },
  'ui.matrix.form.requestTarget': { en: 'Role or what to check', fr: 'Rôle ou point à vérifier' },
  'ui.matrix.form.attestationNote': { en: 'Observation notes', fr: 'Notes de vérification' },
  'ui.matrix.form.historyTitle': { en: 'Revisions of {code}', fr: 'Historique des versions de {code}' },
  'ui.matrix.form.versionLabel': { en: 'v{version} by {author} at {date}', fr: 'v{version} par {author} le {date}' },

  // 2. Champ de couverture (SPEC §16.2, §12.3)
  'ui.coverage.label': { en: 'Proofs {proven} / {total}', fr: 'Preuves {proven} / {total}' },
  'ui.coverage.tooltip': { en: '{proven} of {total} criteria proven ({status})', fr: '{proven} sur {total} critères prouvés ({status})' },
  'ui.coverage.passes': { en: 'Gate passes', fr: 'Critères satisfaits' },
  'ui.coverage.blocks': { en: 'Gate blocks transition', fr: 'Bloque la transition' },
  'ui.coverage.empty': { en: '0 / 0', fr: '0 / 0' },

  // 3. Réglages du projet (SPEC §16.3, §9.2, §10)
  'ui.settings.title': { en: 'Proof Settings', fr: 'Réglages des preuves' },
  'ui.settings.description': { en: 'Configure requirement grid, roles, gate severity, and CI integration for this project.', fr: 'Configurez la grille d’exigences, les rôles, la sévérité du validateur et l’intégration CI.' },
  'ui.settings.section.requirements': { en: 'Requirements per criterion type', fr: 'Exigences par type de critère' },
  'ui.settings.section.roles': { en: 'Authorized roles', fr: 'Rôles autorisés' },
  'ui.settings.section.gateMode': { en: 'Workflow gate mode', fr: 'Mode du validateur de flux' },
  'ui.settings.section.missingCriteria': { en: 'Policy for issues without criteria', fr: 'Politique pour les tickets sans critère' },
  'ui.settings.section.ci': { en: 'Continuous Integration (CI) configuration', fr: 'Configuration de l’intégration continue (CI)' },
  'ui.settings.mode.strict': { en: 'Strict — block Done transition without complete proofs or waivers', fr: 'Strict — bloque le passage à Terminé sans preuve complète ou dérogation' },
  'ui.settings.mode.lenient': { en: 'Lenient — allows minor criteria to pass unproven (flagged)', fr: 'Souple — laisse passer les critères mineurs non prouvés (signalés)' },
  'ui.settings.mode.observe': { en: 'Observe — never block, audit and measure what would have blocked', fr: 'Observation — ne bloque jamais, mesure ce qui aurait été bloqué' },
  'ui.settings.mode.short.strict': { en: 'Strict', fr: 'Strict' },
  'ui.settings.mode.short.lenient': { en: 'Lenient', fr: 'Souple' },
  'ui.settings.mode.short.observe': { en: 'Observe', fr: 'Observation' },
  'ui.settings.missing.block': { en: 'Block transition if no criteria exist', fr: 'Bloquer la transition si le ticket n’a aucun critère' },
  'ui.settings.missing.suggest': { en: 'Suggest drafting criteria without blocking', fr: 'Suggérer la rédaction de critères sans bloquer' },
  'ui.settings.roles.attest': { en: 'Roles allowed to attest', fr: 'Rôles autorisés à attester' },
  'ui.settings.roles.waive': { en: 'Roles allowed to waive', fr: 'Rôles autorisés à déroger' },
  'ui.settings.roles.security': { en: 'Security reviewer roles', fr: 'Rôles de revue de sécurité' },
  'ui.settings.roles.data': { en: 'Data lead roles', fr: 'Rôles référents données' },
  'ui.settings.col.accepted': { en: 'Accepted strengths', fr: 'Forces acceptées' },
  'ui.settings.col.attesterRole': { en: 'Attester role', fr: 'Rôle attesteur' },
  'ui.settings.col.minor': { en: 'Minor', fr: 'Mineur' },
  'ui.settings.col.constraints': { en: 'Constraints', fr: 'Contraintes' },
  'ui.settings.constraint.notAuthor': { en: 'Not the author', fr: 'Pas l’auteur' },
  'ui.settings.constraint.measurementLink': { en: 'Measurement link', fr: 'Lien de mesure' },
  'ui.settings.ci.commandTitle': { en: 'CI command to copy into your pipeline', fr: 'Commande CI à copier dans votre pipeline' },
  'ui.settings.ci.keyTitle': { en: 'Project CI key', fr: 'Clé CI du projet' },
  'ui.settings.ci.keyHelp': { en: 'Store this key securely as a secret (e.g. PROOF_CI_KEY) in your CI provider.', fr: 'Conservez cette clé comme un secret (ex. PROOF_CI_KEY) dans votre outil de CI.' },
  'ui.settings.ci.copied': { en: 'Copied to clipboard!', fr: 'Copié dans le presse-papier !' },
  'ui.settings.ci.copy': { en: 'Copy command', fr: 'Copier la commande' },

  // 4. Page projet (SPEC §16.4, §13, §14)
  'ui.project.title': { en: 'Project Proofs & Quality Health', fr: 'Preuves du projet et santé qualité' },
  'ui.project.tabs.issues': { en: 'In-progress issues', fr: 'Tickets en cours' },
  'ui.project.tabs.waivers': { en: 'Active waivers', fr: 'Dérogations actives' },
  'ui.project.tabs.living': { en: 'Unproven delivered criteria', fr: 'Critères livrés non prouvés' },
  'ui.project.tabs.stats': { en: 'Statistics', fr: 'Statistiques' },
  'ui.project.issues.empty': { en: 'No in-progress issues tracked.', fr: 'Aucun ticket en cours suivi.' },
  'ui.project.waivers.empty': { en: 'No active waivers in this project.', fr: 'Aucune dérogation active sur ce projet.' },
  'ui.project.living.empty': { en: 'All delivered criteria remain proven! Living proof is healthy.', fr: 'Tous les critères livrés restent prouvés ! La preuve vivante est saine.' },
  'ui.project.living.warning': { en: 'The following criteria were delivered but their proof is no longer verified in CI.', fr: 'Les critères suivants ont été livrés mais leur preuve n’est plus vérifiée en CI.' },
  'ui.project.living.alertTitle': { en: 'Delivered criteria no longer proven', fr: 'Critères livrés qui ne sont plus prouvés' },
  'ui.project.stats.byStrength': { en: 'Proofs by strength', fr: 'Preuves par niveau de force' },
  'ui.project.stats.waiversByGranter': { en: 'Waivers granted by person', fr: 'Dérogations accordées par personne' },
  'ui.project.stats.closedWithoutValidator': { en: 'Issues closed outside validator', fr: 'Tickets clos hors validateur' },
  'ui.project.stats.reopeningRate': { en: 'Reopening rates by proof strength', fr: 'Taux de réouverture selon la force des preuves' },
  'ui.project.col.issue': { en: 'Issue', fr: 'Ticket' },
  'ui.project.col.coverage': { en: 'Coverage', fr: 'Couverture' },
  'ui.project.col.gate': { en: 'Gate', fr: 'Validateur' },
  'ui.project.col.criterion': { en: 'Criterion', fr: 'Critère' },
  'ui.project.col.grantedBy': { en: 'Granted by', fr: 'Accordée par' },
  'ui.project.col.reason': { en: 'Reason', fr: 'Motif' },
  'ui.project.col.date': { en: 'Date', fr: 'Date' },
  'ui.project.col.testName': { en: 'Test', fr: 'Test' },
  'ui.project.col.component': { en: 'Component', fr: 'Composant' },
  'ui.project.col.since': { en: 'Since', fr: 'Depuis' },

  // Notifications (demande d'attestation, SPEC §9.4, FP-15)
  'ui.notify.attestation.subject': { en: 'Attestation requested', fr: 'Attestation demandée' },
  'ui.notify.attestation.body': { en: 'Your verification is requested on one acceptance criterion.', fr: 'Votre vérification est demandée sur un critère d’acceptation.' },

  // Vocabulaire du domaine : forces, types, fraîcheur, défauts
  'strength.machine-verified': { en: 'Machine-verified', fr: 'Vérifié par machine' },
  'strength.attested': { en: 'Attested', fr: 'Attesté' },
  'strength.declared': { en: 'Declared', fr: 'Déclaré' },
  'criterion.type.functional': { en: 'Functional', fr: 'Fonctionnel' },
  'criterion.type.regression': { en: 'Regression', fr: 'Non-régression' },
  'criterion.type.performance': { en: 'Performance', fr: 'Performance' },
  'criterion.type.security': { en: 'Security', fr: 'Sécurité' },
  'criterion.type.accessibility': { en: 'Accessibility', fr: 'Accessibilité' },
  'criterion.type.data': { en: 'Data & migration', fr: 'Données & migration' },
  'criterion.type.documentation': { en: 'Documentation', fr: 'Documentation' },
  'evidence.type.test': { en: 'Automated test', fr: 'Test automatisé' },
  'evidence.type.documentation': { en: 'Documentation page', fr: 'Page de documentation' },
  'evidence.type.attestation': { en: 'Human attestation', fr: 'Attestation humaine' },
  'evidence.type.attachment': { en: 'Attachment', fr: 'Pièce jointe' },
  'evidence.type.agent-report': { en: 'Agent report', fr: 'Compte rendu d’agent' },
  'evidence.type.link': { en: 'External link', fr: 'Lien externe' },
  'freshness.fresh': { en: 'Fresh', fr: 'Frais' },
  'freshness.to-reconfirm': { en: 'To reconfirm', fr: 'À reconfirmer' },
  'freshness.stale': { en: 'Stale', fr: 'Périmé' },
  'defect.no-evidence': { en: 'No evidence provided', fr: 'Aucune preuve fournie' },
  'defect.weak-strength': { en: 'Evidence strength insufficient', fr: 'Force de preuve insuffisante' },
  'defect.not-fresh': { en: 'Evidence requires reconfirmation', fr: 'Preuve à reconfirmer' },
  'defect.not-independent': { en: 'Attestation not independent', fr: 'Attestation non indépendante' },
  'defect.unverified': { en: 'Evidence could not be verified', fr: 'Preuve non vérifiée' },
  'defect.no-criteria': { en: 'No acceptance criteria defined', fr: 'Aucun critère d’acceptation' },

  /* Gestes du panneau : refus motivés (SPEC §9.4, §12.4, §20). */
  'ui.gesture.unknownCriterion': { en: 'Unknown criterion.', fr: 'Critère inconnu.' },
  'ui.gesture.unknownIssue': { en: 'Ticket not found: independence cannot be verified.', fr: 'Ticket introuvable : l’indépendance ne peut pas être vérifiée.' },
  'ui.waiver.refusedAgent': { en: 'An agent can never grant a waiver.', fr: 'Un agent ne peut jamais accorder de dérogation.' },
  'ui.waiver.refusedCriterion': { en: 'A waiver applies to one criterion: select it.', fr: 'Une dérogation vise un critère : sélectionnez-le.' },
  'ui.waiver.reasonRequired': { en: 'A waiver requires a reason.', fr: 'Une dérogation exige un motif.' },
  'ui.waiver.roleRequired': { en: 'Your role does not allow granting waivers on this project.', fr: 'Votre rôle ne permet pas d’accorder de dérogation sur ce projet.' },
  'ui.waiver.refused': { en: 'Waiver refused: {reason}', fr: 'Dérogation refusée : {reason}' },
};
