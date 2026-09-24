#!/usr/bin/env bash
#
# Собирает тело GitHub Release: инструкцию «что скачать и как поставить» на двух
# языках (`.github/release-body.md`) плюс заметки к версии из `changelogs/`.
#
# Один источник для CI и для ручной правки уже опубликованного релиза:
#   scripts/release-body.sh v0.3.0 > body.md && gh release edit v0.3.0 --notes-file body.md
set -euo pipefail

TAG="${1:?использование: release-body.sh <tag>, например v0.3.0}"
VERSION="${TAG#v}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

sed "s/__VERSION__/${VERSION}/g" "$ROOT/.github/release-body.md"

# Заметки релиза — под спойлером, чтобы инструкция оставалась первым, что видно.
for lang in ru en; do
  file="$ROOT/changelogs/$TAG/$lang.desc.md"
  [ -f "$file" ] || continue
  if [ "$lang" = "ru" ]; then
    summary="Что нового в $TAG"
  else
    summary="What's new in $TAG"
  fi
  printf '\n<details>\n<summary><b>%s</b></summary>\n\n' "$summary"
  cat "$file"
  printf '\n</details>\n'
done
