/**
 * Tests du découpage et du réassemblage des lots de CI (SPEC §10 : au-delà de
 * 5 Mo, envoi en plusieurs lots).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { describe, expect, it } from 'vitest';
import { BatchReassembler, splitCiSummaryIntoBatches } from '../../src/ingest/batching.js';
import { aCiSummary, aTestOutcome, COMMIT, REPO, BRANCH } from '../helpers/builders.js';

describe('splitCiSummaryIntoBatches', () => {
  it('un résumé vide ou petit produit un lot unique', () => {
    const empty = aCiSummary({ tests: [] });
    expect(splitCiSummaryIntoBatches('run-1', empty)).toEqual([
      { runId: 'run-1', index: 0, total: 1, summary: empty },
    ]);

    const small = aCiSummary();
    const batches = splitCiSummaryIntoBatches('run-1', small);
    expect(batches).toHaveLength(1);
    expect(batches[0].total).toBe(1);
    expect(batches[0].summary.tests).toHaveLength(small.tests.length);
  });

  it('découpe dès que le seuil d’octets est dépassé', () => {
    const tests = Array.from({ length: 10 }, (_, i) =>
      aTestOutcome({ name: `tests/feature/module/test-${i}.spec.ts::assertion`, state: 'passed' }),
    );
    const summary = aCiSummary({ tests });
    // Seuil artificiellement bas : chaque test dépasse presque la limite
    const batches = splitCiSummaryIntoBatches('run-1', summary, 600);

    expect(batches.length).toBeGreaterThan(1);
    expect(batches.every((b) => b.total === batches.length)).toBe(true);
    expect(batches.map((b) => b.index)).toEqual(batches.map((_, i) => i));

    const totalTests = batches.reduce((sum, b) => sum + b.summary.tests.length, 0);
    expect(totalTests).toBe(tests.length);
  });
});

describe('BatchReassembler', () => {
  it('un lot unique passe directement sans mise en attente', () => {
    const reassembler = new BatchReassembler();
    const summary = aCiSummary();
    const batch = { runId: 'run-1', index: 0, total: 1, summary };

    const assembled = reassembler.addBatch(batch);
    expect(assembled).toEqual(summary);
    expect(reassembler.pending).toBe(0);
  });

  it('attend tous les lots avant de rendre le résumé fusionné', () => {
    const reassembler = new BatchReassembler();
    const t1 = aTestOutcome({ name: 't1' });
    const t2 = aTestOutcome({ name: 't2' });
    const t3 = aTestOutcome({ name: 't3' });

    const base = { repo: REPO, branch: BRANCH, commit: COMMIT, mainBranch: false, receivedAt: '' };
    const b1 = { runId: 'run-1', index: 0, total: 3, summary: { ...base, tests: [t1] } };
    const b2 = { runId: 'run-1', index: 1, total: 3, summary: { ...base, tests: [t2] } };
    const b3 = { runId: 'run-1', index: 2, total: 3, summary: { ...base, tests: [t3] } };

    // Arrivée dans le désordre : b2 puis b1 puis b3
    expect(reassembler.addBatch(b2)).toBeNull();
    expect(reassembler.pending).toBe(1);
    expect(reassembler.addBatch(b1)).toBeNull();
    const assembled = reassembler.addBatch(b3);

    expect(assembled).not.toBeNull();
    expect(assembled?.tests.map((t) => t.name)).toEqual(['t1', 't2', 't3']);
    expect(reassembler.pending).toBe(0);
  });

  it('purge les assemblages trop anciens', () => {
    let now = 1000;
    const reassembler = new BatchReassembler(() => now);
    const summary = aCiSummary();
    reassembler.addBatch({ runId: 'run-orphan', index: 0, total: 2, summary });
    expect(reassembler.pending).toBe(1);

    now += 400_000; // plus de 300 s
    reassembler.prune();
    expect(reassembler.pending).toBe(0);
  });
});
