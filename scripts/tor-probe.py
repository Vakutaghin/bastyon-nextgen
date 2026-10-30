"""Проверка Tor приложения из сети с блокировками (РФ и т. п.) без самого приложения.

Повторяет src-tauri/src/tor: torrc как config::render_torrc, встроенные мосты
из pt_config.json бандла, Moat через meek_lite как moat.rs. После подключения
проверяет через Tor прокси, ноду, Matrix, GitHub, torproject.org и WebSocket
прокси. Нужен распакованный tor-expert-bundle (каталог с tor/ и data/) и curl.

  python -I scripts/tor-probe.py <бандл> <итог.json> [способ ...]

Способы: probes (адреса напрямую, без Tor), moat, direct, snowflake, obfs4,
meek; <транспорт>:<файл> — мосты из файла в каталоге бандла, по строке на мост
(например webtunnel:webtunnel.txt). Без способов — probes moat snowflake obfs4
meek direct. Через Tor сертификаты проверяются; напрямую (probes) — нет:
там важно только, открывается ли адрес. Замеры 30.10.2026 из дата-центра в РФ — в описании коммита cb0b153a.
"""

import json
import os
import shutil
import socket
import ssl
import subprocess
import sys
import threading
import time

WIN = os.name == "nt"
EXE = ".exe" if WIN else ""
PT_REL = "pluggable_transports\\" if WIN else "pluggable_transports/"
MOAT_HOST = "bridges.torproject.org"
MOAT_TARGETS = "https://1723079976.rsc.cdn77.org|cdn.zk.mk+www.cdn77.com"
TRANSPORTS = ["obfs4", "snowflake", "webtunnel", "meek", "vanilla"]
STALL = {"meek": 240}
DEFAULT_STALL = 90
CHECK_URLS = [
    ("proxy", "https://1.pocketnet.app:8899/rpc/getnodeinfo", '{"method":"getnodeinfo","parameters":[]}'),
    ("proxy2", "https://2.pocketnet.app:8899/rpc/getnodeinfo", '{"method":"getnodeinfo","parameters":[]}'),
    ("matrix", "https://matrix.pocketnet.app/_matrix/client/versions", None),
    ("node", "https://5.187.79.252:38881/public/", '{"method":"getnodeinfo","params":[],"id":1}'),
    ("github", "https://github.com/Vakutaghin/bastyon-nextgen/releases/tag/tor-15.0.25", None),
    ("torproject", "https://archive.torproject.org/tor-package-archive/torbrowser/", None),
]
PLAIN_URLS = [u for _, u, _ in CHECK_URLS] + [
    "https://bridges.torproject.org/",
    "https://1723079976.rsc.cdn77.org/",
    "https://cdn.zk.mk/",
    "https://www.cdn77.com/",
    "https://1098762253.rsc.cdn77.org/",
    "https://app.datapacket.com/",
    "https://www.phpmyadmin.net/",
    "https://1603026938.rsc.cdn77.org/",
]

T0 = time.time()


def log(*a):
    print(f"{time.time() - T0:7.1f}s", *a, flush=True)


def recv_exact(s, n):
    buf = b""
    while len(buf) < n:
        chunk = s.recv(n - len(buf))
        if not chunk:
            raise OSError("socks: connection closed")
        buf += chunk
    return buf


def socks5(port, host, dport, user=None, pw=None, timeout=60):
    s = socket.create_connection(("127.0.0.1", port), timeout=timeout)
    if user is not None:
        s.sendall(b"\x05\x01\x02")
    else:
        s.sendall(b"\x05\x01\x00")
    ver, method = recv_exact(s, 2)
    if method == 0x02:
        u, p = user.encode(), pw.encode()
        s.sendall(b"\x01" + bytes([len(u)]) + u + bytes([len(p)]) + p)
        if recv_exact(s, 2)[1] != 0:
            raise OSError("socks: auth rejected")
    elif method != 0x00:
        raise OSError(f"socks: method {method}")
    h = host.encode()
    s.sendall(b"\x05\x01\x00\x03" + bytes([len(h)]) + h + dport.to_bytes(2, "big"))
    rep = recv_exact(s, 4)
    if rep[1] != 0:
        raise OSError(f"socks: connect reply {rep[1]}")
    atyp = rep[3]
    if atyp == 1:
        recv_exact(s, 4)
    elif atyp == 3:
        recv_exact(s, recv_exact(s, 1)[0])
    elif atyp == 4:
        recv_exact(s, 16)
    recv_exact(s, 2)
    return s


