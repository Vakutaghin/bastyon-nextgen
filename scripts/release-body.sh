#!/usr/bin/env bash
#
# Собирает тело GitHub Release из `.github/release-body.md`: инструкцию «что
# скачать и как поставить» на двух языках плюс заметки к версии из `changelogs/`.
# Страница получается свёрнутой: видны таблица файлов и заголовок с кратким
# описанием версии, а заметки по разделам, установка по системам и английская
# часть раскрываются по клику (<details>).
#
# Один источник для CI и для ручной правки уже опубликованного релиза:
#   scripts/release-body.sh v0.3.0 > body.md && gh release edit v0.3.0 --notes-file body.md
set -euo pipefail

TAG="${1:?использование: release-body.sh <tag>, например v0.3.0}"
VERSION="${TAG#v}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Заметки версии: заголовок и вводный абзац остаются на виду, каждый раздел
# `## Название` сворачивается. Нет файла — на месте заметок ничего.
changelog() {
  local file="$ROOT/changelogs/$TAG/$1.desc.md"
  [ -f "$file" ] || return 0
  awk '
    NR == 1 && /^# / { sub(/^# /, ""); print "**" $0 "**"; next }
    /^## / {
      if (open) print "\n</details>\n"
      sub(/^## /, "")
      print "<details>\n<summary><b>" $0 "</b></summary>\n"
      open = 1
      next
    }
    { print }
    END { if (open) print "\n</details>" }
  ' "$file"
}

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    __CHANGELOG_RU__) changelog ru ;;
    __CHANGELOG_EN__) changelog en ;;
    *) printf '%s\n' "$line" ;;
  esac
done < "$ROOT/.github/release-body.md" | sed "s/__VERSION__/${VERSION}/g"
