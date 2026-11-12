/**
 * Construction du site public (GitHub Pages).
 *
 * Le site importe le VRAI domaine de l'app (`src/domain`, `src/handlers`) et
 * les fakes en mémoire de la suite de tests : la démo en ligne exécute donc la
 * même logique que l'app Forge, pas une copie. Rien d'extérieur au dépôt n'est
 * téléchargé au runtime (polices et icônes incluses) : le site reste lisible
 * hors ligne une fois chargé.
 *
 * `base` porte le nom du dépôt : Pages sert le site sous
 * https://tradoooo.github.io/preuve-a-l-appui/.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  base: '/preuve-a-l-appui/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
  },
});
