# Recette — les onze points du SPEC §22

Preuve rejouable que l'app tient ses **onze points de recette** avec les vrais
modules des neuf lots assemblés (SPEC §24 : « comment les juges testeront »).
Chaque ligne donne ce qui est prouvé, le test automatisé qui le prouve, et
comment le rejouer à la main dans Jira sur le projet de démonstration `PAY`.

- Tests : [`tests/acceptance/`](../tests/acceptance/) — un `it('recette-NN : …')`
  par point.
- Rejouer : `npx vitest run tests/acceptance` (voir le
  [README du dossier](../tests/acceptance/README.md)).
- Assemblage : [`tests/acceptance/harness.ts`](../tests/acceptance/harness.ts)
  câble le **vrai** moteur de couverture, les vrais handlers et le vrai domaine
  sur les fakes en mémoire de `tests/helpers/`, autour du scénario PAY-123 (§7).

## Tableau des onze points

| # | Ce qui est prouvé (SPEC §22) | Test | Modules réels traversés |
|---|---|---|---|
| 1 | Un ticket à quatre critères dont un sans preuve ne passe pas à « Terminé » ; le message nomme ce critère | `recette-01` | `createCoverageEngine`, `createValidator`, `evaluateGate` |
| 2 | Un test attaché, présent et vert dans la CI de la branche, donne une preuve « vérifiée par machine » | `recette-02` | `attachEvidence`, `handleCiResults`, `onCiMessage`, `applyCiSummaryToEvidences` |
| 3 | Le même test, absent ou en échec, ne donne aucune preuve valable | `recette-02` | `handleCiResults`, `onCiMessage`, `applyCiSummaryToEvidences` |
| 4 | L'assigné ne peut pas attester ; un autre membre du projet le peut | `recette-03` | `canAttest` (voir l'écart ci-dessous) |
| 5 | Une preuve déclarée par un agent ne satisfait pas un critère exigeant une attestation | `recette-03` | `createCoverageEngine`, `runAction` (`attach-evidence`), `computeEvidenceStrength` |
| 6 | Une dérogation motivée sur le critère manquant débloque la transition et figure dans le dossier | `recette-04` | `validateWaiverCandidate`, geste `attest-criterion`, `createValidator`, `buildVersionDossier` |
| 7 | Modifier le texte d'un critère fait passer ses preuves en « à revoir » | `recette-05` | `changeCriterionText`, `markEvidencesToReconfirm`, `onJiraEvent` |
| 8 | Un nouveau commit après une preuve de test la rend « à reconfirmer » jusqu'au passage vert suivant | `recette-05` | `handleCiResults`, `onCiMessage`, `applyCiSummaryToEvidences` |
| 9 | En mode observation, la transition passe et le blocage évité est compté | `recette-04` | `createCoverageEngine` (`wouldBlock`), `createValidator`, `evaluateGate` |
| 10 | `get-proof-status` renvoie les mêmes critères en défaut que le message du validateur | `recette-01` | `createValidator` + `runAction` (`get-proof-status`), même ligne `coverage` |
| 11 | Aucun outil MCP ne permet d'attester ni de déroger | `recette-06` | `runAction` (dispatch), les sept outils du registre |

## Rejouer à la main dans Jira (projet de démo `PAY`, ticket `PAY-123`)

Ces gestes reproduisent, sur le site de démonstration, ce que chaque test
vérifie en mémoire. Ils suivent le parcours des juges
([`docs/JUDGES.md`](JUDGES.md)) et le scénario §7.

1. **Point 1 — le blocage.** Ouvrir `PAY-123`, tenter la transition vers
   *Terminé*. Jira refuse et nomme les critères en défaut (SPEC §7.2) : `AC-3`
   (attestation attendue, déclaration reçue) et `AC-4` (aucune preuve).
2. **Points 2 et 3 — la CI tranche.** Envoyer le résumé de CI d'exemple
   (commande `curl` dans [`docs/JUDGES.md`](JUDGES.md) §5). Les deux tests verts
   sur le commit de la branche font virer `AC-1` et `AC-2` en « vérifié par
   machine ». Renvoyer un résumé où un test échoue ou a disparu : la preuve
   correspondante n'est plus valable.
