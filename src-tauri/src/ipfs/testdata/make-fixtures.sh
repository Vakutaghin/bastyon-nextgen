#!/usr/bin/env bash
# CAR-фикстуры для verify.rs. Нужен Kubo (тесты сняты на v0.43.0), сеть не нужна:
# репозиторий временный, всё добавляется офлайн. Содержимое файлов детерминировано
# (pattern ниже) — тест пересчитывает его сам, оригиналы не храним.
#   bash src-tauri/src/ipfs/testdata/make-fixtures.sh
set -euo pipefail
cd "$(dirname "$0")"
OUT=$PWD
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
export IPFS_PATH="$WORK/repo" IPFS_TELEMETRY=off
ipfs init --profile=test >/dev/null

# Байт i файла длиной n: (i * 37 + 11) mod 256 — тот же расчёт в verify.rs::tests::pattern.
pattern() { python3 -c "import sys; sys.stdout.buffer.write(bytes((i*37+11)%256 for i in range($1)))"; }

cd "$WORK"
printf 'hello bastyon\n' > small.txt
pattern 1000 > v0-chunked.bin
pattern 6000 > v1-deep.bin
mkdir -p site/assets
printf '<h1>hi</h1>\n' > site/index.html
pattern 3000 > site/assets/app.js
mkdir -p big-dir
for i in $(seq 0 299); do printf 'entry %s\n' "$i" > "big-dir/f$i.txt"; done

{
  # CIDv0: dag-pb-листья (UnixFS Raw) под корнем File.
  echo "SMALL_V0=$(ipfs add -Q small.txt)"
  echo "CHUNKED_V0=$(ipfs add -Q --chunker=size-64 v0-chunked.bin)"
  # CIDv1 + raw-листья, 188 кусков > 174 ссылок на узел → дерево глубины 2.
  echo "DEEP_V1=$(ipfs add -Q --cid-version=1 --raw-leaves --chunker=size-32 v1-deep.bin)"
  echo "SITE_V1=$(ipfs add -Q -r --cid-version=1 --chunker=size-256 site)"
} > "$OUT/cids.env"

mkdir -p inline-dir
printf 'hi\n' > inline-dir/a.txt
{
  # identity: мелкие блоки лежат прямо в CID, в CAR их нет.
  echo "INLINE_V1=$(ipfs add -Q -r --cid-version=1 --inline --inline-limit=64 inline-dir)"
  echo "SHA512_V1=$(ipfs add -Q --cid-version=1 --hash=sha2-512 small.txt)"
  # blake3 verify.rs не проверяет — должен отказать, а не пропустить.
  echo "BLAKE3_V1=$(ipfs add -Q --cid-version=1 --hash=blake3 small.txt)"
} >> "$OUT/cids.env"

# HAMT: порог шардирования 1 байт — каталог шардируется при любом размере.
ipfs config --json Import.UnixFSHAMTDirectorySizeThreshold '"1B"'
echo "HAMT_V1=$(ipfs add -Q -r --cid-version=1 big-dir)" >> "$OUT/cids.env"

# Один CID во всех multibase, которые разбирает Cid::parse.
source "$OUT/cids.env"
{
  echo "SMALL_V1_B32=$(ipfs cid format -v 1 -b base32 "$SMALL_V0")"
  echo "SMALL_V1_B32UP=$(ipfs cid format -v 1 -b base32upper "$SMALL_V0")"
  echo "SMALL_V1_B36=$(ipfs cid format -v 1 -b base36 "$SMALL_V0")"
  echo "SMALL_V1_B58=$(ipfs cid format -v 1 -b base58btc "$SMALL_V0")"
  echo "SMALL_V1_B16=$(ipfs cid format -v 1 -b base16 "$SMALL_V0")"
} >> "$OUT/cids.env"

source "$OUT/cids.env"
ipfs dag export "$SMALL_V0" > "$OUT/small-v0.car"
ipfs dag export "$CHUNKED_V0" > "$OUT/chunked-v0.car"
ipfs dag export "$DEEP_V1" > "$OUT/deep-v1.car"
ipfs dag export "$SITE_V1" > "$OUT/site-v1.car"
ipfs dag export "$HAMT_V1" > "$OUT/hamt-v1.car"
ipfs dag export "$INLINE_V1" > "$OUT/inline-v1.car"
ipfs dag export "$SHA512_V1" > "$OUT/sha512-v1.car"
ipfs dag export "$BLAKE3_V1" > "$OUT/blake3-v1.car"
ls -la "$OUT"
cat "$OUT/cids.env"
