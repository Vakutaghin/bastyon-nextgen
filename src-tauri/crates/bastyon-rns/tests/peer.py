"""Эталонный собеседник: Python RNS 1.5.4 + LXMF 1.1.1.

python peer.py <configdir> <port> [name] [--pn] [--node]
- поднимает RNS с TCPServerInterface на 127.0.0.1:<port> (наш узел подключается клиентом);
- LXMF-роутер с delivery-адресом, announce с именем;
- --pn: ещё и узел доставки (propagation node, стоимость штампа 13 — минимум);
- --node: нода NomadNet «PyNode» со страницами /page/index.mu и /page/echo.mu;
- печатает JSON-строки: {"ready": адрес, ...}, {"announce": ...}, {"message": ...}, {"state": ...};
- команды на stdin (JSON): {"send": "<dest hex>", "text": "...", "method": "opportunistic|direct|propagated",
  "image": [формат, base64], "files": [[имя, base64], ...]} (вложения — по желанию),
  {"announce": true}, {"path": "<dest hex>"}, {"store_for": "<dest hex>", "text": "..."} (положить
  сообщение в своё хранилище узла доставки), {"paper_for": "<dest hex>", "text": "..."} (бумажное
  сообщение → {"paper": "lxm://…"}), {"ingest": "lxm://…"}, {"pn_count": true}, {"quit": true}.
"""
import base64
import json
import os
import sys
import threading
import time

import RNS
import LXMF
import RNS.vendor.umsgpack as msgpack

flags = {a for a in sys.argv[1:] if a.startswith("--")}
args = [a for a in sys.argv[1:] if not a.startswith("--")]
configdir, port = args[0], int(args[1])
name = args[2] if len(args) > 2 else "PyPeer"
os.makedirs(configdir, exist_ok=True)
with open(os.path.join(configdir, "config"), "w") as f:
    f.write(f"""[reticulum]
  enable_transport = No
  share_instance = No
  panic_on_interface_error = No
[logging]
  loglevel = 2
[interfaces]
  [[TCP Server]]
    type = TCPServerInterface
    enabled = yes
    listen_ip = 127.0.0.1
    listen_port = {port}
""")

def out(obj):
    print(json.dumps(obj, ensure_ascii=False), flush=True)

reticulum = RNS.Reticulum(configdir=configdir)
idpath = os.path.join(configdir, "identity")
identity = RNS.Identity.from_file(idpath) if os.path.exists(idpath) else RNS.Identity()
identity.to_file(idpath)
router = LXMF.LXMRouter(identity=identity, storagepath=os.path.join(configdir, "lxmf"), propagation_cost=13)
dest = router.register_delivery_identity(identity, display_name=name)

pn = "--pn" in flags
if pn:
    router.enable_propagation()

node_dest = None
if "--node" in flags:
    node_dest = RNS.Destination(identity, RNS.Destination.IN, RNS.Destination.SINGLE, "nomadnetwork", "node")

    def index(path, data, request_id, link_id, remote_identity, requested_at):
        return ">Hello from Python\nThis is a `!NomadNet`! page".encode("utf-8")

    def echo(path, data, request_id, link_id, remote_identity, requested_at):
        return (">Echo\n" + json.dumps(data, sort_keys=True, ensure_ascii=False)).encode("utf-8")

    node_dest.register_request_handler("/page/index.mu", response_generator=index, allow=RNS.Destination.ALLOW_ALL)
    node_dest.register_request_handler("/page/echo.mu", response_generator=echo, allow=RNS.Destination.ALLOW_ALL)

def jsonable(v):
    """Поля LXMF в JSON: байты — base64, списки и словари — рекурсивно."""
    if isinstance(v, (bytes, bytearray)):
        return base64.b64encode(bytes(v)).decode()
    if isinstance(v, (list, tuple)):
        return [jsonable(x) for x in v]
    if isinstance(v, dict):
        return {str(k): jsonable(x) for k, x in v.items()}
    return v

def on_message(m):
    out({"message": {
        "from": RNS.hexrep(m.source_hash, delimit=False),
        "title": m.title_as_string(),
        "content": m.content_as_string(),
        "signature": m.signature_validated,
        "method": m.method,
        "fields": jsonable(m.fields or {}),
    }})

router.register_delivery_callback(on_message)

class Announces:
    aspect_filter = "lxmf.delivery"
    def received_announce(self, destination_hash, announced_identity, app_data):
        out({"announce": {
            "dest": RNS.hexrep(destination_hash, delimit=False),
            "name": LXMF.display_name_from_app_data(app_data) if app_data else None,
            "hops": RNS.Transport.hops_to(destination_hash),
        }})

RNS.Transport.register_announce_handler(Announces())