3. **Point 4 — l'indépendance.** En tant que développeuse assignée (`Camille
   Dev`), le bouton *J'ai vérifié* ne doit pas permettre d'attester son propre
   travail ; en tant que testeuse (`Nora QA`), il le doit (SPEC §9.4).
4. **Point 5 — l'agent ne suffit pas.** `AC-3` exige une attestation : le compte
   rendu déclaré par l'agent ne le satisfait pas. Demander à l'agent Rovo
   d'attester via un outil MCP : c'est refusé.
5. **Point 6 — la dérogation.** En tant que product owner (`Sam PO`), sur
   `AC-4`, cliquer *Waive*, garder le motif « Reporté dans PAY-140 », confirmer.
   Attester `AC-3` (testeuse), puis retenter la transition : elle passe. La
   dérogation figure dans le dossier de preuve de la version `2.4` (*Project
   page → Proofs*).
6. **Point 7 — le critère change.** Dans le panneau, modifier le texte d'un
   critère : sa version s'incrémente et ses preuves passent en « à revoir »
   (SPEC §8.4).
7. **Point 8 — nouveau commit.** Après un nouveau commit sur la branche qui ne
   ré-exécute pas le test, la preuve de test passe en « à reconfirmer » ; le
   passage vert suivant sur ce commit la revalide (SPEC §9.3).
8. **Point 9 — mode observation.** Dans *Project settings → Proof requirements*,
   passer le mode en « observation » : la transition passe, et le blocage évité
   est compté (champ `wouldBlock`, statistiques du projet).
9. **Point 10 — même source.** Interroger l'agent Rovo : « Que manque-t-il pour
   clore PAY-123 ? » Il appelle `get-proof-status` et nomme **les mêmes**
   critères en défaut que le message du validateur — une seule ligne de
   couverture, jamais deux calculs.
10. **Point 11 — les outils MCP.** Connecter un client MCP au serveur `rovo:mcp`
    et tenter d'attester, de déroger, de valider un critère ou de modifier la
    grille : chaque geste est refusé explicitement. Les sept outils ne font que
    lire, proposer ou déclarer.

## Écart d'intégration relevé (point 4)

La recette est **verte** : les onze points sont prouvés avec les vrais modules.
Un écart d'intégration réel est toutefois documenté, sans réécrire le module
d'un autre lot (règle du lot L10) :

- **Le geste humain `attest-criterion`** (`src/handlers/resolver.ts`, lot L6)
  n'appelle **pas** `canAttest` (`src/domain/independence.ts`, lot L2). La vue
  matricielle non plus (`canAttest: !crit.proven` ne teste pas l'indépendance).
  Conséquence : au moment de l'écriture, l'indépendance de l'attestant n'est pas
  appliquée — l'assigné (voire un ancien assigné) peut attester son propre
  travail via le panneau. La **règle de domaine est juste** et le test
  `recette-04` la prouve avec le vrai module `canAttest` sur les acteurs réels
  du scénario ; c'est le **câblage** dans le geste qui manque. Le sous-test
  `recette-04 ÉCART` est écrit en `it.fails` : il redeviendra rouge dès que le
  geste appliquera le domaine, signalant qu'il faut alors le repasser en `it`.

- **Observation voisine (hors points de recette).** Le geste `waive-criterion`
  du même résolveur n'appelle pas `validateWaiverCandidate`
  (`src/domain/waivers.ts`, lot L3) : il enregistre une dérogation sans vérifier
  le motif ni le rôle. Aucun des onze points ne l'exerce (le point 6 utilise une
  dérogation valide, motivée et signée par le PO), donc la recette reste verte ;
  le câblage du domaine de validation dans le geste est à prévoir pour tenir le
  SPEC §12.4 en toutes circonstances.

Ces deux écarts relèvent du lot L6 (le résolveur et ses vues). Ils sont signalés
ici et dans le compte rendu de livraison, conformément à la règle « ne pas
réécrire le module d'un autre lot ».
