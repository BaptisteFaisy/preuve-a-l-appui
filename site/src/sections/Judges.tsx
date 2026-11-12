/**
 * Section « Judges » du site public : le parcours en dix minutes, la commande
 * de CI à copier et les liens pour aller plus loin.
 *
 * Les textes viennent de `site/src/i18n/`. Le seul JavaScript de la page :
 * le bouton « Copier » (API `navigator.clipboard`, avec repli).
 * MANQUE : pas de clé i18n pour les libellés du bouton — voir `copyLabels`.
 *
 * Lot `site/sections-c`. Règle : fichiers < 500 lignes, fonctions < 50 lignes.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { Language } from '../../../src/types.js';
import { stringsFor } from '../i18n/index.js';
import './Judges.css';

interface CopyLabels {
  readonly copy: string;
  readonly copied: string;
}

/** Libellés du bouton Copier — aucune clé i18n n'existe pour eux (MANQUE). */
function copyLabels(lang: Language): CopyLabels {
  return lang === 'fr' ? { copy: 'Copier', copied: 'Copié' } : { copy: 'Copy', copied: 'Copied' };
}

/** Repli sans `navigator.clipboard` : zone de texte cachée + `execCommand`. */
function legacyCopy(text: string): boolean {
  try {
    const zone = document.createElement('textarea');
    zone.value = text;
    zone.setAttribute('readonly', 'true');
    zone.style.position = 'fixed';
    zone.style.opacity = '0';
    document.body.appendChild(zone);
    zone.select();
    const done = document.execCommand('copy');
    document.body.removeChild(zone);
    return done;
  } catch {
    return false;
  }
}

/** Copie dans le presse-papiers ; `false` si aucune méthode n'a fonctionné. */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // repli ci-dessous
  }
  return legacyCopy(text);
}

interface CopyCommandProps {
  readonly lang: Language;
  readonly title: string;
  readonly command: string;
  readonly body: string;
}

/** Le bloc « une ligne en fin de pipeline » : commande, bouton Copier, note. */
function CopyCommand({ lang, title, command, body }: CopyCommandProps): ReactElement {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const labels = copyLabels(lang);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onCopy = (): void => {
    void writeToClipboard(command).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="judges-command card">
      <div className="judges-command-head">
        <h3 className="judges-command-title">{title}</h3>
        <button type="button" className="button secondary judges-copy" onClick={onCopy}>
          {labels.copy}
        </button>
        <p className="judges-command-status" role="status" aria-live="polite">
          {copied ? labels.copied : ''}
        </p>
      </div>
      <pre className="judges-command-pre">
        <code>{command}</code>
      </pre>
      <p className="judges-command-body">{body}</p>
    </div>
  );
}

export function Judges({ lang }: { lang: Language }): ReactElement {
  const t = stringsFor(lang);
  return (
    <section id="Judges" aria-labelledby="Judges-title">
      <div className="wrap">
        <h2 id="Judges-title">{t.judges.title}</h2>
        <p className="lede">{t.judges.lede}</p>
        <h3 className="judges-steps-title">{t.judges.stepsTitle}</h3>
        <ol className="judges-steps" role="list">
          {t.judges.steps.map((step, index) => (
            <li className="judges-step" key={step.title}>
              <span className="judges-step-num" aria-hidden="true">
                {index + 1}
              </span>
              <div className="judges-step-body">
                <h4 className="judges-step-title">{step.title}</h4>
                <p className="judges-step-text">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <CopyCommand
          lang={lang}
          title={t.judges.ciCommandTitle}
          command={t.judges.ciCommand}
          body={t.judges.ciCommandBody}
        />
        <h3 className="judges-links-title">{t.judges.linksTitle}</h3>
        <ul className="judges-links">
          {t.judges.links.map((link) => (
            <li key={link.href}>
              <a href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
