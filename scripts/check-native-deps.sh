#!/usr/bin/env bash
# Собранная программа запустится на чистой системе из заявленных:
# - macOS (.app): библиотеки только из macOS. Homebrew-овская liblzma
#   (/opt/homebrew/...) не давала 0.9.0–0.9.4 для Apple Silicon запуститься на Mac
#   без Homebrew. Минимальная macOS в бинаре не выше LSMinimumSystemVersion
#   (для arm64 — не выше 11.0: раньше Apple Silicon не бывает).
# - Windows (.exe): никаких DLL рантайма Visual C++ (MSVCP140, VCRUNTIME140…):
#   их ставит отдельный пакет, а на чистой Windows его нет.
#
# Запуск: scripts/check-native-deps.sh <путь к .app или .exe>
#   Программа macOS без бандла (модуль mesh-сетей) — вторым аргументом .app,
#   чья LSMinimumSystemVersion к ней относится:
#   scripts/check-native-deps.sh mesh-module/bastyon-mesh <путь к .app>
set -euo pipefail

target="${1:?нужен путь к .app или .exe}"
fail() {
  echo "::error::$*" >&2
  exit 1
}

# Исполняемый файл macOS: только системные библиотеки и не выше заявленной macOS.
check_macho() {
  local bin="$1" declared="$2"
  [ -f "$bin" ] || fail "Нет исполняемого файла $bin"

  foreign="$(otool -L "$bin" | tail -n +2 | awk '{print $1}' |
    grep -v -E '^(/System/Library/|/usr/lib/|@rpath/|@executable_path/|@loader_path/)' || true)"
  [ -z "$foreign" ] || fail "$bin ссылается на библиотеки не из macOS, на Mac пользователя их нет: $foreign"

  for arch in $(lipo -archs "$bin"); do
    minos="$(otool -arch "$arch" -l "$bin" | awk '/LC_BUILD_VERSION/ { f = 1 } f && $1 == "minos" { print $2; exit }')"
    [ -n "$minos" ] || minos="$(otool -arch "$arch" -l "$bin" |
      awk '/LC_VERSION_MIN_MACOSX/ { f = 1 } f && $1 == "version" { print $2; exit }')"
    floor="$declared"
    if [ "$arch" = arm64 ] && [ "$(printf '%s\n%s\n' "$declared" 11.0 | sort -V | tail -n 1)" = 11.0 ]; then
      floor=11.0
    fi
    [ "$(printf '%s\n%s\n' "$minos" "$floor" | sort -V | tail -n 1)" = "$floor" ] ||
      fail "$bin ($arch) требует macOS $minos, а заявлено $declared"
    echo "$arch: macOS от $minos (заявлено $declared), библиотеки только системные"
  done
}

min_macos() {
  /usr/libexec/PlistBuddy -c 'Print :LSMinimumSystemVersion' "${1%/}/Contents/Info.plist"
}

case "$target" in
  *.app | *.app/)
    app="${target%/}"
    plist="$app/Contents/Info.plist"
    check_macho "$app/Contents/MacOS/$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$plist")" \
      "$(min_macos "$app")"
    ;;

  *.exe)
    readobj="$(command -v llvm-readobj || true)"
    if [ -z "$readobj" ] && [ -x "/c/Program Files/LLVM/bin/llvm-readobj.exe" ]; then
      readobj="/c/Program Files/LLVM/bin/llvm-readobj.exe"
    fi
    [ -n "$readobj" ] || fail "Нет llvm-readobj, импорты не проверить"
    [ -f "$target" ] || fail "Нет файла $target"

    dlls="$("$readobj" --coff-imports "$target" | awk '/^ *Name: / { print $2 }' | sort -u)"
    echo "DLL, которые грузит $target:"
    echo "$dlls" | sed 's/^/  /'
    runtime="$(echo "$dlls" | grep -i -E '^(msvcp|vcruntime|concrt|vcomp|vccorlib)[0-9_]*\.dll$' || true)"
    [ -z "$runtime" ] || fail "$target требует рантайм Visual C++, которого нет на чистой Windows: $runtime"
    echo "Рантайм Visual C++ не нужен"
    ;;

  *)
    app="${2:-}"
    if [ -n "$app" ] && file "$target" | grep -q 'Mach-O'; then
      check_macho "$target" "$(min_macos "$app")"
    else
      fail "Не знаю, как проверить $target: нужен .app, .exe или программа macOS и её .app"
    fi
    ;;
esac
