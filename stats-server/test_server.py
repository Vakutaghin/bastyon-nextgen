"""Тесты сервера статистики: python3 -m unittest stats-server/test_server.py"""

from __future__ import annotations

import contextlib
import http.client
import io
import json
import sys
import tempfile
import threading
import unittest
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import server  # noqa: E402
from server import MSK, SLOT, Auth, Store, aggregate, hash_password, parse_beat  # noqa: E402

FLAGS_OFF = {'d': False, 'w': False, 'm': False, 'n': False}


def ts(text: str) -> float:
    """Момент по московскому времени: '2026-11-12 21:05'."""
    return datetime.strptime(text, '%Y-%m-%d %H:%M').replace(tzinfo=MSK).timestamp()


def flags(**on: bool) -> dict[str, bool]:
    return {**FLAGS_OFF, **on}


class ParseBeatTest(unittest.TestCase):
    def test_valid(self):
        self.assertEqual(
            parse_beat('v=0.35.0&p=android&d=1&w=0&m=1&n=0'),
            ('android', '0.35.0', {'d': True, 'w': False, 'm': True, 'n': False}),
        )

    def test_extra_fields_ignored(self):
        self.assertIsNotNone(parse_beat('v=1.2.3&p=web&d=0&w=0&m=0&n=0&x=1'))

    def test_rejects_garbage(self):
        for query in (
            '',
            'v=0.35.0&p=android&d=1&w=0&m=1',  # нет флага
            'v=0.35.0&p=amiga&d=1&w=0&m=1&n=0',  # чужая платформа
            'v=0.35.0-beta&p=web&d=1&w=0&m=1&n=0',
            'v=0.35.0%0A&p=web&d=1&w=0&m=1&n=0',  # перевод строки после версии
            'v=1.2.3&p=web&d=2&w=0&m=1&n=0',
            'v=1.2.3&v=1.2.4&p=web&d=1&w=0&m=1&n=0',  # два значения
            'v=1.2.3&p=web&d=1&w=0&m=1&n=0&' + '&'.join(f'k{i}=1' for i in range(20)),
        ):
            with self.subTest(query=query):
                self.assertIsNone(parse_beat(query))


class StoreTest(unittest.TestCase):
    def setUp(self):
        self.store = Store(':memory:')

    def test_counts_per_slot_platform_version(self):
        now = ts('2026-11-12 21:05')
        self.store.add_beat(now, 'android', '0.35.0', flags(d=True, n=True))
        self.store.add_beat(now + 60, 'android', '0.35.0', flags(w=True))
        self.store.add_beat(now, 'windows', '0.35.0', FLAGS_OFF)
        self.store.add_beat(now + SLOT, 'android', '0.35.0', FLAGS_OFF)
        rows = self.store.rows_since(0)
        slot = int(now) // SLOT * SLOT
        self.assertIn((slot, 'android', '0.35.0', 2, 1, 1, 0, 1), rows)
        self.assertIn((slot, 'windows', '0.35.0', 1, 0, 0, 0, 0), rows)
        self.assertIn((slot + SLOT, 'android', '0.35.0', 1, 0, 0, 0, 0), rows)
        self.assertEqual(len(rows), 3)

    def test_row_cap_per_slot(self):
        now = ts('2026-11-12 21:05')
        for i in range(server.MAX_ROWS_PER_SLOT):
            self.assertTrue(self.store.add_beat(now, 'web', f'1.0.{i}', FLAGS_OFF))
        self.assertFalse(self.store.add_beat(now, 'web', '9.9.9', FLAGS_OFF))
        # Уже известная строка по-прежнему считается.
        self.assertTrue(self.store.add_beat(now, 'web', '1.0.0', FLAGS_OFF))


