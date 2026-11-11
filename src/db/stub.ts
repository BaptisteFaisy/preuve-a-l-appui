/**
 * Socle : fabrique de souches.
 *
 * Chaque adaptateur de persistance naît ici, dans le lot qui le possède
 * (docs/CONTRACTS.md §4). Une souche compile, s'installe dans `repo.ts` et
 * échoue bruyamment si on l'appelle avant d'être implémentée : on préfère une
 * erreur nommée à un `undefined` silencieux.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */

/** Erreur levée par une souche appelée avant implémentation. */
export class NotImplemented extends Error {
  constructor(readonly factory: string, readonly lot: string) {
    super(`${factory} n'est pas encore implémentée (lot ${lot})`);
    this.name = 'NotImplemented';
  }
}

/**
 * Renvoie un objet dont toutes les méthodes lèvent `NotImplemented`.
 * Typé `T` pour que la souche respecte déjà l'interface du port.
 */
export function stubOf<T extends object>(factory: string, lot: string): T {
  return new Proxy({} as T, {
    get(_target, property) {
      return () => {
        throw new NotImplemented(`${factory}.${String(property)}`, lot);
      };
    },
  });
}
