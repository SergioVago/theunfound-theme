#!/usr/bin/env bash
# Gera dist/theunfound-theme.xpi (zip do conteúdo de addon/).
set -euo pipefail
cd "$(dirname "$0")/.."

out="dist/theunfound-theme.xpi"
mkdir -p dist
rm -f "$out"

# Valida os JSON antes de empacotar.
for f in addon/manifest.json addon/experiments/unfoundTheme/schema.json; do
  python3 -m json.tool "$f" >/dev/null || { echo "JSON inválido: $f" >&2; exit 1; }
done

# Experiment API exige strict_max_version (regra do addons-linter/ATN:
# "A strict_max_version is required for Thunderbird Mail Experiments").
python3 - <<'PY' || exit 1
import json, sys
m = json.load(open("addon/manifest.json"))
if m.get("experiment_apis"):
    g = m.get("browser_specific_settings", {}).get("gecko", {})
    v = g.get("strict_max_version")
    if not v or v == "*":
        sys.exit("manifest.json: experiment_apis exige browser_specific_settings.gecko.strict_max_version (ex.: \"158.*\")")
PY

(cd addon && zip -q -r -X -9 "../$out" . -x '*.DS_Store' -x '*~')
# A MPL pede que o texto da licença acompanhe a distribuição; o .xpi é o que o
# usuário recebe, então o LICENSE entra nele.
zip -q -X -9 "$out" LICENSE

version=$(python3 -c 'import json; print(json.load(open("addon/manifest.json"))["version"])')
echo "Gerado $out (versão $version, $(du -h "$out" | cut -f1))"
