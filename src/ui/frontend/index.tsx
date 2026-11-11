/**
 * Souche — point d'entrée de l'interface Forge (SPEC §16).
 *
 * Propriétaire : lot L6 (docs/CONTRACTS.md §3). Les quatre écrans de l'app
 * (matrice du ticket, champ de couverture, réglages du projet, page projet)
 * sont rendus ici ; le socle ne fournit que le cadre, en UI Kit 2.
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import React from 'react';
import { Box, Heading, Text } from '@forge/react';

/** Écran générique : remplacé par les écrans du lot L6. */
export default function App(): React.ReactElement {
  return (
    <Box>
      <Heading as="h2">Fait, preuve à l'appui</Heading>
      <Text>Écran en cours de construction (lot L6).</Text>
    </Box>
  );
}
