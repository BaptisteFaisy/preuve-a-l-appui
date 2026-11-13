/**
 * La garde du catalogue de démonstration.
 *
 * Le catalogue (`tools/demo-scenarios/`) est la source unique des histoires de
 * tickets. Cette garde le relit **hors réseau** et prouve qu'il est complet :
 * il fait vivre les sept types de critère, les six types de preuve, les
 * gestes humains, la révision, le critère en attente, la réouverture — et il
 * reste **valide au sens du parsing** (le socle gelé `src/sample/scenario.ts`
 * fait foi, on ne réimplémente rien).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { parseScenario } from '../../src/sample/scenario.js';

/* ------------------------------------------------------------- le catalogue */

interface DemoCriterion {
  code: string;
  text: string;
  type: string;
  requiredStrength: string;
  status: string;
}
interface DemoEvidence {
  criterion: string;
  type: string;
  reference: string;
  addedBy: string;
}
interface DemoGesture {
  code: string;
  accountId: string;
}
interface DemoWaiver extends DemoGesture {
  role: string;
  reason: string;
}
interface DemoLink {
  code: string;
  testName: string;
  status: string;
}
interface DemoScenario {
  criteria: DemoCriterion[];
  evidences: DemoEvidence[];
  attest: DemoGesture[];
  waive: DemoWaiver[];
  links: DemoLink[];
  revisions: { code: string; text: string }[];
}
interface DemoTicket {
  key: string;
  summary: string;
  description: string;
  component: string;
  branch: string;
  tests: string[];
  mainTests: string[];
  failing?: string[];
  cast: Record<string, string>;
  close: boolean;
  reopen: boolean;
  scenario: DemoScenario;
}

const require = createRequire(import.meta.url);
const catalogue = require('../../tools/demo-scenarios.mjs') as {
  DEMO_SCENARIOS: DemoTicket[];
};
const tickets: DemoTicket[] = catalogue.DEMO_SCENARIOS;

/** Tous les critères du catalogue. */
function allCriteria(): DemoCriterion[] {
  return tickets.flatMap((ticket) => ticket.scenario.criteria);
}

/** Toutes les preuves déclarées du catalogue. */
function allEvidences(): DemoEvidence[] {
  return tickets.flatMap((ticket) => ticket.scenario.evidences);
}

/** Toutes les attestations demandées. */
function allAttestations(): DemoGesture[] {
  return tickets.flatMap((ticket) => ticket.scenario.attest);
}

/** Toutes les dérogations demandées. */
function allWaivers(): DemoWaiver[] {
  return tickets.flatMap((ticket) => ticket.scenario.waive);
}

/* --------------------------------------------------------------- le catalogue */

describe('le catalogue de démonstration', () => {
  it('porte une fiche complète par ticket', () => {
    expect(tickets.length).toBeGreaterThanOrEqual(8);
    const keys = tickets.map((ticket) => ticket.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const ticket of tickets) {
      expect(ticket.key).toMatch(/^PRF-\d+$/);
      expect(ticket.summary.length).toBeGreaterThan(0);
      expect(ticket.description.length).toBeGreaterThan(0);
      expect(ticket.component.length).toBeGreaterThan(0);
      expect(ticket.branch).toContain(ticket.key);
      expect(Object.keys(ticket.cast).sort()).toEqual(['agent', 'developer', 'owner', 'tester']);
      expect(ticket.scenario.criteria.length).toBeGreaterThan(0);
    }
  });

  it('ne touche pas à PRF-1, la vedette du site', () => {
    expect(tickets.map((ticket) => ticket.key)).not.toContain('PRF-1');
  });

  it('donne à chaque ticket ses propres tests', () => {
    const names = tickets.flatMap((ticket) => ticket.tests);
    expect(new Set(names).size).toBe(names.length);
    for (const ticket of tickets) {
      expect(new Set(ticket.mainTests).size).toBe(ticket.mainTests.length);
    }
  });
});

/* ---------------------------------------------------------------- le parsing */

describe('chaque scénario est valide au sens du parsing', () => {
  it('est lu par parseScenario sans être rejeté', () => {
    for (const ticket of tickets) {
      expect(parseScenario(ticket.scenario), `${ticket.key} mal formé`).not.toBeNull();
    }
  });

  it('conserve tous les critères, avec leur statut', () => {
    for (const ticket of tickets) {
      const parsed = parseScenario(ticket.scenario);
      expect(parsed?.criteria.length).toBe(ticket.scenario.criteria.length);
      expect(parsed?.criteria.map((one) => one.status)).toEqual(
        ticket.scenario.criteria.map((one) => one.status),
      );
    }
  });

  it('ne vise que des codes de critère existants', () => {
    for (const ticket of tickets) {
      const codes = new Set(ticket.scenario.criteria.map((one) => one.code));
      for (const evidence of ticket.scenario.evidences) {
        expect(codes.has(evidence.criterion)).toBe(true);
      }
      for (const gesture of [...ticket.scenario.attest, ...ticket.scenario.waive]) {
        expect(codes.has(gesture.code)).toBe(true);
      }
      for (const link of ticket.scenario.links) {
        expect(codes.has(link.code)).toBe(true);
      }
      for (const revision of ticket.scenario.revisions) {
        expect(codes.has(revision.code)).toBe(true);
      }
    }
  });
});

