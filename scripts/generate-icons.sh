#!/usr/bin/env bash
#
# Перерисовывает иконки и заставки приложения из круглого логотипа
# public/img/bastyon_logo_round.svg (знак на белом круге). Сменили логотип —
# положите новый SVG на его место, запустите скрипт и закоммитьте результат:
#
#   scripts/generate-icons.sh
#
# Что получается:
#   - веб: фавикон, иконки PWA и значок iOS «На экран Домой» в public/img;
#   - десктоп: src-tauri/icons — круг как есть, а для macOS знак на белом
#     скруглённом квадрате по сетке Apple: круглую иконку macOS 26 сажает
#     в серую подложку;
#   - Android: адаптивная иконка (знак на белом фоне), иконки для Android 7
#     и заставки;
#   - iOS: иконка и заставка.
# Знак без круга скрипт вырезает сам, убирая из SVG элемент <circle>.
# Логотипы в шапке (public/img/bastyon_logo_black.svg и _white.svg) — отдельные
# SVG со словом BASTYON: при смене знака их правят руками.
#
# Нужны rsvg-convert и ImageMagick 7 (brew install librsvg imagemagick),
# зависимости проекта (tauri icon) и macOS ради iconutil.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/public/img/bastyon_logo_round.svg"
IMG="$ROOT/public/img"
RES="$ROOT/android/app/src/main/res"
IOS="$ROOT/ios/App/App/Assets.xcassets"

for tool in rsvg-convert magick iconutil; do
  command -v "$tool" >/dev/null || { echo "Не найден $tool" >&2; exit 1; }
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 8 бит на канал и без даты в PNG: иначе файлы вдвое тяжелее, а каждый прогон
# меняет их все.
PNG_OPTS=(-depth 8 -strip -define png:exclude-chunks=date,time)

# Знак без белого круга, обрезанный по краям рисунка.
sed '/<circle/d' "$SRC" >"$TMP/mark.svg"
if cmp -s "$SRC" "$TMP/mark.svg"; then
  echo "В $SRC нет <circle>: не из чего вырезать знак" >&2
  exit 1
fi
rsvg-convert -w 4096 "$TMP/mark.svg" | magick - -trim +repage "$TMP/mark.png"

# badge <сторона> <файл>: круглый логотип как есть, углы прозрачные.
badge() {
  rsvg-convert -w "$1" -h "$1" "$SRC" | magick - "${PNG_OPTS[@]}" "$2"
}

# padded_badge <сторона> <диаметр круга> <файл>: круг с полями по краям.
padded_badge() {
  rsvg-convert -w "$2" -h "$2" "$SRC" |
    magick - -background none -gravity center -extent "$1x$1" "${PNG_OPTS[@]}" "$3"
}

# mark_on <ширина>x<высота> <ширина знака> <фон> <файл>: знак посередине.
# На непрозрачном фоне PNG пишется без альфа-канала: App Store иначе не примет
# иконку.
mark_on() {
  local alpha=()
  [ "$3" = none ] || alpha=(-alpha off)
  magick -size "$1" "xc:$3" \( "$TMP/mark.png" -resize "$2x$2" \) \
    -gravity center -composite ${alpha[@]+"${alpha[@]}"} "${PNG_OPTS[@]}" "$4"
}

# Во всех иконках на белом фоне знак занимает 64 % видимой стороны.
mark_width() { echo $(($1 * 64 / 100)); }

# dp → px для плотности экрана Android (множитель 1..4, бывает 1.5).
px() { awk -v v="$1" -v k="$2" 'BEGIN { printf "%d", v * k + 0.5 }'; }

echo "Веб"
badge 32 "$IMG/favicon-32.png"
badge 192 "$IMG/icon-192.png"
badge 512 "$IMG/icon-512.png"
# Маскируемую иконку система обрезает кругом или скруглённым квадратом;
# гарантированно видна середина — круг диаметром 80 % стороны.
mark_on 512x512 "$(mark_width 410)" white "$IMG/icon-maskable-512.png"
# iOS скругляет углы сама, прозрачность заливает чёрным.
mark_on 180x180 "$(mark_width 180)" white "$IMG/apple-touch-icon.png"

