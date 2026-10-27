#!/usr/bin/env bash
# Голосовой ввод для Android: собирает src-tauri/crates/bastyon-asr-jni
# (whisper.cpp и детектор речи — тот же движок, что у компьютера) под NDK и
# кладёт libbastyon_asr_jni.so и libc++_shared.so в
# android/app/src/main/jniLibs/<ABI>/. Вызывается сборкой Gradle (задача
# buildAsrNative) перед сборкой APK.
#
# Нет cargo, цели Rust, NDK или cmake — предупреждает и выходит без ошибки:
# APK собирается без голосового ввода, кнопки диктовки в нём просто нет.
#
#   ASR_ANDROID_ABIS    — какие ABI (по умолчанию только arm64-v8a: на
#                         32-битных телефонах распознавание слишком медленное;
#                         x86_64 — для эмулятора);
#   ASR_ANDROID_PROFILE — release (по умолчанию) или debug;
#   ANDROID_NDK_HOME    — NDK; иначе самый новый из $ANDROID_HOME/ndk.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CRATES="$ROOT/src-tauri"
OUT="$ROOT/android/app/src/main/jniLibs"
ABIS="${ASR_ANDROID_ABIS:-arm64-v8a}"
PROFILE="${ASR_ANDROID_PROFILE:-release}"
API=24 # minSdkVersion (android/variables.gradle)

skip() {
  echo "warning: build-asr-android: $1 — APK без голосового ввода" >&2
  exit 0
}

command -v cargo >/dev/null || skip "нет cargo"
command -v cmake >/dev/null || skip "нет cmake"

NDK="${ANDROID_NDK_HOME:-${ANDROID_NDK_LATEST_HOME:-}}"
if [ -z "$NDK" ]; then
  SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
  if [ -d "$SDK/ndk" ]; then
    NDK="$(ls -d "$SDK"/ndk/* 2>/dev/null | sort -V | tail -n 1)"
  fi
fi
[ -n "$NDK" ] && [ -d "$NDK" ] || skip "нет Android NDK"
PREBUILT="$(ls -d "$NDK"/toolchains/llvm/prebuilt/* 2>/dev/null | head -n 1)"
[ -n "$PREBUILT" ] || skip "в NDK нет toolchains/llvm"
BIN="$PREBUILT/bin"
export ANDROID_NDK_HOME="$NDK"

WORK="$CRATES/target/asr-android"
mkdir -p "$WORK"

for ABI in $ABIS; do
  case "$ABI" in
    arm64-v8a) TARGET=aarch64-linux-android; CLANG=aarch64-linux-android$API-clang ;;
    x86_64) TARGET=x86_64-linux-android; CLANG=x86_64-linux-android$API-clang ;;
    *) echo "build-asr-android: неизвестный ABI $ABI" >&2; exit 1 ;;
  esac
  if ! rustup target list --installed 2>/dev/null | grep -qx "$TARGET"; then
    skip "нет цели Rust $TARGET (rustup target add $TARGET)"
  fi
  VAR="$(echo "$TARGET" | tr 'a-z-' 'A-Z_')"
  UNDER="${TARGET//-/_}"
  export "CARGO_TARGET_${VAR}_LINKER=$BIN/$CLANG"
  export "CC_${UNDER}=$BIN/$CLANG"
  export "CXX_${UNDER}=$BIN/$CLANG++"
  export "AR_${UNDER}=$BIN/llvm-ar"

  # whisper.cpp собирает cmake: обёртка над тулчейном NDK с нужными ABI и API.
  TOOLCHAIN="$WORK/$ABI.toolchain.cmake"
  cat >"$TOOLCHAIN" <<EOF
set(ANDROID_ABI $ABI)
set(ANDROID_PLATFORM android-$API)
set(ANDROID_STL c++_shared)
include("$NDK/build/cmake/android.toolchain.cmake")
EOF
  export "CMAKE_TOOLCHAIN_FILE_${UNDER}=$TOOLCHAIN"
  # Привязки whisper.h для целевой платформы — с заголовками NDK.
  export "BINDGEN_EXTRA_CLANG_ARGS_${UNDER}=--sysroot=$PREBUILT/sysroot --target=$TARGET$API"

  # Сборочный скрипт whisper-rs-sys решает по ХОСТУ: на Mac он требует
  # ggml-blas, которого в сборке под Android нет. Пустая библиотека вместо неё.
  STUBS="$WORK/$ABI-stubs"
  mkdir -p "$STUBS"
  [ -f "$STUBS/libggml-blas.a" ] || "$BIN/llvm-ar" rcs "$STUBS/libggml-blas.a"
  # Страницы 16 КБ (Android 15 на части телефонов): без выравнивания
  # библиотека там не загрузится.
  export "CARGO_TARGET_${VAR}_RUSTFLAGS=-L native=$STUBS -C link-arg=-Wl,-z,max-page-size=16384"

  FLAGS=()
  [ "$PROFILE" = release ] && FLAGS+=(--release)
  (cd "$CRATES" && cargo build -p bastyon-asr-jni --target "$TARGET" "${FLAGS[@]}")

  mkdir -p "$OUT/$ABI"
  cp "$CRATES/target/$TARGET/$PROFILE/libbastyon_asr_jni.so" "$OUT/$ABI/"
  "$BIN/llvm-strip" --strip-unneeded "$OUT/$ABI/libbastyon_asr_jni.so"
  # whisper.cpp — C++: стандартная библиотека NDK едет рядом.
  case "$TARGET" in
    aarch64-linux-android) LIBCXX="$PREBUILT/sysroot/usr/lib/aarch64-linux-android/libc++_shared.so" ;;
    x86_64-linux-android) LIBCXX="$PREBUILT/sysroot/usr/lib/x86_64-linux-android/libc++_shared.so" ;;
  esac
  cp "$LIBCXX" "$OUT/$ABI/"
  echo "build-asr-android: $ABI → $(du -h "$OUT/$ABI/libbastyon_asr_jni.so" | cut -f1)"
done
