/**
 * Écran — Champ de couverture en lecture seule (SPEC §16.2, §12.3, FP-16).
 *
 * Rendu « 3 / 4 » coloré : vert (tout prouvé), orange (partiel), rouge (vide).
 * Le manifest expose ce champ via une expression de propriété indexée ; ce
 * composant sert au rendu ressource et est réutilisé dans les tableaux.
 * Toute la logique (libellé, couleur) vit dans `src/viewmodel/coverage.ts`.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import React from 'react';
import { Tag, Tooltip } from '@forge/react';
import type { CoverageFieldViewModel } from '../viewmodel/coverage.js';

export interface CoverageFieldProps {
  readonly vm: CoverageFieldViewModel;
}

export function CoverageField({ vm }: CoverageFieldProps): React.ReactElement {
  return (
    <Tooltip content={vm.tooltip}>
      <Tag text={vm.label} color={vm.tagColor} />
    </Tooltip>
  );
}
