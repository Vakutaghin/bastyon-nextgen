#!/usr/bin/env bash
#
# Создаёт ключ подписи обновлений Tauri (minisign) и кладёт его в секреты
# репозитория, откуда его берёт workflow релиза. Открытую половину пишет в
# src-tauri/tauri.conf.json (plugins.updater.pubkey) — файл нужно закоммитить.
# Запускается один раз, из аккаунта gh с правом записи в репозиторий.
#
#   scripts/updater-signing-key.sh [файл, по умолчанию ~/.tauri/bastyon-nextgen-updater.key]
#
# Приложение ставит обновление, только если подпись latest.json сходится с
# открытым ключом, зашитым в установленную версию. Ключом подписывает сборка
# релиза из секретов, вручную его хранить не нужно. Если секреты пропадут,
# новый ключ поставит только следующая версия, скачанная вручную, — дальше
# снова обновится само. Копия на этом компьютере — запасная.
#
# Пароль скрипт не печатает: на macOS кладёт в Связку ключей, на других
# системах — в файл рядом с ключом.
set -euo pipefail

REPO="${REPO:-Vakutaghin/bastyon-nextgen}"
KEY="${1:-$HOME/.tauri/bastyon-nextgen-updater.key}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONF="$ROOT/src-tauri/tauri.conf.json"
KEYCHAIN_SERVICE="bastyon-nextgen-updater-key"
KEYCHAIN_LABEL="Bastyon NextGen: пароль ключа подписи обновлений"

for tool in openssl node pnpm gh; do
  command -v "$tool" >/dev/null || { echo "Не найден $tool" >&2; exit 1; }
done

if node -e "process.exit(require('$CONF').plugins?.updater?.pubkey ? 0 : 1)"; then
  echo "Открытый ключ обновлений уже в ${CONF#"$ROOT"/}. Новый ключ сломал бы обновление у всех установленных версий" >&2
  exit 1
fi
if ! SECRETS="$(gh secret list --repo "$REPO" --json name --jq '.[].name')"; then
  echo "У аккаунта в gh нет доступа к секретам $REPO" >&2
  exit 1
fi
if grep -qx TAURI_SIGNING_PRIVATE_KEY <<<"$SECRETS"; then
  echo "Ключ подписи обновлений в $REPO уже есть — новый не нужен" >&2
  exit 1
fi
if [ -e "$KEY" ]; then
  echo "$KEY уже существует — укажите другой файл" >&2
  exit 1
fi

uploaded=""
trap '[ -n "$uploaded" ] || rm -f "$KEY" "$KEY.pub" "$KEY.password"' EXIT

mkdir -p "$(dirname "$KEY")"
PASSWORD="$(openssl rand -hex 24)"
(cd "$ROOT" && pnpm --silent tauri signer generate --ci -w "$KEY" -p "$PASSWORD" > /dev/null)
chmod 600 "$KEY"

if command -v security >/dev/null \
  && security add-generic-password -U -a bastyon -s "$KEYCHAIN_SERVICE" \
       -l "$KEYCHAIN_LABEL" -w "$PASSWORD"; then
  PASSWORD_AT="в Связке ключей, запись «$KEYCHAIN_LABEL»"
else
  (umask 077 && printf '%s\n' "$PASSWORD" > "$KEY.password")
  PASSWORD_AT="$KEY.password"
fi

printf '%s' "$PASSWORD" | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo "$REPO"
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo "$REPO" < "$KEY"
uploaded=1

PUBKEY="$(tr -d '\n' < "$KEY.pub")" CONF="$CONF" node -e '
const fs = require("fs")
const conf = JSON.parse(fs.readFileSync(process.env.CONF, "utf8"))
conf.plugins = conf.plugins || {}
conf.plugins.updater = { ...(conf.plugins.updater || {}), pubkey: process.env.PUBKEY }
fs.writeFileSync(process.env.CONF, JSON.stringify(conf, null, 2) + "\n")
'

cat <<EOF

Готово: секреты TAURI_SIGNING_PRIVATE_KEY и TAURI_SIGNING_PRIVATE_KEY_PASSWORD
добавлены в $REPO, открытый ключ — в ${CONF#"$ROOT"/} (закоммитьте).

Запасная копия: $KEY, пароль $PASSWORD_AT.
EOF
