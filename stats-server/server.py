#!/usr/bin/env python3
"""
Анонимная статистика использования Bastyon NextGen: приём отметок и админка.

Только стандартная библиотека Python 3.10+, без зависимостей. Один процесс,
два порта:

- отметки (по умолчанию 8460): ``GET /beat?v=0.35.0&p=android&d=1&w=0&m=0&n=0``
  → 204. Прибавляет единицу к счётчику «15-минутка × платформа × версия».
  Что значат флаги, написано в src/helpers/usage-stats/usage-beat.ts;
- админка (8461): вход по логину и паролю, не больше 10 неверных паролей
  в час с одного адреса; графики по дням, неделям, месяцам и времени суток.

Чего сервер не делает — это видно по этому файлу: не ведёт журнал запросов,
не хранит IP-адреса, заголовки и сами отметки. В базе только счётчики.
Адреса тех, кто ошибся паролем админки, час живут в памяти и на диск не
попадают; к отметкам приложения они отношения не имеют.

Сутки, недели и месяцы — по Москве (UTC+3), как у приложения.

Запуск и выкладка — в README.md рядом.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import html
import json
import os
import re
import secrets
import socket
import sqlite3
import ssl
import sys
import threading
import time
from datetime import date, datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

SLOT = 15 * 60
MSK = timezone(timedelta(hours=3))
PLATFORMS = ('android', 'ios', 'windows', 'macos', 'linux', 'web')
FLAGS = ('d', 'w', 'm', 'n')
VERSION_RE = re.compile(r'\d{1,3}\.\d{1,3}\.\d{1,3}')
PERIODS = (7, 30, 90, 365)

# Пределы от мусора и перегрузки: сервер делит 1 vCPU с другими службами.
MAX_ROWS_PER_SLOT = 300
MAX_CONNECTIONS = 64
REQUEST_TIMEOUT = 15
MAX_LOGIN_BODY = 4096

LOGIN_FAILS_PER_HOUR = 10
SESSION_TTL = 12 * 3600
MAX_SESSIONS = 50
MAX_TRACKED_ADDRESSES = 10_000
SESSION_COOKIE = 'bs_session'

HERE = Path(__file__).resolve().parent


# ─── Хранилище ──────────────────────────────────────────────────────────────


class Store:
    """Счётчики в SQLite: одна строка на «15-минутка × платформа × версия»."""

    def __init__(self, path: str) -> None:
        self._db = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self._db.execute('PRAGMA journal_mode=WAL')
        self._db.execute('PRAGMA synchronous=NORMAL')
        self._db.execute(
            """CREATE TABLE IF NOT EXISTS beats (
                slot     INTEGER NOT NULL,  -- начало 15-минутки, unix-секунды
                platform TEXT    NOT NULL,
                version  TEXT    NOT NULL,
                beats    INTEGER NOT NULL,  -- отметок: устройств, активных в 15-минутку
                days     INTEGER NOT NULL,  -- из них первых за сутки
                weeks    INTEGER NOT NULL,  -- первых за неделю
                months   INTEGER NOT NULL,  -- первых за месяц
                installs INTEGER NOT NULL,  -- первых с установки
                PRIMARY KEY (slot, platform, version)
            ) WITHOUT ROWID"""
        )
        self._lock = threading.Lock()

    def add_beat(self, now: float, platform: str, version: str, flags: dict[str, bool]) -> bool:
        slot = int(now) // SLOT * SLOT
        d, w, m, n = (int(flags[k]) for k in FLAGS)
        with self._lock:
            known = self._db.execute(
                'SELECT 1 FROM beats WHERE slot = ? AND platform = ? AND version = ?',
                (slot, platform, version),
            ).fetchone()
            if not known:
                (rows,) = self._db.execute(
                    'SELECT COUNT(*) FROM beats WHERE slot = ?', (slot,)
                ).fetchone()
                if rows >= MAX_ROWS_PER_SLOT:
                    return False
            self._db.execute(
                """INSERT INTO beats VALUES (?, ?, ?, 1, ?, ?, ?, ?)
                   ON CONFLICT (slot, platform, version) DO UPDATE SET
                     beats = beats + 1,
                     days = days + excluded.days,
                     weeks = weeks + excluded.weeks,
                     months = months + excluded.months,
                     installs = installs + excluded.installs""",
                (slot, platform, version, d, w, m, n),
            )
        return True

    def rows_since(self, since: int) -> list[tuple]:
        with self._lock:
            return self._db.execute(
                """SELECT slot, platform, version, beats, days, weeks, months, installs
                   FROM beats WHERE slot >= ? ORDER BY slot""",
                (since,),
            ).fetchall()


def parse_beat(query: str) -> tuple[str, str, dict[str, bool]] | None:
    """Отметка из строки запроса или None. Лишние поля не читаются и не хранятся."""
    try:
        q = parse_qs(query, strict_parsing=True, max_num_fields=12)
    except ValueError:
        return None
    try:
        version, platform = q['v'], q['p']
        raw = {k: q[k] for k in FLAGS}
    except KeyError:
        return None
    if any(len(v) != 1 for v in (version, platform, *raw.values())):
        return None
    if platform[0] not in PLATFORMS or not VERSION_RE.fullmatch(version[0]):
        return None
    if any(v[0] not in ('0', '1') for v in raw.values()):
        return None
    return platform[0], version[0], {k: v[0] == '1' for k, v in raw.items()}


# ─── Сводка для админки ─────────────────────────────────────────────────────


def msk_date(ts: float) -> date:
    return datetime.fromtimestamp(ts, MSK).date()


def day_start(day: date) -> int:
    return int(datetime(day.year, day.month, day.day, tzinfo=MSK).timestamp())


def week_key(day: date) -> str:
    year, week, _ = day.isocalendar()
    return f'{year}-W{week:02d}'


def month_key(day: date) -> str:
    return f'{day.year}-{day.month:02d}'


def version_order(version: str) -> tuple[int, ...]:
    return tuple(int(part) for part in version.split('.'))


def summary_since(now: float, days: int) -> int:
    """С какого момента нужны строки, чтобы недели и месяцы периода были полными."""
    today = msk_date(now)
    first = today - timedelta(days=days - 1)
    prev_month = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
    start = min(
        first - timedelta(days=first.weekday()),
        first.replace(day=1),
        today - timedelta(days=today.weekday() + 7),
        prev_month,
    )
    return day_start(start)


def aggregate(rows: list[tuple], now: float, days: int) -> dict:
    """
    Сводка за `days` последних суток (по Москве, сегодня включительно).

    Устройства за сутки, неделю и месяц — сумма флагов «первая отметка за
    период»: каждое устройство ставит такой флаг один раз за период. Часы —
    отметки × 15 минут. Тепловая карта — среднее число устройств, активных
    в 15-минутку, по дням недели и часам; сегодняшний неполный день в неё
    не входит.
    """
    today = msk_date(now)
    yesterday = today - timedelta(days=1)
    first = today - timedelta(days=days - 1)
    period = [first + timedelta(days=i) for i in range(days)]

    per_day = {day: {'devices': 0, 'beats': 0, 'installs': 0} for day in period}
    per_week: dict[str, int] = {}
    per_month: dict[str, int] = {}
    heat = [[0] * 24 for _ in range(7)]
    platforms = {p: {'today': 0, 'yesterday': 0, 'beats': 0} for p in PLATFORMS}
    versions: dict[str, dict[str, int]] = {}

    for slot, platform, version, beats, d, w, m, n in rows:
        local = datetime.fromtimestamp(slot, MSK)
        day = local.date()
        per_week[week_key(day)] = per_week.get(week_key(day), 0) + w
        per_month[month_key(day)] = per_month.get(month_key(day), 0) + m
        cell = per_day.get(day)
        if cell is None:
            continue
        cell['devices'] += d
        cell['beats'] += beats
        cell['installs'] += n
        if day < today:
            heat[day.weekday()][local.hour] += beats
        stat = platforms.setdefault(platform, {'today': 0, 'yesterday': 0, 'beats': 0})
        stat['beats'] += beats
        if day in (today, yesterday):
            key = 'today' if day == today else 'yesterday'
            stat[key] += d
            versions.setdefault(version, {'today': 0, 'yesterday': 0})[key] += d

    full_days = [day for day in period if day < today]
    weekday_days = [0] * 7
    for day in full_days:
        weekday_days[day.weekday()] += 1
    heat_avg = [
        [
            round(heat[wd][hour] / (weekday_days[wd] * (3600 // SLOT)), 2)
            if weekday_days[wd]
            else None
            for hour in range(24)
        ]
        for wd in range(7)
    ]

    y = per_day.get(yesterday, {'devices': 0, 'beats': 0})
    this_week = week_key(today)
    this_month = month_key(today)
    weeks = sorted({week_key(day) for day in period})
    months = sorted({month_key(day) for day in period})

    return {
        'generated': int(now),
        'days': days,
        'today': today.isoformat(),
        'tiles': {
            'today': per_day[today]['devices'],
            'yesterday': y['devices'],
            'week': per_week.get(this_week, 0),
            'lastWeek': per_week.get(week_key(today - timedelta(days=7)), 0),
            'month': per_month.get(this_month, 0),
            'lastMonth': per_month.get(month_key(today.replace(day=1) - timedelta(days=1)), 0),
            'hoursYesterday': round(y['beats'] * SLOT / 3600, 1),
            'minutesPerDeviceYesterday': (
                round(y['beats'] * SLOT / 60 / y['devices']) if y['devices'] else 0
            ),
            'installs': sum(cell['installs'] for cell in per_day.values()),
        },
        'series': [
            {
                'date': day.isoformat(),
                'devices': cell['devices'],
                'hours': round(cell['beats'] * SLOT / 3600, 1),
                'installs': cell['installs'],
            }
            for day, cell in per_day.items()
        ],
        'weeks': [
            {'week': key, 'devices': per_week.get(key, 0), 'partial': key == this_week}
            for key in weeks
        ],
        'months': [
            {'month': key, 'devices': per_month.get(key, 0), 'partial': key == this_month}
            for key in months
        ],
        'heat': heat_avg,
        'platforms': [
            {
                'platform': name,
                'today': stat['today'],
                'yesterday': stat['yesterday'],
                'hours': round(stat['beats'] * SLOT / 3600, 1),
            }
            for name, stat in platforms.items()
            if stat['beats'] or stat['today'] or stat['yesterday']
        ],
        'versions': [
            {'version': name, **counts}
            for name, counts in sorted(
                versions.items(), key=lambda item: version_order(item[0]), reverse=True
            )
        ],
    }


# ─── Вход в админку ─────────────────────────────────────────────────────────


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    n, r, p = 2**14, 8, 1
    digest = hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, dklen=32)
    b64 = lambda b: base64.b64encode(b).decode()  # noqa: E731
    return f'scrypt${n}${r}${p}${b64(salt)}${b64(digest)}'


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, digest = stored.split('$')
        if scheme != 'scrypt':
            return False
        actual = hashlib.scrypt(
            password.encode(),
            salt=base64.b64decode(salt),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(base64.b64decode(digest)),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, base64.b64decode(digest))


class Auth:
    """Логин и пароль, неверные пароли — не больше 10 в час с одного адреса."""

    def __init__(self, login: str, password_hash: str) -> None:
        self._login = login
        self._hash = password_hash
        self._fails: dict[str, list[float]] = {}
        self._sessions: dict[str, float] = {}
        self._lock = threading.Lock()

    def retry_after(self, addr: str, now: float) -> int:
        """Сколько секунд ждать до следующей попытки; 0 — можно сейчас."""
        with self._lock:
            fails = [t for t in self._fails.get(addr, []) if now - t < 3600]
            if fails:
                self._fails[addr] = fails
            else:
                self._fails.pop(addr, None)
            if len(fails) < LOGIN_FAILS_PER_HOUR:
                return 0
            return max(1, int(fails[0] + 3600 - now))

    def login(self, addr: str, login: str, password: str, now: float) -> str | None:
        """Токен сессии или None. Пароль проверяется и при чужом логине — время ответа то же."""
        login_ok = hmac.compare_digest(login.encode(), self._login.encode())
        password_ok = verify_password(password, self._hash)
        with self._lock:
            if not (login_ok and password_ok):
                if addr not in self._fails and len(self._fails) >= MAX_TRACKED_ADDRESSES:
                    self._prune_fails(now)
                self._fails.setdefault(addr, []).append(now)
                return None
            self._fails.pop(addr, None)
            self._sessions = {t: exp for t, exp in self._sessions.items() if exp > now}
            if len(self._sessions) >= MAX_SESSIONS:
                oldest = min(self._sessions, key=self._sessions.__getitem__)
                del self._sessions[oldest]
            token = secrets.token_urlsafe(32)
            self._sessions[token] = now + SESSION_TTL
            return token

    def _prune_fails(self, now: float) -> None:
        self._fails = {
            a: [t for t in ts if now - t < 3600]
            for a, ts in self._fails.items()
            if any(now - t < 3600 for t in ts)
        }
        # Если и после чистки места нет, старшие адреса уступают — лимит
        # для них начнётся заново, но память не растёт.
        while len(self._fails) >= MAX_TRACKED_ADDRESSES:
            self._fails.pop(next(iter(self._fails)))

    def valid(self, token: str | None, now: float) -> bool:
        if not token:
            return False
        with self._lock:
            exp = self._sessions.get(token)
            return exp is not None and exp > now

    def logout(self, token: str | None) -> None:
        with self._lock:
            self._sessions.pop(token or '', None)


# ─── HTTP ───────────────────────────────────────────────────────────────────


class Server(ThreadingHTTPServer):
    """
    Сервер с TLS в потоке соединения (медленное рукопожатие не держит приём
    остальных) и пределом одновременных соединений.
    """

    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, addr, handler, tls: ssl.SSLContext | None, **state) -> None:
        self.tls = tls
        self._slots = threading.BoundedSemaphore(MAX_CONNECTIONS)
        for key, value in state.items():
            setattr(self, key, value)
        super().__init__(addr, handler)

    def process_request(self, request, client_address):
        if not self._slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self._slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._slots.release()

    def finish_request(self, request, client_address):
        request.settimeout(REQUEST_TIMEOUT)
        if self.tls is None:
            self.RequestHandlerClass(request, client_address, self)
            return
        try:
            conn = self.tls.wrap_socket(request, server_side=True)
        except (ssl.SSLError, OSError):
            return
        try:
            self.RequestHandlerClass(conn, client_address, self)
        finally:
            try:
                conn.shutdown(socket.SHUT_WR)
            except OSError:
                pass
            conn.close()

    def handle_error(self, request, client_address):
        # Стандартный вывод печатает адрес клиента — молчим.
        pass


class QuietHandler(BaseHTTPRequestHandler):
    """Без журнала: ни адресов, ни путей, ни заголовков."""

    server_version = 'stats'
    sys_version = ''
    timeout = REQUEST_TIMEOUT

    def log_message(self, format, *args):  # noqa: A002
        pass

    def send_bytes(self, status: int, body: bytes = b'', content_type: str | None = None,
                   headers: tuple = ()) -> None:
        self.send_response(status)
        if content_type:
            self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        for key, value in headers:
            self.send_header(key, value)
        self.end_headers()
        if body and self.command != 'HEAD':
            self.wfile.write(body)


CORS = (('Access-Control-Allow-Origin', '*'),)


class BeatHandler(QuietHandler):
    def do_GET(self):
        url = urlsplit(self.path)
        if url.path != '/beat':
            self.send_bytes(404)
            return
        beat = parse_beat(url.query)
        if beat is None:
            self.send_bytes(400, headers=CORS)
            return
        self.server.store.add_beat(time.time(), *beat)
        self.send_bytes(204, headers=CORS)

    def do_OPTIONS(self):
        self.send_bytes(204, headers=CORS + (('Access-Control-Allow-Methods', 'GET'),))


PAGE_HEADERS = (
    (
        'Content-Security-Policy',
        "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "connect-src 'self'; img-src 'self' data:; form-action 'self'; "
        "frame-ancestors 'none'; base-uri 'none'",
    ),
    ('Referrer-Policy', 'no-referrer'),
    ('X-Frame-Options', 'DENY'),
)


class AdminHandler(QuietHandler):
    def _token(self) -> str | None:
        for part in (self.headers.get('Cookie') or '').split(';'):
            name, _, value = part.strip().partition('=')
            if name == SESSION_COOKIE and value:
                return value
        return None

    def _authed(self) -> bool:
        return self.server.auth.valid(self._token(), time.time())

    def _page(self, status: int, body: str, extra: tuple = ()) -> None:
        headers = PAGE_HEADERS + extra
        if self.server.tls is not None:
            headers += (('Strict-Transport-Security', 'max-age=31536000'),)
        self.send_bytes(status, body.encode(), 'text/html; charset=utf-8', headers)

    def _login_page(self, status: int = 200, error: str = '') -> None:
        block = f'<p class="error" role="alert">{html.escape(error)}</p>' if error else ''
        self._page(status, self.server.pages['login'].replace('{{error}}', block))

    def _cookie(self, value: str, max_age: int) -> tuple:
        secure = '; Secure' if self.server.tls is not None else ''
        return (
            'Set-Cookie',
            f'{SESSION_COOKIE}={value}; Path=/; HttpOnly; SameSite=Strict; Max-Age={max_age}{secure}',
        )

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == '/':
            if self._authed():
                self._page(200, self.server.pages['admin'])
            else:
                self._login_page()
        elif url.path == '/admin.js':
            self.send_bytes(200, self.server.pages['js'].encode(),
                            'text/javascript; charset=utf-8')
        elif url.path == '/api/stats':
            if not self._authed():
                self.send_bytes(401)
                return
            try:
                days = int(parse_qs(url.query).get('days', ['30'])[0])
            except ValueError:
                days = 30
            if days not in PERIODS:
                days = 30
            now = time.time()
            data = aggregate(self.server.store.rows_since(summary_since(now, days)), now, days)
            self.send_bytes(200, json.dumps(data).encode(), 'application/json')
        else:
            self.send_bytes(404)

    def do_POST(self):
        url = urlsplit(self.path)
        if url.path == '/logout':
            self.server.auth.logout(self._token())
            self.send_bytes(303, headers=(('Location', '/'), self._cookie('', 0)))
            return
        if url.path != '/login':
            self.send_bytes(404)
            return

        addr = self.client_address[0]
        now = time.time()
        wait = self.server.auth.retry_after(addr, now)
        if wait:
            minutes = (wait + 59) // 60
            self._login_page(429, f'Слишком много неверных паролей. Попробуйте через {minutes} мин.')
            return
        try:
            length = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            length = -1
        if length < 0 or length > MAX_LOGIN_BODY:
            self.send_bytes(413)
            return
        form = parse_qs(self.rfile.read(length).decode('utf-8', 'replace'), max_num_fields=4)
        login = (form.get('login') or [''])[0]
        password = (form.get('password') or [''])[0]
        token = self.server.auth.login(addr, login, password, now)
        if token is None:
            self._login_page(401, 'Неверный логин или пароль.')
            return
        self.send_bytes(303, headers=(('Location', '/'), self._cookie(token, SESSION_TTL)))


# ─── Запуск ─────────────────────────────────────────────────────────────────


def credential(name: str) -> Path | None:
    """Файл, который systemd передал службе через LoadCredential=."""
    directory = os.environ.get('CREDENTIALS_DIRECTORY')
    if directory and (Path(directory) / name).is_file():
        return Path(directory) / name
    return None


def load_pages() -> dict[str, str]:
    return {
        'admin': (HERE / 'admin.html').read_text(encoding='utf-8'),
        'login': (HERE / 'login.html').read_text(encoding='utf-8'),
        'js': (HERE / 'admin.js').read_text(encoding='utf-8'),
    }


def serve(args: argparse.Namespace) -> None:
    config_path = args.config or os.environ.get('STATS_CONFIG') or credential('config')
    if not config_path:
        sys.exit('нет файла настроек: --config, STATS_CONFIG или LoadCredential=config')
    config = json.loads(Path(config_path).read_text(encoding='utf-8'))

    cert = os.environ.get('STATS_TLS_CERT') or credential('cert')
    key = os.environ.get('STATS_TLS_KEY') or credential('key')
    tls = None
    if cert and key:
        tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        tls.minimum_version = ssl.TLSVersion.TLSv1_2
        tls.load_cert_chain(str(cert), str(key))
    elif not args.insecure_http:
        sys.exit('нет сертификата: STATS_TLS_CERT/STATS_TLS_KEY или LoadCredential=cert/key '
                 '(без TLS — только --insecure-http, для проверки на своей машине)')

    state_dir = os.environ.get('STATE_DIRECTORY')
    db_path = args.db or os.environ.get('STATS_DB') or (
        str(Path(state_dir) / 'stats.db') if state_dir else 'stats.db'
    )
    store = Store(db_path)
    auth = Auth(config['admin_login'], config['admin_password'])
    bind = args.bind

    beat = Server((bind, args.beat_port), BeatHandler, tls, store=store)
    admin = Server((bind, args.admin_port), AdminHandler, tls, store=store, auth=auth,
                   pages=load_pages())
    threading.Thread(target=beat.serve_forever, daemon=True).start()
    print(f'отметки: {bind}:{args.beat_port}, админка: {bind}:{args.admin_port}, '
          f'TLS: {"да" if tls else "нет"}', flush=True)
    admin.serve_forever()


def make_config(args: argparse.Namespace) -> None:
    password = secrets.token_urlsafe(18)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(out, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        json.dump({'admin_login': args.login, 'admin_password': hash_password(password)}, f)
    print(f'логин: {args.login}\nпароль: {password}\n(пароль не сохраняется — запишите его)')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    sub = parser.add_subparsers(dest='command')

    run = sub.add_parser('serve', help='принимать отметки и открыть админку (по умолчанию)')
    run.add_argument('--config')
    run.add_argument('--db')
    run.add_argument('--bind', default=os.environ.get('STATS_BIND', '0.0.0.0'))
    run.add_argument('--beat-port', type=int, default=int(os.environ.get('STATS_BEAT_PORT', 8460)))
    run.add_argument('--admin-port', type=int,
                     default=int(os.environ.get('STATS_ADMIN_PORT', 8461)))
    run.add_argument('--insecure-http', action='store_true')

    mk = sub.add_parser('make-config', help='создать файл настроек с новым паролем админки')
    mk.add_argument('--login', default='admin')
    mk.add_argument('--out', required=True)

    args = parser.parse_args(sys.argv[1:] or ['serve'])
    if args.command == 'make-config':
        make_config(args)
    else:
        serve(args)


if __name__ == '__main__':
    main()
