#!/usr/bin/env bash
# Tor для Android, встроенный в APK. Вызывается сборкой Gradle (задача
# buildTorNative) перед сборкой APK:
#
#  - собирает src-tauri/crates/bastyon-tor-jni (логика Tor, общая с
#    компьютером) под NDK → jniLibs/<ABI>/libbastyon_tor_jni.so;
#  - берёт tor-expert-bundle для Android той версии и с тем хэшем, что
#    закреплены в src-tauri/src/tor/bundle.json (scripts/tor-bundle-pin.sh),
#    и кладёт tor и lyrebird в jniLibs/<ABI>/ как libtor.so и liblyrebird.so:
#    запускать программы Android 10+ разрешает только из каталога библиотек
#    приложения. conjure-client не берётся (+15 МБ на ABI, мостов conjure
#    приложение не предлагает). pt_config.json бандла — в assets/tor/.
#
# Нет cargo, цели Rust, NDK или бандл не скачался — предупреждает и выходит
# без ошибки: APK собирается без Tor, в настройках он будет недоступен.
#
#   TOR_ANDROID_ABIS    — какие ABI (по умолчанию arm64-v8a и armeabi-v7a, как
#                         у узла Reticulum; x86_64 — для эмулятора);
#   TOR_ANDROID_PROFILE — release (по умолчанию) или debug;
#   ANDROID_NDK_HOME    — NDK; иначе самый новый из $ANDROID_HOME/ndk.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CRATES="$ROOT/src-tauri"
OUT="$ROOT/android/app/src/main/jniLibs"
ASSETS="$ROOT/android/app/src/main/assets/tor"
CACHE="$ROOT/android/app/build/tor-bundle"
PIN="$CRATES/src/tor/bundle.json"
ABIS="${TOR_ANDROID_ABIS:-arm64-v8a armeabi-v7a}"
PROFILE="${TOR_ANDROID_PROFILE:-release}"
API=24 # minSdkVersion (android/variables.gradle)
# Как у компьютера (src-tauri/src/tor/installer.rs): сначала зеркало в
# релизах репозитория — torproject.org в РФ заблокирован.
MIRROR="https://github.com/Vakutaghin/bastyon-nextgen/releases/download"
ARCHIVE="https://archive.torproject.org/tor-package-archive/torbrowser"
DIST="https://dist.torproject.org/torbrowser"

skip() {
  echo "warning: build-tor-android: $1 — APK без Tor" >&2
  exit 0
}

command -v cargo >/dev/null || skip "нет cargo"
command -v python3 >/dev/null || skip "нет python3"

NDK="${ANDROID_NDK_HOME:-${ANDROID_NDK_LATEST_HOME:-}}"
if [ -z "$NDK" ]; then
  SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
  if [ -d "$SDK/ndk" ]; then
    NDK="$(ls -d "$SDK"/ndk/* 2>/dev/null | sort -V | tail -n 1)"
  fi
fi
[ -n "$NDK" ] && [ -d "$NDK" ] || skip "нет Android NDK"
BIN="$(ls -d "$NDK"/toolchains/llvm/prebuilt/*/bin 2>/dev/null | head -n 1)"
[ -n "$BIN" ] || skip "в NDK нет toolchains/llvm"

pin() { python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d["version"] if sys.argv[2]=="version" else d["sha256"].get(sys.argv[2],""))' "$PIN" "$1"; }
VERSION="$(pin version)"

sha256() {
  if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# Архив бандла в кэше сборки; скачанный с чужим хэшем не остаётся.
fetch_bundle() {
  local platform="$1" expected name file url
  expected="$(pin "$platform")"
  [ -n "$expected" ] || skip "в bundle.json нет $platform"
  name="tor-expert-bundle-$platform-$VERSION.tar.gz"
  file="$CACHE/$name"
  mkdir -p "$CACHE"
  if [ -f "$file" ] && [ "$(sha256 "$file")" = "$expected" ]; then
    echo "$file"
    return
  fi
  for url in "$MIRROR/tor-$VERSION/$name" "$ARCHIVE/$VERSION/$name" "$DIST/$VERSION/$name"; do
    rm -f "$file.part"
    if curl -fsSL --retry 2 --connect-timeout 20 -o "$file.part" "$url" 2>/dev/null; then
      if [ "$(sha256 "$file.part")" = "$expected" ]; then
        mv "$file.part" "$file"
        echo "$file"
        return
      fi
      echo "warning: build-tor-android: $url — не тот SHA-256" >&2
    fi
  done
  rm -f "$file.part"
  skip "не скачался $name"
}

for ABI in $ABIS; do
  case "$ABI" in
    arm64-v8a) TARGET=aarch64-linux-android; CLANG=aarch64-linux-android$API-clang; PLATFORM=android-aarch64 ;;
    x86_64) TARGET=x86_64-linux-android; CLANG=x86_64-linux-android$API-clang; PLATFORM=android-x86_64 ;;
    armeabi-v7a) TARGET=armv7-linux-androideabi; CLANG=armv7a-linux-androideabi$API-clang; PLATFORM=android-armv7 ;;
    *) echo "build-tor-android: неизвестный ABI $ABI" >&2; exit 1 ;;
  esac
  if ! rustup target list --installed 2>/dev/null | grep -qx "$TARGET"; then
    skip "нет цели Rust $TARGET (rustup target add $TARGET)"
  fi

  ARCHIVE_FILE="$(fetch_bundle "$PLATFORM")"
  WORK="$(mktemp -d)"
  tar -xzf "$ARCHIVE_FILE" -C "$WORK" tor/libTor.so tor/pluggable_transports/lyrebird tor/pluggable_transports/pt_config.json
  mkdir -p "$OUT/$ABI" "$ASSETS"
  install -m 755 "$WORK/tor/libTor.so" "$OUT/$ABI/libtor.so"
  install -m 755 "$WORK/tor/pluggable_transports/lyrebird" "$OUT/$ABI/liblyrebird.so"
  install -m 644 "$WORK/tor/pluggable_transports/pt_config.json" "$ASSETS/pt_config.json"
  rm -rf "$WORK"

  VAR="$(echo "$TARGET" | tr 'a-z-' 'A-Z_')"
  export "CARGO_TARGET_${VAR}_LINKER=$BIN/$CLANG"
  export "CC_${TARGET//-/_}=$BIN/$CLANG"
  export "AR_${TARGET//-/_}=$BIN/llvm-ar"
  FLAGS=()
  [ "$PROFILE" = release ] && FLAGS+=(--release)
  (cd "$CRATES" && cargo build -p bastyon-tor-jni --target "$TARGET" "${FLAGS[@]}")
  cp "$CRATES/target/$TARGET/$PROFILE/libbastyon_tor_jni.so" "$OUT/$ABI/"
  "$BIN/llvm-strip" --strip-unneeded "$OUT/$ABI/libbastyon_tor_jni.so"
  echo "build-tor-android: $ABI → Tor $VERSION, $(du -ch "$OUT/$ABI"/libtor.so "$OUT/$ABI"/liblyrebird.so "$OUT/$ABI"/libbastyon_tor_jni.so | tail -n 1 | cut -f1)"
done
