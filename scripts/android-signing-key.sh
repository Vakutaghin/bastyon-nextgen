#!/usr/bin/env bash
#
# Создаёт постоянный ключ подписи Android и кладёт его в секреты репозитория,
# откуда его берёт workflow релиза. Запускается один раз, владельцем
# репозитория: секреты может добавить только он.
#
#   scripts/android-signing-key.sh [файл ключа, по умолчанию ~/bastyon-nextgen-android.keystore]
#
# Android ставит новую версию поверх старой, только если обе подписаны одним
# ключом. Поэтому ключ нельзя терять: без него следующую версию снова придётся
# ставить с удалением приложения. И нельзя отдавать: с ним кто угодно соберёт
# «обновление», которое встанет поверх и получит данные кошелька. Файл ключа и
# пароль, который скрипт напечатает, сохраните в менеджер паролей.
set -euo pipefail

REPO="${REPO:-Vakutaghin/bastyon-nextgen}"
ALIAS="bastyon"
KEYSTORE="${1:-$HOME/bastyon-nextgen-android.keystore}"

for tool in keytool openssl base64 gh; do
  command -v "$tool" >/dev/null || { echo "Не найден $tool" >&2; exit 1; }
done

if [ "$(gh api "repos/$REPO" --jq .permissions.admin)" != "true" ]; then
  echo "Секреты $REPO может добавить только его владелец: войдите в gh под ним" >&2
  exit 1
fi
# Второй ключ сломал бы обновления у всех, кто поставил APK с первым.
SECRETS="$(gh secret list --repo "$REPO" --json name --jq '.[].name')"
if grep -qx ANDROID_KEYSTORE_B64 <<<"$SECRETS"; then
  echo "Ключ подписи Android в $REPO уже есть — новый не нужен" >&2
  exit 1
fi
if [ -e "$KEYSTORE" ]; then
  echo "$KEYSTORE уже существует — укажите другой файл" >&2
  exit 1
fi

export KEYSTORE_PASSWORD
KEYSTORE_PASSWORD="$(openssl rand -hex 24)"
keytool -genkeypair -keystore "$KEYSTORE" -storetype PKCS12 \
  -storepass:env KEYSTORE_PASSWORD -alias "$ALIAS" \
  -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Bastyon NextGen"
chmod 600 "$KEYSTORE"

# Пароль первым: по секрету с ключом скрипт узнаёт, что ключ уже есть.
printf '%s' "$KEYSTORE_PASSWORD" | gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$REPO"
base64 < "$KEYSTORE" | tr -d '\n' | gh secret set ANDROID_KEYSTORE_B64 --repo "$REPO"

FINGERPRINT="$(keytool -list -v -keystore "$KEYSTORE" -storepass:env KEYSTORE_PASSWORD \
  | sed -n 's/^[[:space:]]*SHA256: //p' | head -n 1)"

cat <<EOF

Готово: секреты ANDROID_KEYSTORE_B64 и ANDROID_KEYSTORE_PASSWORD добавлены в $REPO.

Файл ключа: $KEYSTORE
Пароль:     $KEYSTORE_PASSWORD
SHA-256:    $FINGERPRINT

Сохраните файл и пароль в менеджер паролей. Потерянный ключ не восстановить,
а с новым обновление снова встанет только после удаления приложения.
Отпечаток SHA-256 workflow релиза печатает в логе — по нему видно, что APK
подписан этим ключом.
EOF