def https_over(sock, host, method, path, body=None, timeout=60):
    ctx = ssl.create_default_context()
    t = ctx.wrap_socket(sock, server_hostname=host)
    t.settimeout(timeout)
    data = body.encode() if body else b""
    head = f"{method} {path} HTTP/1.1\r\nHost: {host}\r\nUser-Agent: Bastyon/1.0\r\nAccept: application/json\r\nConnection: close\r\n"
    if body is not None:
        head += f"Content-Type: application/json\r\nContent-Length: {len(data)}\r\n"
    t.sendall(head.encode() + b"\r\n" + data)
    raw = b""
    try:
        while True:
            chunk = t.recv(65536)
            if not chunk:
                break
            raw += chunk
            if len(raw) > 2_000_000:
                break
    except (ssl.SSLError, OSError) as e:
        if not raw:
            raise
    status = raw.split(b"\r\n", 1)[0].decode(errors="replace")
    return status, raw


def pt_env(state):
    env = dict(os.environ)
    env.update(
        TOR_PT_MANAGED_TRANSPORT_VER="1",
        TOR_PT_STATE_LOCATION=state,
        TOR_PT_EXIT_ON_STDIN_CLOSE="1",
        TOR_PT_CLIENT_TRANSPORTS="meek_lite",
    )
    return env


def moat(root, procedure, body):
    """moat.rs::request: lyrebird meek_lite client, SOCKS login = targets."""
    pt_dir = os.path.join(root, "tor", "pluggable_transports")
    state = os.path.join(root, "data", "moat_pt_state")
    os.makedirs(state, exist_ok=True)
    flags = 0x08000000 if WIN else 0
    p = subprocess.Popen(
        [os.path.join(pt_dir, "lyrebird" + EXE)],
        cwd=pt_dir,
        env=pt_env(state),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        creationflags=flags,
    )
    try:
        port = None
        deadline = time.time() + 15
        while time.time() < deadline:
            line = p.stdout.readline().decode(errors="replace").strip()
            if line.startswith("CMETHOD meek_lite socks5 "):
                port = int(line.rsplit(":", 1)[1])
            if line == "CMETHODS DONE" or not line:
                break
        if not port:
            return {"ok": False, "error": "no CMETHOD"}
        threading.Thread(target=lambda: [None for _ in p.stdout], daemon=True).start()
        esc = MOAT_TARGETS.replace("\\", "\\\\").replace("=", "\\=").replace(";", "\\;")
        started = time.time()
        sock = socks5(port, MOAT_HOST, 443, user="targets=" + esc, pw="\0", timeout=60)
        status, raw = https_over(sock, MOAT_HOST, "POST", "/moat/" + procedure, json.dumps(body), timeout=60)
        took = round(time.time() - started, 1)
        payload = raw.split(b"\r\n\r\n", 1)[1] if b"\r\n\r\n" in raw else b""
        if b"chunked" in raw.split(b"\r\n\r\n", 1)[0].lower():
            out, rest = b"", payload
            while rest:
                size_line, _, rest = rest.partition(b"\r\n")
                size = int(size_line.split(b";")[0] or b"0", 16)
                if size == 0:
                    break
                out, rest = out + rest[:size], rest[size + 2:]
            payload = out
        return {"ok": status.split(" ")[1:2] == ["200"], "status": status, "seconds": took, "body": payload.decode(errors="replace")}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
    finally:
        try:
            p.stdin.close()
        except OSError:
            pass
        p.kill()


