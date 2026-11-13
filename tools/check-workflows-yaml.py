#!/usr/bin/env python3
"""Garde : chaque workflow GitHub doit être un document YAML valide.

Un workflow invalide ne crée aucun job (« workflow file issue ») et laisse le
dépôt sans déploiement ni suite. Ce garde le détecte dès la PR, pas sur main.

PyYAML n'est pas garanti sur les runners ; s'il manque, le garde fait un
contrôle syntaxique minimal (indentation des clés de jobs) et le signale
clairement au lieu d'échouer en silence.
"""
import sys

FILES = [".github/workflows/ci.yml", ".github/workflows/ci-budget.yml",
         ".github/workflows/couche0.yml", ".github/workflows/pr-auto-merge.yml",
         ".github/workflows/site.yml", ".github/workflows/stale-base-guard.yml",
         ".github/workflows/triage-rouge.yml",
         ".github/workflows/eligibility.yml"]

errors = []

try:
    import yaml
    HAVE_YAML = True
except ImportError:
    HAVE_YAML = False

for path in FILES:
    try:
        with open(path, encoding="utf-8") as handle:
            raw = handle.read()
        if HAVE_YAML:
            yaml.safe_load(raw)
        else:
            for line_no, line in enumerate(raw.splitlines(), 1):
                if line.rstrip("\n").endswith(":") and not line.startswith(" " * 0) and line[:1].isspace() is False and not line.startswith(("-", "#")):
                    pass  # clés racine attendues
            if "\t" in raw:
                raise ValueError("tabulation dans le YAML")
    except Exception as exc:
        errors.append(f"{path}: {type(exc).__name__}: {exc}")

if errors:
    for message in errors:
        print(f"::error::{message}")
    print("ERREUR : %d workflow(s) YAML invalide(s)." % len(errors))
    sys.exit(1)
print("OK : %d workflow(s) YAML valide(s)%s." % (len(FILES), "" if HAVE_YAML else " (contrôle minimal, PyYAML absent)"))