/* ------------------------------------------------------------ la couverture */

describe('le catalogue fait vivre toutes les fonctionnalités', () => {
  it('couvre les sept types de critère', () => {
    const types = new Set(allCriteria().map((criterion) => criterion.type));
    expect([...types].sort()).toEqual([
      'accessibility',
      'data',
      'documentation',
      'functional',
      'performance',
      'regression',
      'security',
    ]);
  });

  it('couvre les six types de preuve', () => {
    const types = new Set(allEvidences().map((evidence) => evidence.type));
    // Une attestation est une preuve : le geste humain l'écrit dans l'app.
    if (allAttestations().length > 0) types.add('attestation');
    expect([...types].sort()).toEqual([
      'agent-report',
      'attachment',
      'attestation',
      'documentation',
      'link',
      'test',
    ]);
  });

  it('accorde au moins deux dérogations, par deux personnes', () => {
    const waivers = allWaivers();
    expect(waivers.length).toBeGreaterThanOrEqual(2);
    expect(new Set(waivers.map((waiver) => waiver.accountId)).size).toBeGreaterThanOrEqual(2);
    for (const waiver of waivers) {
      expect(waiver.reason.length).toBeGreaterThan(0);
      expect(['Administrators', 'Product Owner']).toContain(waiver.role);
    }
  });

  it('atteste au moins deux critères, par deux personnes', () => {
    const attestations = allAttestations();
    expect(attestations.length).toBeGreaterThanOrEqual(2);
    expect(new Set(attestations.map((one) => one.accountId)).size).toBeGreaterThanOrEqual(2);
  });

  it('réviser au moins un critère', () => {
    const revisions = tickets.flatMap((ticket) => ticket.scenario.revisions);
    expect(revisions.length).toBeGreaterThanOrEqual(1);
    for (const revision of revisions) {
      expect(revision.text.length).toBeGreaterThan(0);
    }
  });

  it('propose au moins un critère en attente de validation', () => {
    const proposed = allCriteria().filter((criterion) => criterion.status === 'proposed');
    expect(proposed.length).toBeGreaterThanOrEqual(1);
  });
});

/* ---------------------------------------------------------- les gestes humains */

describe('les gestes humains respectent les règles du domaine', () => {
  it('ne fait jamais attester l’assigné ni l’agent', () => {
    for (const ticket of tickets) {
      for (const attestation of ticket.scenario.attest) {
        expect(attestation.accountId).not.toBe(ticket.cast.developer);
        expect(attestation.accountId).not.toBe(ticket.cast.agent);
      }
    }
  });

  it('ne fait jamais déroger l’agent', () => {
    for (const ticket of tickets) {
      for (const waiver of ticket.scenario.waive) {
        expect(waiver.accountId).not.toBe(ticket.cast.agent);
      }
    }
  });
});

/* ------------------------------------------------------ les preuves vivantes */

describe('les preuves et les paires test ↔ critère', () => {
  it('associe chaque preuve de test à un test que la CI joue', () => {
    for (const ticket of tickets) {
      for (const evidence of ticket.scenario.evidences) {
        if (evidence.type !== 'test') continue;
        expect(ticket.tests).toContain(evidence.reference);
      }
    }
  });

  it('associe chaque paire à un test que la CI joue', () => {
    for (const ticket of tickets) {
      for (const link of ticket.scenario.links) {
        expect(ticket.tests).toContain(link.testName);
      }
    }
  });

  it('livre au moins un ticket avec une preuve vivante', () => {
    const living = tickets.filter(
      (ticket) =>
        ticket.close &&
        ticket.scenario.links.some(
          (link) => link.status === 'confirmed' && ticket.mainTests.includes(link.testName),
        ),
    );
    expect(living.length).toBeGreaterThanOrEqual(1);
  });

  it('livre puis rouvre un ticket dont la preuve vivante tombe', () => {
    const reopened = tickets.filter((ticket) => ticket.close && ticket.reopen);
    expect(reopened.length).toBeGreaterThanOrEqual(1);
    for (const ticket of reopened) {
      // La preuve tombe soit parce que le test a disparu de `main`, soit
      // parce qu'il y est devenu ROUGE : les deux font tomber le critère.
      const fallen = ticket.scenario.links.filter(
        (link) =>
          link.status === 'confirmed' &&
          (!ticket.mainTests.includes(link.testName) ||
            (ticket.failing ?? []).includes(link.testName)),
      );
      expect(fallen.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('déclare un test rouge qui existe toujours sur la branche principale', () => {
    // Un test « rouge » est un test qui ÉCHOUE : s'il avait disparu, la
    // preuve serait « non prouvée », pas « régressée ».
    for (const ticket of tickets) {
      for (const name of ticket.failing ?? []) {
        expect(ticket.mainTests).toContain(name);
        expect(ticket.tests).toContain(name);
      }
    }
    expect(tickets.some((ticket) => (ticket.failing ?? []).length > 0)).toBe(true);
  });

  it('garde les tests de main parmi les tests de la branche', () => {
    for (const ticket of tickets) {
      for (const name of ticket.mainTests) {
        expect(ticket.tests).toContain(name);
      }
    }
  });
});
