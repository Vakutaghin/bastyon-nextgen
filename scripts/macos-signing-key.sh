#!/usr/bin/env bash
#
# Создаёт постоянный самоподписанный сертификат подписи macOS и кладёт его в
# секреты репозитория, откуда его берёт workflow релиза. Запускается один раз,
# из аккаунта gh с правом записи в репозиторий: через API секреты задаёт и
# соавтор.
#
#   scripts/macos-signing-key.sh [файл, по умолчанию ~/bastyon-nextgen-macos-signing.p12]
#
# Зачем, если Gatekeeper такой сертификат не признаёт (как и ad-hoc): у
# ad-hoc-подписи требование подписи — хэш самой сборки, и для macOS каждая
# версия — другое приложение. Поэтому после каждого обновления она снова
# спрашивает пароль, чтобы пустить его к ключу сейфа в Связке ключей (его там
# держит WebKit), и заново просит доступ к микрофону и камере. С постоянным
# сертификатом требование у всех версий одно, и после одного «Всегда
# разрешать» вопросов больше нет.
#
# Ключ нельзя отдавать: приложение, подписанное им, macOS пустит к ключу сейфа
# без вопросов. Терять — не страшно, но неудобно: с новым сертификатом пароль
# спросится ещё раз. Файл и пароль сохраните в менеджер паролей.
#
# Пароль скрипт не печатает: на macOS кладёт в Связку ключей, на других
# системах — в файл рядом с ключом. SHA-1 сертификата пишет в
# src-tauri/macos-signing-cert.sha1: по нему workflow релиза проверяет подпись
# приложения, — файл нужно закоммитить.
set -euo pipefail

REPO="${REPO:-Vakutaghin/bastyon-nextgen}"
IDENTITY="Bastyon NextGen"
P12="${1:-$HOME/bastyon-nextgen-macos-signing.p12}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERT_FILE="$ROOT/src-tauri/macos-signing-cert.sha1"
KEYCHAIN_SERVICE="bastyon-nextgen-macos-signing"
KEYCHAIN_LABEL="Bastyon NextGen: пароль сертификата подписи macOS"

for tool in openssl base64 gh; do
  command -v "$tool" >/dev/null || { echo "Не найден $tool" >&2; exit 1; }
done

if [ -e "$CERT_FILE" ]; then
  echo "Сертификат уже создан, его SHA-1 — в ${CERT_FILE#"$ROOT"/}. Если пропали секреты, верните их из резервной копии" >&2
  exit 1
fi
if ! SECRETS="$(gh secret list --repo "$REPO" --json name --jq '.[].name')"; then
  echo "У аккаунта в gh нет доступа к секретам $REPO" >&2
  exit 1
fi
if grep -qx MACOS_SIGNING_P12_B64 <<<"$SECRETS"; then
  echo "Сертификат подписи macOS в $REPO уже есть — новый не нужен" >&2
  exit 1
fi
if [ -e "$P12" ]; then
  echo "$P12 уже существует — укажите другой файл" >&2
  exit 1
fi

# Пока сертификат не ушёл в секреты, он никому не нужен: при сбое скрипт его
# удаляет, и повторный запуск начинает с чистого листа.
WORK="$(mktemp -d)"
uploaded=""
trap 'rm -rf "$WORK"; [ -n "$uploaded" ] || rm -f "$P12" "$P12.password"' EXIT

cat > "$WORK/cert.cnf" <<EOF
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = $IDENTITY
[ext]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature
extendedKeyUsage = critical,codeSigning
EOF
openssl req -x509 -newkey rsa:3072 -nodes -days 10950 -config "$WORK/cert.cnf" \
  -keyout "$WORK/key.pem" -out "$WORK/cert.pem" 2>/dev/null

export P12_PASSWORD
P12_PASSWORD="$(openssl rand -hex 24)"
# `security import` на раннере читает PKCS#12 со старым шифрованием: у
# OpenSSL 3 его включает -legacy, у LibreSSL оно и так по умолчанию.
openssl pkcs12 -export -legacy -inkey "$WORK/key.pem" -in "$WORK/cert.pem" \
  -name "$IDENTITY" -out "$P12" -passout env:P12_PASSWORD 2>/dev/null \
  || openssl pkcs12 -export -inkey "$WORK/key.pem" -in "$WORK/cert.pem" \
       -name "$IDENTITY" -out "$P12" -passout env:P12_PASSWORD
chmod 600 "$P12"

# Пароль сохраняется до отправки: из секретов его уже не прочитать.
if command -v security >/dev/null \
  && security add-generic-password -U -a bastyon -s "$KEYCHAIN_SERVICE" \
       -l "$KEYCHAIN_LABEL" -w "$P12_PASSWORD"; then
  PASSWORD_AT="в Связке ключей, запись «$KEYCHAIN_LABEL»
            (показать: security find-generic-password -s $KEYCHAIN_SERVICE -w)"
else
  (umask 077 && printf '%s\n' "$P12_PASSWORD" > "$P12.password")
  PASSWORD_AT="$P12.password — перенесите в менеджер паролей и удалите файл"
fi

printf '%s' "$P12_PASSWORD" | gh secret set MACOS_SIGNING_P12_PASSWORD --repo "$REPO"
base64 < "$P12" | tr -d '\n' | gh secret set MACOS_SIGNING_P12_B64 --repo "$REPO"
uploaded=1

# Формат как в требовании подписи: `certificate leaf = H"<sha1>"`.
openssl x509 -in "$WORK/cert.pem" -noout -fingerprint -sha1 \
  | sed 's/.*=//' | tr -d ':' | tr 'A-F' 'a-f' > "$CERT_FILE"

cat <<EOF

Готово: секреты MACOS_SIGNING_P12_B64 и MACOS_SIGNING_P12_PASSWORD добавлены в $REPO.

Файл:   $P12
Пароль: $PASSWORD_AT
SHA-1:  $(cat "$CERT_FILE")

Закоммитьте ${CERT_FILE#"$ROOT"/}: по нему workflow релиза проверяет подпись.
Файл и пароль сохраните в менеджер паролей.
EOF
