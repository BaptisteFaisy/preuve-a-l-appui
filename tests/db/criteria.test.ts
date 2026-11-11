/**
 * Tests de l'adaptateur SQL `createCriterionStore` (SPEC §8, §18) :
 * requêtes bornées (`WHERE` + `LIMIT`), écritures rejouables (`UPSERT`),
 * intégrité sans `DELETE`, mapping complet des dates et des statuts.
 *
 * Utilise `tests/db/criteria-sql-fake.ts` (mon faux SqlClient local, conforme
 * aux règles de périmètre du lot L1 — voir CONTRACT-CHANGE).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createCriterionStore } from '../../src/db/criteria.js';
import {
  allSelectsBounded,
  allWritesReplayable,
  createFakeSql,
  type FakeSql,
} from './criteria-sql-fake.js';
import { ac1, ac3, ac4, revision } from './fixtures.js';
import { criterionToRow, criterionRevisionToRow } from '../../src/db/mapping-criteria.js';
import type { Criterion } from '../../src/types.js';

let sql: FakeSql;

beforeEach(() => {
  sql = createFakeSql();
});

describe('adaptateur SQL createCriterionStore — invariants (SPEC §18, §20)', () => {
  it('tous les SELECT portent WHERE et LIMIT explicite', async () => {
    const store = createCriterionStore(sql);
    await store.listCriteriaByIssue('10001');
    await store.getCriterion('crit-ac1');
    await store.getCriterionByCode('10001', 'AC-1');
    await store.listCriterionRevisions('crit-ac1');
    await store.nextCriterionCode('10001');

    expect(sql.calls.length).toBe(5);
    expect(allSelectsBounded(sql)).toBe(true);
    const listCalls = sql.callsContaining('ORDER BY version DESC, code ASC');
    expect(listCalls[0].statement).toContain('LIMIT 500');
  });

  it('toutes les écritures sont rejouables (ON DUPLICATE KEY UPDATE)', async () => {
    const store = createCriterionStore(sql);
    await store.saveCriterion(ac1());
    await store.addCriterionRevision(revision());

    expect(sql.calls).toHaveLength(2);
    expect(allWritesReplayable(sql)).toBe(true);
    expect(sql.calls[0].statement).toContain('ON DUPLICATE KEY UPDATE');
    expect(sql.calls[1].statement).toContain('ON DUPLICATE KEY UPDATE');
  });

  it('ne comporte aucun DELETE : intégrité et historique garantis (SPEC §20)', async () => {
    const store = createCriterionStore(sql);
    await store.saveCriterion(ac1({ status: 'superseded' }));
    for (const call of sql.calls) {
      expect(call.statement).not.toMatch(/\bDELETE\b/i);
      expect(call.statement).not.toMatch(/\bDROP\b/i);
    }
  });
});

describe('lectures de critères (SPEC §8.1)', () => {
  it('lit la liste des critères d’un ticket, typée et sans exception', async () => {
    sql.scriptRows([criterionToRow(ac1()), criterionToRow(ac3())]);
    const store = createCriterionStore(sql);
    const criteria = await store.listCriteriaByIssue('10001');

    expect(criteria).toHaveLength(2);
    expect(criteria[0]).toEqual(ac1());
    expect(criteria[1]).toEqual(ac3());
    expect(sql.calls[0].params).toEqual(['10001']);
  });

  it('filtre par statuts avec clause IN (?, ?)', async () => {
    sql.scriptRows([criterionToRow(ac1())]);
    const store = createCriterionStore(sql);
    const criteria = await store.listCriteriaByIssue('10001', ['active', 'proposed']);

    expect(criteria).toHaveLength(1);
    expect(sql.calls[0].statement).toContain('status IN (?, ?)');
    expect(sql.calls[0].params).toEqual(['10001', 'active', 'proposed']);
  });

  it('getCriterion rend le critère ou null si absent', async () => {
    const store = createCriterionStore(sql);
    sql.scriptRows([criterionToRow(ac1())]);
    expect(await store.getCriterion('crit-ac1')).toEqual(ac1());

    sql.scriptRows([]);
    expect(await store.getCriterion('crit-inconnu')).toBeNull();
  });

  it('getCriterionByCode rend le critère pour ce ticket et ce code', async () => {
    const store = createCriterionStore(sql);
    sql.scriptRows([criterionToRow(ac4())]);
    const found = await store.getCriterionByCode('10001', 'AC-4');

    expect(found).toEqual(ac4());
    expect(sql.calls[0].params).toEqual(['10001', 'AC-4']);
  });

  it('nextCriterionCode renvoie AC-1 sur ticket vierge, ou max + 1', async () => {
    const store = createCriterionStore(sql);
    sql.scriptRows([]);
    expect(await store.nextCriterionCode('10001')).toBe('AC-1');

    sql.scriptRows([{ code: 'AC-1' }, { code: 'AC-3' }, { code: 'AC-2' }]);
    expect(await store.nextCriterionCode('10001')).toBe('AC-4');
  });
});

describe('historique et révisions (SPEC §8.4)', () => {
  it('écrit et relit une révision d’historique', async () => {
    const store = createCriterionStore(sql);
    await store.addCriterionRevision(revision());

    sql.scriptRows([criterionRevisionToRow(revision())]);
    const revisions = await store.listCriterionRevisions('crit-ac1');

    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toEqual(revision());
    expect(sql.calls[1].params).toEqual(['crit-ac1']);
  });

  it('rejouer la même révision ne casse rien (idempotence)', async () => {
    const store = createCriterionStore(sql);
    await store.addCriterionRevision(revision());
    await store.addCriterionRevision(revision());

    expect(sql.calls).toHaveLength(2);
    expect(sql.calls[0].statement).toBe(sql.calls[1].statement);
  });
});

describe('sauvegarde rejouable (SPEC §18)', () => {
  it('passe tous les paramètres dans l’ordre des colonnes', async () => {
    const store = createCriterionStore(sql);
    const crit: Criterion = ac1();
    await store.saveCriterion(crit);

    const call = sql.calls[0];
    expect(call.statement).toContain('INSERT INTO criterion');
    expect(call.params[0]).toBe(crit.id);
    expect(call.params[1]).toBe(crit.issueId);
    expect(call.params[2]).toBe(crit.code);
    expect(call.params[3]).toBe(crit.text);
    expect(call.params[4]).toBe(crit.type);
    expect(call.params[5]).toBe(crit.requiredStrength);
    expect(call.params[6]).toBe(crit.version);
    expect(call.params[7]).toBe(crit.status);
    expect(call.params[8]).toBe(crit.createdBy);
  });
});