def builtin(root, kind):
    with open(os.path.join(root, "tor", "pluggable_transports", "pt_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    return cfg, cfg["bridges"].get(kind, [])


def torrc(root, socks, bridges, cfg):
    q = lambda p: '"' + p.replace("\\", "\\\\").replace('"', '\\"') + '"'
    data = os.path.join(root, "data")
    lines = [
        f"SocksPort 127.0.0.1:{socks}",
        f"DataDirectory {q(data)}",
        f"__OwningControllerProcess {os.getpid()}",
    ]
    for name, key in (("geoip", "GeoIPFile"), ("geoip6", "GeoIPv6File")):
        path = os.path.join(data, name)
        if os.path.isfile(path):
            lines.append(f"{key} {q(path)}")
    lines += ["ClientUseIPv6 1", "AvoidDiskWrites 1", "Log notice stdout"]
    if bridges:
        lines.append("UseBridges 1")
        for line in cfg["pluggableTransports"].values():
            lines.append(line.replace("${pt_path}", PT_REL))
        lines += ["Bridge " + b for b in bridges]
    return "\n".join(lines) + "\n"


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def curl_via(socks, url, body):
    cmd = ["curl" + EXE, "-s", "-o", os.devnull, "-w", "%{http_code} %{time_total}", "--max-time", "60",
           "--socks5-hostname", f"127.0.0.1:{socks}"]
    if ":38881/" in url:
        cmd.append("-k")  # у ноды свой сертификат, приложение сверяет его отпечаток (TOFU)
    if WIN:
        cmd.append("--ssl-no-revoke")
    if body:
        cmd += ["-H", "Content-Type: application/json", "--data", body]
    cmd.append(url)
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    return r.stdout.strip() or f"exit {r.returncode}"


def ws_via(socks, host, port):
    """WebSocket handshake through Tor, as ws.rs: SOCKS5 → TLS → Upgrade."""
    started = time.time()
    try:
        sock = socks5(socks, host, port, timeout=60)
        ctx = ssl.create_default_context()
        t = ctx.wrap_socket(sock, server_hostname=host)
        t.settimeout(60)
        t.sendall((f"GET / HTTP/1.1\r\nHost: {host}:{port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                   "Sec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n").encode())
        status = t.recv(4096).split(b"\r\n", 1)[0].decode(errors="replace")
        t.close()
        return f"{status} {time.time() - started:.1f}s"
    except Exception as e:  # noqa: BLE001
        return f"{type(e).__name__}: {e} {time.time() - started:.1f}s"


def plain(url):
    cmd = ["curl" + EXE, "-s", "-o", os.devnull, "-w", "%{http_code} %{time_total}", "--max-time", "15", "-k", url]
    if WIN:
        cmd.insert(1, "--ssl-no-revoke")
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return r.stdout.strip() or f"exit {r.returncode}"


def attempt(root, kind, bridges, cfg, max_seconds):
    data = os.path.join(root, "data")
    for name in os.listdir(data):
        if name.startswith("cached-") or name in ("state", "lock", "keys", "pt_state"):
            p = os.path.join(data, name)
            shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    socks = free_port()
    rc = os.path.join(root, f"torrc-{kind}")
    with open(rc, "w", encoding="utf-8") as f:
        f.write(torrc(root, socks, bridges, cfg))
    tor_dir = os.path.join(root, "tor")
    flags = 0x08000000 if WIN else 0
    env = dict(os.environ)
    if sys.platform.startswith("linux"):
        # Как process::spawn: у tor из бандла нет RPATH. Только ему — Python и
        # curl с OpenSSL бандла остались бы без корневых сертификатов.
        env["LD_LIBRARY_PATH"] = tor_dir
    proc = subprocess.Popen([os.path.join(tor_dir, "tor" + EXE), "-f", rc], cwd=tor_dir, env=env,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, creationflags=flags)
    timeline, warns = [], []
    state = {"pct": 0, "last": time.time(), "done": False, "pt_fail": 0}

    def reader():
        for raw in proc.stdout:
            line = raw.decode(errors="replace").rstrip()
            if "Bootstrapped " in line:
                pct = int(line.split("Bootstrapped ", 1)[1].split("%", 1)[0])
                timeline.append((round(time.time() - start, 1), pct, line.split("): ", 1)[-1][:80]))
                if pct > state["pct"]:
                    state["pct"], state["last"] = pct, time.time()
                if pct >= 100:
                    state["done"] = True
            elif "[warn]" in line or "[err]" in line:
                warns.append(line[line.find("["):][:200])
                if "Managed proxy" in line and ("terminated" in line or "failed at launch" in line or "died in state" in line):
                    state["pt_fail"] += 1

    start = time.time()
    threading.Thread(target=reader, daemon=True).start()
    stall = STALL.get(kind, DEFAULT_STALL)
    outcome = "timeout"
    while time.time() - start < max_seconds:
        time.sleep(0.5)
        if state["done"]:
            outcome = "ready"
            break
        if proc.poll() is not None:
            outcome = "exited"
            break
        if time.time() - state["last"] > stall:
            outcome = f"stalled>{stall}s at {state['pct']}%"
            break
        if state["pt_fail"] >= 3:
            outcome = "pt_failed"
            break
    result = {"kind": kind, "outcome": outcome, "seconds": round(time.time() - start, 1),
              "pct": state["pct"], "timeline": timeline, "warns": warns[-8:], "bridges": len(bridges)}
    log(kind, outcome, result["seconds"], "s")
    if outcome == "ready":
        checks = {}
        for name, url, body in CHECK_URLS:
            checks[name] = curl_via(socks, url, body)
            log("  via tor", name, checks[name])
        checks["proxy_wss"] = ws_via(socks, "1.pocketnet.app", 8099)
        log("  via tor proxy_wss", checks["proxy_wss"])
        result["via_tor"] = checks
    proc.kill()
    proc.wait()
    return result


def main():
    root, out = sys.argv[1], sys.argv[2]
    kinds = sys.argv[3:] or ["probes", "moat", "snowflake", "obfs4", "meek", "direct"]
    results = {"started": time.strftime("%Y-%m-%d %H:%M:%S"), "results": []}

    def save():
        with open(out, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=1)

    for kind in kinds:
        if kind == "probes":
            res = {"kind": "probes", "plain": {u: plain(u) for u in PLAIN_URLS}}
            for u, v in res["plain"].items():
                log("plain", u, v)
        elif kind == "moat":
            res = {"kind": "moat", "settings": moat(root, "circumvention/settings", {"transports": TRANSPORTS, "country": None})}
            log("moat settings", {k: v for k, v in res["settings"].items() if k != "body"})
            if not res["settings"].get("ok"):
                res["defaults"] = moat(root, "circumvention/defaults", {"transports": TRANSPORTS})
                log("moat defaults", {k: v for k, v in res["defaults"].items() if k != "body"})
        else:
            label, _, fname = kind.partition(":")
            cfg, lines = builtin(root, label)
            if kind == "direct":
                lines = []
            elif fname:
                path = os.path.join(root, fname)
                lines = [l.strip() for l in open(path, encoding="utf-8") if l.strip() and not l.startswith("#")]
                kind = label + "-" + fname.split(".")[0]
                STALL.setdefault(kind, STALL.get(label, DEFAULT_STALL))
            elif kind in ("webtunnel", "custom"):
                path = os.path.join(root, "extra_bridges.txt")
                lines = [l.strip() for l in open(path, encoding="utf-8") if l.strip() and not l.startswith("#")] if os.path.exists(path) else []
                if not lines:
                    log(kind, "no bridges in extra_bridges.txt")
                    continue
            res = attempt(root, kind, lines, cfg, max_seconds=STALL.get(kind, DEFAULT_STALL) + 240)
        results["results"].append(res)
        save()
    results["finished"] = time.strftime("%Y-%m-%d %H:%M:%S")
    save()


if __name__ == "__main__":
    main()