def announce_all():
    dest.announce()
    if pn:
        router.propagation_destination.announce(app_data=router.get_propagation_node_app_data())
    if node_dest:
        node_dest.announce(app_data="PyNode".encode("utf-8"))

ready = {"ready": RNS.hexrep(dest.hash, delimit=False), "identity": RNS.hexrep(identity.hash, delimit=False)}
if pn:
    ready["pn"] = RNS.hexrep(router.propagation_destination.hash, delimit=False)
if node_dest:
    ready["node"] = RNS.hexrep(node_dest.hash, delimit=False)
out(ready)
announce_all()

def state_name(s):
    return {LXMF.LXMessage.GENERATING: "generating", LXMF.LXMessage.OUTBOUND: "outbound",
            LXMF.LXMessage.SENDING: "sending", LXMF.LXMessage.SENT: "sent",
            LXMF.LXMessage.DELIVERED: "delivered", LXMF.LXMessage.FAILED: "failed"}.get(s, str(s))

def watch(msg, tag):
    last = None
    for _ in range(600):
        if msg.state != last:
            last = msg.state
            out({"state": {"tag": tag, "state": state_name(msg.state)}})
            if msg.state in (LXMF.LXMessage.DELIVERED, LXMF.LXMessage.FAILED):
                return
        time.sleep(0.1)

def recall(h):
    if not RNS.Transport.has_path(h):
        RNS.Transport.request_path(h)
        for _ in range(100):
            if RNS.Transport.has_path(h):
                break
            time.sleep(0.1)
    return RNS.Identity.recall(h)

for line in sys.stdin:
    try:
        cmd = json.loads(line)
    except Exception:
        continue
    if cmd.get("quit"):
        break
    if cmd.get("announce"):
        announce_all()
    if cmd.get("pn_count"):
        out({"pn_count": len(router.propagation_entries)})
    if "path" in cmd:
        h = bytes.fromhex(cmd["path"])
        RNS.Transport.request_path(h)
        out({"path": cmd["path"], "has": RNS.Transport.has_path(h)})
    if "paper_for" in cmd:
        h = bytes.fromhex(cmd["paper_for"])
        ident = recall(h)
        if ident is None:
            out({"error": "unknown destination", "dest": cmd["paper_for"]})
            continue
        to = RNS.Destination(ident, RNS.Destination.OUT, RNS.Destination.SINGLE, "lxmf", "delivery")
        m = LXMF.LXMessage(to, dest, cmd.get("text", ""), "", desired_method=LXMF.LXMessage.PAPER)
        out({"paper": m.as_uri()})
    if "ingest" in cmd:
        out({"ingested": bool(router.ingest_lxm_uri(cmd["ingest"]))})
    if "store_for" in cmd:
        h = bytes.fromhex(cmd["store_for"])
        ident = recall(h)
        if ident is None:
            out({"error": "unknown destination", "dest": cmd["store_for"]})
            continue
        to = RNS.Destination(ident, RNS.Destination.OUT, RNS.Destination.SINGLE, "lxmf", "delivery")
        m = LXMF.LXMessage(to, dest, cmd.get("text", ""), cmd.get("title", ""), desired_method=LXMF.LXMessage.PROPAGATED)
        m.pack()
        lxmf_data = msgpack.unpackb(m.propagation_packed)[1][0]
        router.lxmf_propagation(lxmf_data, stamp_value=0, stamp_data=b"\x00" * 32)
        out({"stored": RNS.hexrep(RNS.Identity.full_hash(lxmf_data), delimit=False)})
    if "send" in cmd:
        h = bytes.fromhex(cmd["send"])
        ident = recall(h)
        if ident is None:
            out({"error": "unknown destination", "dest": cmd["send"]})
            continue
        to = RNS.Destination(ident, RNS.Destination.OUT, RNS.Destination.SINGLE, "lxmf", "delivery")
        method = {"opportunistic": LXMF.LXMessage.OPPORTUNISTIC, "direct": LXMF.LXMessage.DIRECT,
                  "propagated": LXMF.LXMessage.PROPAGATED}[cmd.get("method", "opportunistic")]
        fields = {}
        if "image" in cmd:
            fmt, data = cmd["image"]
            fields[LXMF.FIELD_IMAGE] = [fmt, base64.b64decode(data)]
        if "files" in cmd:
            fields[LXMF.FIELD_FILE_ATTACHMENTS] = [[n, base64.b64decode(d)] for n, d in cmd["files"]]
        msg = LXMF.LXMessage(to, dest, cmd.get("text", ""), cmd.get("title", ""), desired_method=method,
                             fields=fields or None)
        router.handle_outbound(msg)
        threading.Thread(target=watch, args=(msg, cmd.get("tag", "")), daemon=True).start()
