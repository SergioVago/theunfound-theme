#!/usr/bin/env bash
# Atalhos do loop de desenvolvimento (perfil .dev-profile, porta 2850).
#   tools/dev.sh start            sobe o Thunderbird headless de dev (log em <perfil>/tb.log)
#   tools/dev.sh reload           (re)instala addon/ como complemento temporário
#   tools/dev.sh shot NOME [light|dark] [assunto] [expand]   cena padrão + screenshot em screenshots/tmp/NOME.png
#   tools/dev.sh stop             encerra a instância
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-2850}"
PROFILE="${PROFILE:-.dev-profile}"
# Log dentro do próprio perfil: cada worktree/perfil tem o seu, sem misturar
# instâncias paralelas num arquivo compartilhado.
LOG="${LOG:-$PROFILE/tb.log}"
TB="python3 tools/tbctl.py"

case "${1:-}" in
  start)
    mkdir -p "$PROFILE"
    $TB launch --profile "$PROFILE" --port "$PORT" --log "$LOG"
    echo "log: $LOG"
    ;;
  reload)
    $TB exec --port "$PORT" --file tools/dev-addon.js --args "{\"dir\": \"$PWD/addon\", \"action\": \"${2:-install}\"}"
    ;;
  shot)
    name="${2:?nome}"
    scheme="${3:-light}"
    subject="${4:-}"
    expand="${5:-false}"
    mkdir -p screenshots/tmp
    $TB exec --port "$PORT" --file tools/dev-scene.js --args "{\"scheme\": \"$scheme\", \"subject\": \"$subject\", \"expand\": $expand}" >/dev/null
    $TB shot --port "$PORT" --out "screenshots/tmp/$name.png"
    ;;
  stop)
    $TB quit --port "$PORT"
    ;;
  *)
    sed -n '2,7p' "$0"
    exit 1
    ;;
esac