class AggregateTest(unittest.TestCase):
    def test_days_weeks_months_tiles(self):
        store = Store(':memory:')
        # Чт 12.11.2026, 21:05 МСК. Устройство A: вчера 2 отметки, сегодня 1.
        # Устройство B: сегодня 3 отметки, впервые.
        store.add_beat(ts('2026-11-11 10:00'), 'android', '0.34.0', flags(d=True, w=True, m=True))
        store.add_beat(ts('2026-11-11 10:20'), 'android', '0.34.0', FLAGS_OFF)
        store.add_beat(ts('2026-11-12 09:00'), 'android', '0.35.0', flags(d=True))
        store.add_beat(ts('2026-11-12 20:00'), 'windows', '0.35.0',
                       flags(d=True, w=True, m=True, n=True))
        store.add_beat(ts('2026-11-12 20:15'), 'windows', '0.35.0', FLAGS_OFF)
        store.add_beat(ts('2026-11-12 20:30'), 'windows', '0.35.0', FLAGS_OFF)
        # Прошлый месяц и прошлая неделя.
        store.add_beat(ts('2026-10-30 12:00'), 'linux', '0.30.0', flags(d=True, w=True, m=True))

        now = ts('2026-11-12 21:05')
        data = aggregate(store.rows_since(server.summary_since(now, 7)), now, 7)

        self.assertEqual(data['today'], '2026-11-12')
        self.assertEqual(len(data['series']), 7)
        self.assertEqual(data['series'][-1], {'date': '2026-11-12', 'devices': 2, 'hours': 1.0, 'installs': 1})
        self.assertEqual(data['series'][-2], {'date': '2026-11-11', 'devices': 1, 'hours': 0.5, 'installs': 0})

        tiles = data['tiles']
        self.assertEqual(tiles['today'], 2)
        self.assertEqual(tiles['yesterday'], 1)
        self.assertEqual(tiles['week'], 2)
        self.assertEqual(tiles['lastWeek'], 0)
        self.assertEqual(tiles['month'], 2)
        self.assertEqual(tiles['lastMonth'], 1)
        self.assertEqual(tiles['hoursYesterday'], 0.5)
        self.assertEqual(tiles['minutesPerDeviceYesterday'], 30)
        self.assertEqual(tiles['installs'], 1)

        # Среда 11.11, 10:00–11:00: две отметки за единственную среду в периоде,
        # четыре 15-минутки в часе → 0,5 устройства в среднем.
        self.assertEqual(data['heat'][2][10], 0.5)
        # Сегодняшний день в карту не входит.
        self.assertEqual(data['heat'][3][20], None)

        self.assertEqual(
            data['platforms'],
            [
                {'platform': 'android', 'today': 1, 'yesterday': 1, 'hours': 0.8},
                {'platform': 'windows', 'today': 1, 'yesterday': 0, 'hours': 0.8},
            ],
        )
        self.assertEqual(
            data['versions'],
            [
                {'version': '0.35.0', 'today': 2, 'yesterday': 0},
                {'version': '0.34.0', 'today': 0, 'yesterday': 1},
            ],
        )
        self.assertEqual(data['weeks'], [
            {'week': '2026-W45', 'devices': 0, 'partial': False},
            {'week': '2026-W46', 'devices': 2, 'partial': True},
        ])

    def test_empty(self):
        now = ts('2026-11-12 21:05')
        data = aggregate([], now, 30)
        self.assertEqual(data['tiles']['today'], 0)
        self.assertEqual(data['tiles']['minutesPerDeviceYesterday'], 0)
        self.assertEqual(data['platforms'], [])
        self.assertEqual(data['versions'], [])


class AuthTest(unittest.TestCase):
    def setUp(self):
        self.auth = Auth('admin', hash_password('correct horse'))

    def test_login_and_session(self):
        token = self.auth.login('1.2.3.4', 'admin', 'correct horse', 1000)
        self.assertTrue(token)
        self.assertTrue(self.auth.valid(token, 1001))
        self.assertFalse(self.auth.valid(token, 1000 + server.SESSION_TTL + 1))
        self.auth.logout(token)
        self.assertFalse(self.auth.valid(token, 1001))

    def test_ten_wrong_passwords_per_hour(self):
        for i in range(10):
            self.assertEqual(self.auth.retry_after('1.2.3.4', 1000 + i), 0)
            self.assertIsNone(self.auth.login('1.2.3.4', 'admin', 'nope', 1000 + i))
        self.assertGreater(self.auth.retry_after('1.2.3.4', 1010), 3500)
        # Другой адрес не задет.
        self.assertEqual(self.auth.retry_after('5.6.7.8', 1010), 0)
        # Через час после первой ошибки — снова можно.
        self.assertEqual(self.auth.retry_after('1.2.3.4', 1000 + 3600), 0)

    def test_wrong_login(self):
        self.assertIsNone(self.auth.login('1.2.3.4', 'root', 'correct horse', 1000))


