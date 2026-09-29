#!/usr/bin/env bash
# Узел Reticulum для Android: собирает src-tauri/crates/bastyon-rns-jni под
# NDK и кладёт libbastyon_rns_jni.so в android/app/src/main/jniLibs/<ABI>/.
# Вызывается сборкой Gradle (задача buildRnsNative) перед сборкой APK.
#
# Нет cargo, цели Rust или NDK — предупреждает и выходит без ошибки: APK
# собирается без Reticulum, приложение покажет, что узел недоступен.
#
#   RNS_ANDROID_ABIS   — какие ABI (по умолчанию arm64-v8a; ещё x86_64,
#                        armeabi-v7a);
#   RNS_ANDROID_PROFILE — release (по умолчанию) или debug;
#   ANDROID_NDK_HOME   — NDK; иначе самый новый из $ANDROID_HOME/ndk.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CRATES="$ROOT/src-tauri"
OUT="$ROOT/android/app/src/main/jniLibs"
ABIS="${RNS_ANDROID_ABIS:-arm64-v8a}"
PROFILE="${RNS_ANDROID_PROFILE:-release}"
API=24 # minSdkVersion (android/variables.gradle)

skip() {
  echo "warning: build-rns-android: $1 — APK без узла Reticulum" >&2
  exit 0
}

command -v cargo >/dev/null || skip "нет cargo"

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

for ABI in $ABIS; do
  case "$ABI" in
    arm64-v8a) TARGET=aarch64-linux-android; CLANG=aarch64-linux-android$API-clang ;;
    x86_64) TARGET=x86_64-linux-android; CLANG=x86_64-linux-android$API-clang ;;
    armeabi-v7a) TARGET=armv7-linux-androideabi; CLANG=armv7a-linux-androideabi$API-clang ;;
    *) echo "build-rns-android: неизвестный ABI $ABI" >&2; exit 1 ;;
  esac
  if ! rustup target list --installed 2>/dev/null | grep -qx "$TARGET"; then
    skip "нет цели Rust $TARGET (rustup target add $TARGET)"
  fi
  VAR="$(echo "$TARGET" | tr 'a-z-' 'A-Z_')"
  export "CARGO_TARGET_${VAR}_LINKER=$BIN/$CLANG"
  export "CC_${TARGET//-/_}=$BIN/$CLANG"
  export "AR_${TARGET//-/_}=$BIN/llvm-ar"
  FLAGS=()
  [ "$PROFILE" = release ] && FLAGS+=(--release)
  (cd "$CRATES" && cargo build -p bastyon-rns-jni --target "$TARGET" "${FLAGS[@]}")
  mkdir -p "$OUT/$ABI"
  cp "$CRATES/target/$TARGET/$PROFILE/libbastyon_rns_jni.so" "$OUT/$ABI/"
  "$BIN/llvm-strip" --strip-unneeded "$OUT/$ABI/libbastyon_rns_jni.so"
  echo "build-rns-android: $ABI → $(du -h "$OUT/$ABI/libbastyon_rns_jni.so" | cut -f1)"
done