echo "Десктоп"
badge 1024 "$TMP/badge-1024.png"
out="$("$ROOT/node_modules/.bin/tauri" icon "$TMP/badge-1024.png" -o "$ROOT/src-tauri/icons" 2>&1)" ||
  { echo "$out" >&2; exit 1; }
# macOS: белый скруглённый квадрат 824 px на холсте 1024 с лёгкой тенью.
# Контур — суперэллипс |x|^5 + |y|^5 = r^5, он почти совпадает с формой Apple.
awk -v r=412 -v c=512 'BEGIN {
  printf "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1024\" height=\"1024\"><path fill=\"#fff\" d=\""
  for (i = 0; i < 1440; i++) {
    t = i * 3.14159265358979 / 720; ct = cos(t); st = sin(t)
    x = c + r * (ct < 0 ? -1 : 1) * (ct < 0 ? -ct : ct) ^ 0.4
    y = c + r * (st < 0 ? -1 : 1) * (st < 0 ? -st : st) ^ 0.4
    printf "%s%.2f,%.2f", (i ? "L" : "M"), x, y
  }
  print "Z\"/></svg>"
}' >"$TMP/squircle.svg"
rsvg-convert "$TMP/squircle.svg" -o "$TMP/squircle.png"
magick "$TMP/squircle.png" -alpha extract -blur 0x8 -background black -alpha shape \
  -channel A -evaluate multiply 0.3 +channel "$TMP/shadow.png"
magick -size 1024x1024 xc:none "$TMP/shadow.png" -geometry +0+10 -composite \
  "$TMP/squircle.png" -geometry +0+0 -composite \
  \( "$TMP/mark.png" -resize "$(mark_width 824)x$(mark_width 824)" \) -gravity center -composite \
  "$TMP/macos.png"
mkdir "$TMP/icon.iconset"
for s in 16 32 128 256 512; do
  magick "$TMP/macos.png" -resize "${s}x${s}" "${PNG_OPTS[@]}" "$TMP/icon.iconset/icon_${s}x${s}.png"
  magick "$TMP/macos.png" -resize "$((s * 2))x$((s * 2))" "${PNG_OPTS[@]}" \
    "$TMP/icon.iconset/icon_${s}x${s}@2x.png"
done
iconutil -c icns "$TMP/icon.iconset" -o "$ROOT/src-tauri/icons/icon.icns"

echo "Android"
# Адаптивная иконка: холст 108 dp, лаунчер показывает середину 72 dp под своей
# маской, фон — @color/ic_launcher_background. Для Android 7 — круг 44 dp на 48.
for density in mdpi:1 hdpi:1.5 xhdpi:2 xxhdpi:3 xxxhdpi:4; do
  name="${density%%:*}"
  k="${density##*:}"
  canvas="$(px 108 "$k")"
  mark_on "${canvas}x${canvas}" "$(px "$(mark_width 72)" "$k")" none \
    "$RES/mipmap-$name/ic_launcher_foreground.png"
  padded_badge "$(px 48 "$k")" "$(px 44 "$k")" "$RES/mipmap-$name/ic_launcher.png"
  padded_badge "$(px 48 "$k")" "$(px 44 "$k")" "$RES/mipmap-$name/ic_launcher_round.png"
done
# Заставка: знак на белом, 102 dp — как на системной заставке Android 12+,
# которая рисует адаптивную иконку в 240 dp вместо 108.
for file in "$RES"/drawable*/splash.png; do
  case "$(basename "$(dirname "$file")")" in
    *xxxhdpi) k=4 ;;
    *xxhdpi) k=3 ;;
    *xhdpi) k=2 ;;
    *hdpi) k=1.5 ;;
    *) k=1 ;;
  esac
  mark_on "$(magick identify -format '%wx%h' "$file")" "$(px 102 "$k")" white "$file"
done

echo "iOS"
mark_on 1024x1024 "$(mark_width 1024)" white "$IOS/AppIcon.appiconset/AppIcon-512@2x.png"
# Заставку iOS растягивает на весь экран с обрезкой: 330 px из 2732 — около
# 100 pt на iPhone.
for file in "$IOS"/Splash.imageset/splash-2732x2732*.png; do
  mark_on 2732x2732 330 white "$file"
done
