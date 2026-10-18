#!/usr/bin/env bash
#
# Закрепляет версию tor-expert-bundle: скачивает `sha256sums-signed-build.txt`
# с подписью, проверяет подпись ключом Tor Browser Developers и пишет версию
# и хэши архивов в `src-tauri/src/tor/bundle.json`. Приложение сверяет архив
# с этим файлом, откуда бы его ни скачало, а release.yml по нему же кладёт
# архивы в зеркало на GitHub (релиз `tor-<версия>`).
#
#   scripts/tor-bundle-pin.sh 15.0.25
#
# Свежие версии: https://archive.torproject.org/tor-package-archive/torbrowser/
# (стабильные — без `a` в номере). Нужен gpg (gpgv).
set -euo pipefail

VERSION="${1:?использование: tor-bundle-pin.sh <версия>, например 15.0.25}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/src-tauri/src/tor/bundle.json"
BASE="https://archive.torproject.org/tor-package-archive/torbrowser/$VERSION"
# Tor Browser Developers (signing key) <torbrowser@torproject.org>
KEY_FPR="EF6E286DDA85EA2A4BA7DE684E2C6E8793298290"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

curl -fsSL -o "$WORK/sums.txt" "$BASE/sha256sums-signed-build.txt"
curl -fsSL -o "$WORK/sums.txt.asc" "$BASE/sha256sums-signed-build.txt.asc"
curl -fsSL -o "$WORK/key.asc" "https://keys.openpgp.org/vks/v1/by-fingerprint/$KEY_FPR"

# gpgv без агента и без связки ключей пользователя: доверяем только этому ключу.
gpg --dearmor < "$WORK/key.asc" > "$WORK/key.gpg"
gpgv --keyring "$WORK/key.gpg" "$WORK/sums.txt.asc" "$WORK/sums.txt"

python3 -I - "$WORK/sums.txt" "$VERSION" > "$OUT" <<'PY'
import json, re, sys
path, ver = sys.argv[1], sys.argv[2]
pins = {}
pattern = re.compile(
    r"([0-9a-f]{64})\s+\*?tor-expert-bundle-((?:linux|macos|windows)-[a-z0-9_]+)-"
    + re.escape(ver) + r"\.tar\.gz$"
)
for line in open(path):
    m = pattern.match(line.strip())
    if m:
        pins[m.group(2)] = m.group(1)
if not pins:
    sys.exit("в манифесте нет архивов tor-expert-bundle для " + ver)
print(json.dumps({"version": ver, "sha256": dict(sorted(pins.items()))}, indent=2))
PY

echo "Записано в $OUT:"
cat "$OUT"
