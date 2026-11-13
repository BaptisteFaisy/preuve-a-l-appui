/**
 * Doublons déterministes : horloge, identifiants, journal (SPEC §19, §22).
 *
 * Aucun horodatage ni identifiant d'un test ne vient du monde réel : `Clock`
 * et `IdGenerator` sont injectés (docs/CONTRACTS.md §5) et tout est rejouable.
 * Les fakes vivent hors du runtime Forge : jamais d'import `@forge/*`.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import type { Clock, IdGenerator, Logger } from '../../src/ports.js';

/** Le seul instant par défaut des tests (SPEC §22 : recette rejouable). */
export const FIXED_NOW = '2026-11-11T08:00:00.000Z';

export type LogLevel = 'info' | 'warn' | 'error';

/** Une ligne de journal conservée par le faux logger. */
export interface LogLine {
  level: LogLevel;
  message: string;
  meta?: unknown;
}

/** Horloge pilotable : `now()` répète l'instant tant que rien ne le bouge. */
export interface FakeClock extends Clock {
  /** Fixe l'instant courant. */
  set(iso: string): void;
  /** Avance de `minutes` minutes (cas limites : fraîcheur, dérogations). */
  advanceMinutes(minutes: number): void;
  /** Avance de `ms` millisecondes. */
  advanceMs(ms: number): void;
}

/** Horloge figée sur `start` ; déterministe par construction. */
export function createFakeClock(start: string = FIXED_NOW): FakeClock {
  let current = start;
  return {
    now: () => current,
    set(iso) {
      current = iso;
    },
    advanceMinutes(minutes) {
      current = shifted(current, minutes * 60_000);
    },
    advanceMs(ms) {
      current = shifted(current, ms);
    },
  };
}

function shifted(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

/** Identifiants déterministes, avec la liste de ce qui a été distribué. */
export interface FakeIds extends IdGenerator {
  /** Tous les identifiants distribués, dans l'ordre. */
  readonly issued: string[];
}

/**
 * Compteur **par préfixe** : `next('crit')` donne `crit_1`, `crit_2`… et
 * `next('ev')` repart à `ev_1`. Un test connaît donc ses identifiants d'avance.
 * `prefix` sert de repli si un appelant passe une chaîne vide.
 */
export function createFakeIds(prefix = 'id'): FakeIds {
  const counters = new Map<string, number>();
  const issued: string[] = [];
  return {
    issued,
    next(prefixArg: string): string {
      const key = prefixArg === '' ? prefix : prefixArg;
      const count = (counters.get(key) ?? 0) + 1;
      counters.set(key, count);
      const id = `${key}_${count}`;
      issued.push(id);
      return id;
    },
  };
}

/** Logger qui garde tout, pour que les tests puissent lire la trace. */
export interface RecordingLogger extends Logger {
  readonly entries: LogLine[];
  /** Les messages d'un niveau donné, dans l'ordre. */
  atLevel(level: LogLevel): string[];
  /** Toutes les lignes, au format `niveau message`. */
  lines(): string[];
}

export function createRecordingLogger(): RecordingLogger {
  const entries: LogLine[] = [];
  return {
    entries,
    atLevel(level) {
      return entries.filter((entry) => entry.level === level).map((entry) => entry.message);
    },
    lines() {
      return entries.map((entry) => `${entry.level} ${entry.message}`);
    },
    log(level, message, meta) {
      entries.push(meta === undefined ? { level, message } : { level, message, meta });
    },
  };
}
