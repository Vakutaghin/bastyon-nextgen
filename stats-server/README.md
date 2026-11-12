# Сервер анонимной статистики

Принимает отметки приложения и показывает, сколько людей пользуется новым Bastyon: по дням, неделям, месяцам и времени суток. Клиентская часть — [src/helpers/usage-stats](../src/helpers/usage-stats).

**Сейчас статистика выключена.** Адреса сервера в коде нет: приложение шлёт отметки, только если его собрали с `VITE_USAGE_STATS_URL=https://<сервер>:8460/beat`. Без этой переменной отметок нет, а переключателя «Анонимная статистика использования» в настройках не видно.

## Что приходит и что хранится

Пока приложение на экране и им пользуются, оно раз в 15-минутку шлёт:

```
GET https://<сервер>:8460/beat?v=0.36.0&p=android&d=1&w=0&m=0&n=0
```

| Поле | Что это |
|---|---|
| `v` | версия приложения |
| `p` | `android`, `ios`, `windows`, `macos`, `linux` или `web` |
| `d`, `w`, `m` | первая отметка устройства за сутки, ISO-неделю, месяц (по Москве) |
| `n` | первая отметка после установки или очистки данных |

Идентификатора нет, поэтому две отметки одного устройства между собой не связать. Сервер прибавляет единицу к строке «15-минутка × платформа × версия» в SQLite. Журнала запросов, IP-адресов, заголовков и самих отметок нет.

Из счётчиков получается:

- **устройства за сутки, неделю, месяц** — суммы флагов `d`, `w`, `m`: каждое устройство ставит флаг один раз за период;
- **сколько устройств активно в 15-минутку** — число отметок в ней. Тепловая карта показывает среднее по дням недели и часам;
- **часы использования** — число отметок × 15 минут;
- **новые устройства** — сумма `n`. В первые дни после включения статистики сюда попадут и давние пользователи: их первая отметка тоже первая.

## Состав

| Файл | Что это |
|---|---|
| `server.py` | приём отметок (порт 8460) и админка (8461); только стандартная библиотека Python 3.10+ |
| `admin.html`, `admin.js`, `login.html` | страницы админки |
| `bastyon-stats.service` | unit systemd: своя временная учётка, база в `/var/lib/bastyon-stats` |
| `test_server.py` | тесты: `python3 -m unittest stats-server/test_server.py` |

Вход в админку — логин и пароль, не больше 10 неверных паролей в час с одного адреса. Сессия живёт 12 часов в памяти: после перезапуска службы войти нужно заново.

## Выкладка

Оба порта — свои, с сертификатом Let's Encrypt на имя сервера (`$DOMAIN`). Сертификат проверяется через nginx на :80 отдельным блоком только для этого имени — остальные сайты на сервере он не трогает. Служба читает сертификат по постоянному пути `/etc/bastyon-stats/tls/`, туда ведут ссылки на файлы certbot.

```bash
DOMAIN=stats.example.org   # имя сервера

# Один раз
apt-get install -y certbot
mkdir -p /var/www/acme /etc/bastyon-stats/tls /opt/bastyon-stats
cat > /etc/nginx/conf.d/bastyon-stats-acme.conf <<EOF
server {
  listen 80;
  server_name $DOMAIN;
  access_log off;
  location /.well-known/acme-challenge/ { root /var/www/acme; }
  location / { return 404; }
}
EOF
nginx -t && systemctl reload nginx
certbot certonly --webroot -w /var/www/acme -d "$DOMAIN" \
  --register-unsafely-without-email --agree-tos --non-interactive
ln -sf "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" /etc/bastyon-stats/tls/fullchain.pem
ln -sf "/etc/letsencrypt/live/$DOMAIN/privkey.pem" /etc/bastyon-stats/tls/privkey.pem
printf '#!/bin/sh\nsystemctl restart bastyon-stats\n' > /etc/letsencrypt/renewal-hooks/deploy/bastyon-stats.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/bastyon-stats.sh

# Код (и при каждом обновлении) — с машины разработчика
scp stats-server/{server.py,admin.html,admin.js,login.html} <сервер>:/opt/bastyon-stats/
scp stats-server/bastyon-stats.service <сервер>:/etc/systemd/system/

# Пароль админки: печатается один раз, в файле только хеш scrypt
python3 /opt/bastyon-stats/server.py make-config --login admin --out /etc/bastyon-stats/config.json

systemctl daemon-reload && systemctl enable --now bastyon-stats
```

Новый пароль — снова `make-config` и `systemctl restart bastyon-stats`. Проверить, что отметки принимаются:

```bash
curl -i "https://$DOMAIN:8460/beat?v=0.0.0&p=web&d=0&w=0&m=0&n=0"   # 204
```

Тестовая отметка попадёт в счётчики. Версия `0.0.0` в таблице версий сразу видна как проверочная.

## Включение в приложении

1. Сервер выложен, проверочная отметка дошла.
2. Сборка релиза получает `VITE_USAGE_STATS_URL=https://$DOMAIN:8460/beat` — например, из переменной репозитория в шаге сборки.
3. В справку `help/{ru,en}/privacy.md` и `settings.md` добавлен раздел об анонимной статистике: что уходит, как выключить. Адрес попадёт в собранное приложение, но не в код.

## Своя машина

```bash
python3 stats-server/server.py make-config --out /tmp/stats.json
python3 stats-server/server.py serve --config /tmp/stats.json --db /tmp/stats.db --insecure-http
# админка — http://127.0.0.1:8461
```

Dev-сервер приложения и тесты отметок не шлют.
