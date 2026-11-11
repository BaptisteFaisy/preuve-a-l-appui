/**
 * Point d'entrée du site public : monte l'application React dans `#root`.
 *
 * Aucune donnée ne quitte le navigateur : le site est entièrement statique et
 * la démo exécute le moteur réel de l'app en mémoire (voir `src/demo/`).
 *
 * Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('site : conteneur #root absent de index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