class HttpTest(unittest.TestCase):
    """Настоящие запросы к обоим портам, без TLS."""

    def setUp(self):
        self.store = Store(':memory:')
        self.auth = Auth('admin', hash_password('secret'))
        self.beat = server.Server(('127.0.0.1', 0), server.BeatHandler, None, store=self.store)
        self.admin = server.Server(('127.0.0.1', 0), server.AdminHandler, None, store=self.store,
                                   auth=self.auth, pages=server.load_pages())
        for srv in (self.beat, self.admin):
            threading.Thread(target=srv.serve_forever, daemon=True).start()
        self.stderr = io.StringIO()
        self._redirect = contextlib.redirect_stderr(self.stderr)
        self._redirect.__enter__()

    def tearDown(self):
        self._redirect.__exit__(None, None, None)
        for srv in (self.beat, self.admin):
            srv.shutdown()
            srv.server_close()

    def request(self, srv, method, path, body=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', srv.server_address[1], timeout=5)
        conn.request(method, path, body=body, headers=headers or {})
        res = conn.getresponse()
        data = res.read()
        conn.close()
        return res, data

    def test_beat(self):
        res, _ = self.request(self.beat, 'GET', '/beat?v=0.35.0&p=linux&d=1&w=1&m=1&n=1')
        self.assertEqual(res.status, 204)
        self.assertEqual(res.getheader('Access-Control-Allow-Origin'), '*')
        self.assertEqual(len(self.store.rows_since(0)), 1)
        res, _ = self.request(self.beat, 'GET', '/beat?v=x&p=linux&d=1&w=1&m=1&n=1')
        self.assertEqual(res.status, 400)
        res, _ = self.request(self.beat, 'GET', '/')
        self.assertEqual(res.status, 404)
        # Журнала запросов нет: ни адреса, ни пути.
        self.assertEqual(self.stderr.getvalue(), '')

    def test_admin_login_flow(self):
        res, body = self.request(self.admin, 'GET', '/')
        self.assertEqual(res.status, 200)
        self.assertIn('name="password"', body.decode())
        res, _ = self.request(self.admin, 'GET', '/api/stats')
        self.assertEqual(res.status, 401)

        form = {'Content-Type': 'application/x-www-form-urlencoded'}
        res, _ = self.request(self.admin, 'POST', '/login', 'login=admin&password=secret', form)
        self.assertEqual(res.status, 303)
        cookie = res.getheader('Set-Cookie').split(';')[0]
        self.assertIn('HttpOnly', res.getheader('Set-Cookie'))

        res, body = self.request(self.admin, 'GET', '/api/stats?days=7', headers={'Cookie': cookie})
        self.assertEqual(res.status, 200)
        self.assertEqual(json.loads(body)['days'], 7)
        res, body = self.request(self.admin, 'GET', '/', headers={'Cookie': cookie})
        self.assertIn('/admin.js', body.decode())

        res, _ = self.request(self.admin, 'POST', '/logout', headers={'Cookie': cookie})
        self.assertEqual(res.status, 303)
        res, _ = self.request(self.admin, 'GET', '/api/stats', headers={'Cookie': cookie})
        self.assertEqual(res.status, 401)

    def test_admin_lockout(self):
        form = {'Content-Type': 'application/x-www-form-urlencoded'}
        for _ in range(10):
            res, _ = self.request(self.admin, 'POST', '/login', 'login=admin&password=bad', form)
            self.assertEqual(res.status, 401)
        res, body = self.request(self.admin, 'POST', '/login', 'login=admin&password=secret', form)
        self.assertEqual(res.status, 429)
        self.assertIn('Слишком много', body.decode())


if __name__ == '__main__':
    unittest.main()
