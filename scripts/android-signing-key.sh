#!/usr/bin/env bash
#
# Создаёт постоянный ключ подписи Android и кладёт его в секреты репозитория,
# откуда его берёт workflow релиза. Запускается один раз, из аккаунта gh с
# правом записи в репозиторий: через API секреты задаёт и соавтор.
#
#   scripts/android-signing-key.sh [файл ключа, по умолчанию ~/bastyon-nextgen-android.keystore]
#
# Android ставит новую версию поверх старой, только если обе подписаны одним
# ключом. Поэтому ключ нельзя терять: без него следующую версию снова придётся
# ставить с удалением приложения. И нельзя отдавать: с ним кто угодно соберёт
# «обновление», которое встанет поверх и получит данные кошелька. Файл ключа и
# пароль сохраните в менеджер паролей.
#
# Пароль скрипт не печатает: на macOS кладёт в Связку ключей, на других
# системах — в файл рядом с ключом. Отпечаток сертификата пишет в
# android/app/release-cert.sha256: по нему workflow релиза проверяет, что APK
# подписан этим ключом, — файл нужно закоммитить.
set -euo pipefail

REPO="${REPO:-Vakutaghin/bastyon-nextgen}"
ALIAS="bastyon"
KEYSTORE="${1:-$HOME/bastyon-nextgen-android.keystore}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERT_FILE="$ROOT/android/app/release-cert.sha256"
KEYCHAIN_SERVICE="bastyon-nextgen-android-keystore"
KEYCHAIN_LABEL="Bastyon NextGen: пароль ключа подписи Android"

for tool in keytool openssl base64 gh; do
  command -v "$tool" >/dev/null || { echo "Не найден $tool" >&2; exit 1; }
done

# Второй ключ сломал бы обновления у всех, кто поставил APK с первым.
if [ -e "$CERT_FILE" ]; then
  echo "Ключ уже создан, его отпечаток — в ${CERT_FILE#"$ROOT"/}. Если пропали секреты, верните их из резервной копии ключа" >&2
  exit 1
fi
if ! SECRETS="$(gh secret list --repo "$REPO" --json name --jq '.[].name')"; then
  echo "У аккаунта в gh нет доступа к секретам $REPO" >&2
  exit 1
fi
if grep -qx ANDROID_KEYSTORE_B64 <<<"$SECRETS"; then
  echo "Ключ подписи Android в $REPO уже есть — новый не нужен" >&2
  exit 1
fi
if [ -e "$KEYSTORE" ]; then
  echo "$KEYSTORE уже существует — укажите другой файл" >&2
  exit 1
fi

# Пока ключ не ушёл в секреты, он никому не нужен: при сбое скрипт его удаляет,
# и повторный запуск начинает с чистого листа.
uploaded=""
trap '[ -n "$uploaded" ] || rm -f "$KEYSTORE" "$KEYSTORE.password"' EXIT

export KEYSTORE_PASSWORD
KEYSTORE_PASSWORD="$(openssl rand -hex 24)"
keytool -genkeypair -keystore "$KEYSTORE" -storetype PKCS12 \
  -storepass:env KEYSTORE_PASSWORD -alias "$ALIAS" \
  -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Bastyon NextGen"
chmod 600 "$KEYSTORE"

# Пароль сохраняется до отправки: из секретов его уже не прочитать.
if command -v security >/dev/null \
  && security add-generic-password -U -a "$ALIAS" -s "$KEYCHAIN_SERVICE" \
       -l "$KEYCHAIN_LABEL" -w "$KEYSTORE_PASSWORD"; then
  PASSWORD_AT="в Связке ключей, запись «$KEYCHAIN_LABEL»
            (показать: security find-generic-password -s $KEYCHAIN_SERVICE -w)"
else
  (umask 077 && printf '%s\n' "$KEYSTORE_PASSWORD" > "$KEYSTORE.password")
  PASSWORD_AT="$KEYSTORE.password — перенесите в менеджер паролей и удалите файл"
fi

printf '%s' "$KEYSTORE_PASSWORD" | gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$REPO"
base64 < "$KEYSTORE" | tr -d '\n' | gh secret set ANDROID_KEYSTORE_B64 --repo "$REPO"
uploaded=1

# Формат как у apksigner: шестнадцатеричные цифры без двоеточий, строчными.
keytool -list -v -keystore "$KEYSTORE" -storepass:env KEYSTORE_PASSWORD \
  | sed -n 's/^[[:space:]]*SHA256: //p' | head -n 1 | tr -d ':' | tr 'A-F' 'a-f' > "$CERT_FILE"

cat <<EOF

Готово: секреты ANDROID_KEYSTORE_B64 и ANDROID_KEYSTORE_PASSWORD добавлены в $REPO.

Файл ключа: $KEYSTORE
Пароль:     $PASSWORD_AT
SHA-256:    $(cat "$CERT_FILE")

Закоммитьте ${CERT_FILE#"$ROOT"/}: по нему workflow релиза проверяет подпись APK.
Файл ключа и пароль сохраните в менеджер паролей. Потерянный ключ не
восстановить, а с новым обновление снова встанет только после удаления
приложения.
EOF
