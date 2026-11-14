#!/usr/bin/env python3
"""Garde : chaque workflow GitHub doit être un YAML valide — et son shell valide.

Deux fautes distinctes, attrapées ici plutôt qu'en CI :

1. **YAML invalide** : le workflow ne crée aucun job (« workflow file issue »)
   et laisse le dépôt sans déploiement ni suite.
2. **Script shell invalide** : le YAML est accepté, le job démarre, puis
   l'étape `run:` meurt sur une erreur de syntaxe. C'est arrivé le 14/11/2026
   (run 43611040858) : deux `echo` contenant une apostrophe échappée `\\'`
   entre guillemets simples — `\\` est littéral entre `'`, la chaîne se
   fermait donc sur le `\\` et la suivante s'ouvrait sans jamais se refermer.

Les fichiers sont **découverts** dans `.github/workflows/`, pas listés : un
workflow ajouté sans forgotten d'être déclaré ici est vérifié quand même.

PyYAML n'est pas garanti sur les runners ; s'il manque, le garde fait un
contrôle syntaxique minimal (tabulations) et le signale clairement au lieu
d'échouer en silence. La grammaire shell, elle, est vérifiée avec `bash -n` :
`bash` est toujours présent sur un runner Linux.
"""
import glob
import os
import subprocess
import sys
import tempfile

def racine() -> str:
    """Le répertoire à auditer : `--racine <dossier>`, sinon le courant."""
    argv = sys.argv[1:]
    for index, arg in enumerate(argv):
        if arg == "--racine" and index + 1 < len(argv):
            return argv[index + 1]
    return "."


RACINE = racine()
DOSSIER = os.path.join(RACINE, ".github", "workflows")
WORKFLOWS = sorted(glob.glob(os.path.join(DOSSIER, "*.yml")) + glob.glob(os.path.join(DOSSIER, "*.yaml")))

# Coquilles où `bash -n` ne dit rien de valide : le script est dans un autre
# langage, et le garde shell n'a pas à le juger.
AUTRES_SHELL = {"python", "python3", "pwsh", "powershell", "cmd", "sh", "node"}


def fichiers_shell():
    """Les blocs `run:` à vérifier, avec le chemin du workflow et l'étape."""
    blocs = []
    try:
        import yaml
    except ImportError:
        return blocs
    for path in WORKFLOWS:
        with open(path, encoding="utf-8") as handle:
            brut = handle.read()
        try:
            document = yaml.safe_load(brut)
        except Exception:
            # Un YAML cassé est signalé par le contrôle YAML, pas par celui-ci :
            # lire ses étapes n'aurait aucun sens et masquerait la vraie faute.
            continue
        if not isinstance(document, dict):
            continue
        for nom, job in (document.get("jobs") or {}).items():
            if not isinstance(job, dict):
                continue
            for index, step in enumerate(job.get("steps") or []):
                if not isinstance(step, dict):
                    continue
                script = step.get("run")
                coquille = str(step.get("shell", "bash")).lower()
                if not isinstance(script, str) or script.strip() == "":
                    continue
                if any(coquille.startswith(autre) for autre in AUTRES_SHELL):
                    continue
                blocs.append((path, nom, step.get("name", f"#{index}"), script))
    return blocs


def yaml_valides(errors):
    """Contrôle YAML de chaque workflow (PyYAML si disponible)."""
    try:
        import yaml
    except ImportError:
        for path in WORKFLOWS:
            with open(path, encoding="utf-8") as handle:
                if "\t" in handle.read():
                    errors.append(f"{path}: tabulation dans le YAML")
        return False
    for path in WORKFLOWS:
        try:
            with open(path, encoding="utf-8") as handle:
                yaml.safe_load(handle.read())
        except Exception as exc:
            errors.append(f"{path}: {type(exc).__name__}: {exc}")
    return True


def shell_valides(errors):
    """Grammaire bash de chaque bloc `run:` (`: bash -n`)."""
    for path, job, nom, script in fichiers_shell():
        with tempfile.NamedTemporaryFile("w", suffix=".sh", delete=False, encoding="utf-8") as handle:
            handle.write(script)
            temporaire = handle.name
        try:
            resultat = subprocess.run(
                ["bash", "-n", temporaire], capture_output=True, text=True, timeout=20
            )
        except Exception as exc:
            errors.append(f"{path}: job {job}, étape « {nom} » : {type(exc).__name__}: {exc}")
            continue
        finally:
            os.unlink(temporaire)
        if resultat.returncode != 0:
            detail = (resultat.stderr or "").strip().splitlines()
            raisons = " / ".join(ligne.strip() for ligne in detail[:3])
            errors.append(
                f"{path}: job {job}, étape « {nom} » : script bash invalide — {raisons}"
            )


def main():
    """Vérifie tout, et sort en 1 avec la liste des fautes."""
    errors = []
    if not WORKFLOWS:
        errors.append(f"{DOSSIER} : aucun workflow trouvé")
    yaml_valides(errors)
    shell_valides(errors)
    if errors:
        for message in errors:
            print(f"::error::{message}")
        print("ERREUR : %d workflow(s) en défaut." % len(errors))
        sys.exit(1)
    blocs = len(fichiers_shell())
    print(f"OK : {len(WORKFLOWS)} workflow(s) YAML valide(s), {blocs} script(s) bash vérifié(s).")


if __name__ == "__main__":
    main()
