//! Узел Reticulum: rns-net с интерфейсами из настроек и роутер LXMF поверх.
//!
//! Потоки: драйвер rns-net (колбэки), рабочий (jobs роутера, судьба исходящих,
//! опрос интерфейсов, announce), отправка (штампы считаются секундами) и
//! короткие потоки синхронизации с узлом доставки. Колбэки драйвера не делают
//! синхронных запросов к узлу — драйвер ждал бы сам себя; всё, что требует
//! узла, уходит в потоки.
//!
//! Link, которые модуль открывает сам (страницы NomadNet, синхронизация),
//! роутеру не показываются: ответы на запросы сопоставляются по Link, поэтому
//! на одном Link — один запрос за раз.

use std::collections::{HashMap, HashSet, VecDeque};
use std::fmt::Write as _;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Condvar, Mutex, MutexGuard, Weak};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use lxmf_core::announce;
use base64::Engine as _;
use lxmf_core::constants::{
    DeliveryMethod, MessageState, Representation, AM_OPUS_LOSSLESS, AM_OPUS_OGG,
    DESTINATION_LENGTH, ENCRYPTED_PACKET_MDU, ENCRYPTION_DESCRIPTION_EC, FIELD_AUDIO,
    FIELD_CUSTOM_DATA, FIELD_CUSTOM_TYPE, FIELD_FILE_ATTACHMENTS, FIELD_IMAGE, MESSAGE_GET_PATH,
    PAPER_MDU, STAMP_SIZE, WORKBLOCK_EXPAND_ROUNDS, WORKBLOCK_EXPAND_ROUNDS_PN,
};
use lxmf_core::message;
use lxmf_rs::router::{
    now_timestamp, LxmDelivery, LxmRouter, LxmfCallbacks, OutboundMessage, RouterConfig,
};
use lxmf_rs::stamper::generate_stamp;
use rns_core::msgpack::{self, Value};
use rns_crypto::identity::Identity;
use rns_crypto::sha256::sha256;
use rns_crypto::OsRng;
use rns_net::{
    AnnouncedIdentity, Callbacks, DestHash, Destination, Event, IdentityHash, LinkId,
    PacketHash, ProofStrategy, QueryRequest, QueryResponse, RnsNode, SendError,
    TeardownReason,
};

use crate::types::{
    Attachment, Custom, Download, IfaceConfig, IfaceStatus, Method, Page, PathInfo, RnsEvent,
    StartOptions, Started, Status,
};

/// Шаг рабочего потока.
const TICK: Duration = Duration::from_millis(250);
/// Как часто гонять jobs роутера (у lxmd — 4 с; чаще — меньше ждать отправки).
const JOBS_EVERY: Duration = Duration::from_secs(1);
const IFACES_EVERY: Duration = Duration::from_secs(3);
/// Повторный announce адреса; и при появлении связи, но не чаще MIN_REANNOUNCE.
const ANNOUNCE_EVERY: Duration = Duration::from_secs(6 * 3600);
const MIN_REANNOUNCE: Duration = Duration::from_secs(30);
/// Известные узлу адреса показать интерфейсу чуть позже старта: к этому
/// времени он уже знает свой адрес.
const REPLAY_AFTER: Duration = Duration::from_secs(1);
const PATH_TIMEOUT: Duration = Duration::from_secs(20);
const LINK_TIMEOUT: Duration = Duration::from_secs(30);
const PAGE_TIMEOUT: Duration = Duration::from_secs(60);
/// Файл по радио идёт долго: ждём, пока приходят части, но не дольше этого.
const TRANSFER_MAX: Duration = Duration::from_secs(3600);
/// Как часто сообщать интерфейсу ход скачивания.
const PROGRESS_EVERY: Duration = Duration::from_millis(300);
const PAGE_LINK_IDLE: Duration = Duration::from_secs(300);
const SYNC_LIST_TIMEOUT: Duration = Duration::from_secs(60);
const SYNC_GET_TIMEOUT: Duration = Duration::from_secs(180);
/// Сколько id сообщений класть в один запрос /get: запрос уходит одним
/// пакетом Link, а не ресурсом.
const IDS_PER_REQUEST: usize = 5;
/// Дороже этого штамп считать не берёмся (минуты работы процессора).
const MAX_STAMP_COST: u8 = 20;

const LXMF: &str = "lxmf";
const NOMADNET: &str = "nomadnetwork";
const ASPECT_DELIVERY: &str = "lxmf.delivery";
const ASPECT_PROPAGATION: &str = "lxmf.propagation";
const ASPECT_NOMADNET: &str = "nomadnetwork.node";

type Sink = Box<dyn Fn(RnsEvent) + Send + Sync>;

fn err(code: &str) -> String {
    code.to_string()
}

fn not_running(_: SendError) -> String {
    err("rns_not_running")
}

/// Хэш identity (адрес «узла» в терминах RNS) по 64 байтам приватного ключа.
pub fn identity_hash(prv: &[u8]) -> Result<String, String> {
    let key: [u8; 64] = prv
        .try_into()
        .map_err(|_| err("rns_error: identity must be 64 bytes"))?;
    Ok(hex::encode(Identity::from_private_key(&key).hash()))
}

fn dest_hash(app: &str, aspects: &[&str], identity: &[u8; 16]) -> [u8; 16] {
    rns_core::destination::destination_hash(app, aspects, Some(identity))
}

fn delivery_hash_of(identity: &[u8; 16]) -> [u8; 16] {
    dest_hash(LXMF, &["delivery"], identity)
}

/// Какой из знакомых нам аспектов объявил этот адрес.
fn aspect_of(dest: &[u8; 16], identity: &[u8; 16]) -> Option<&'static str> {
    if *dest == delivery_hash_of(identity) {
        Some(ASPECT_DELIVERY)
    } else if *dest == dest_hash(LXMF, &["propagation"], identity) {
        Some(ASPECT_PROPAGATION)
    } else if *dest == dest_hash(NOMADNET, &["node"], identity) {
        Some(ASPECT_NOMADNET)
    } else {
        None
    }
}

/// Событие announce для интерфейса и, для узла доставки, стоимость его штампа.
fn peer_event(
    dest: [u8; 16],
    identity: [u8; 16],
    app_data: Option<&[u8]>,
    hops: u8,
    heard: f64,
) -> Option<(RnsEvent, Option<u8>)> {
    let aspect = aspect_of(&dest, &identity)?;
    let mut pn_cost = None;
    let name = match aspect {
        ASPECT_DELIVERY => app_data.and_then(announce::display_name_from_app_data),
        ASPECT_PROPAGATION => {
            let data = app_data?;
            let info = announce::parse_pn_announce_data(data)?;
            // Узел, который сейчас не принимает сообщения, не предлагать.
            if !info.propagation_enabled {
                return None;
            }
            pn_cost = Some(info.propagation_stamp_cost);
            announce::pn_name_from_app_data(data)
        }
        _ => app_data
            .and_then(|d| std::str::from_utf8(d).ok())
            .map(|s| s.to_string()),
    }
    .map(|n| n.replace('\0', "").trim().to_string())
    .filter(|n| !n.is_empty());
    Some((
        RnsEvent::Announce {
            aspect: aspect.to_string(),
            dest: hex::encode(dest),
            identity: hex::encode(identity),
            name,
            hops: Some(hops),
            heard: Some(heard),
        },
        pn_cost,
    ))
}

fn method_name(m: DeliveryMethod) -> &'static str {
    match m {
        DeliveryMethod::Opportunistic => "opportunistic",
        DeliveryMethod::Direct => "direct",
        DeliveryMethod::Propagated => "propagated",
        DeliveryMethod::Paper => "paper",
    }
}

fn state_name(s: MessageState) -> &'static str {
    match s {
        MessageState::Generating | MessageState::Outbound | MessageState::Sending => "sending",
        MessageState::Sent => "sent",
        MessageState::Delivered => "delivered",
        MessageState::Rejected | MessageState::Cancelled | MessageState::Failed => "failed",
    }
}

/// Сколько байт вложений в одном сообщении: получатели на Python LXMF по
/// умолчанию принимают сообщение до 1000 КБ целиком.
const MAX_ATTACHMENT_BYTES: usize = 900_000;

fn b64(bytes: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

fn text_of(v: &Value) -> Option<String> {
    v.as_str()
        .map(str::to_string)
        .or_else(|| v.as_bin().map(|b| String::from_utf8_lossy(b).into_owned()))
}

/// Имя файла без пути и управляющих символов.
fn file_name(raw: &str) -> String {
    let base = raw.rsplit(['/', '\\']).next().unwrap_or("");
    let clean: String = base.chars().filter(|c| !c.is_control()).take(200).collect();
    let clean = clean.trim();
    if clean.is_empty() || clean == "." || clean == ".." {
        "file".into()
    } else {
        clean.to_string()
    }
}

/// Формат картинки LXMF («jpg», «webp») → MIME; незнакомый — как файл.
fn image_mime(format: &str) -> Option<&'static str> {
    match format.trim().trim_start_matches("image/").to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "webp" => Some("image/webp"),
        "gif" => Some("image/gif"),
        "avif" => Some("image/avif"),
        _ => None,
    }
}

/// Вложения из полей LXMF (как их шлют Sideband и MeshChat). Голос codec2 в
/// браузере не проиграть — он отмечается значком в тексте (вторая часть).
fn attachments_of(fields: &[(Value, Value)]) -> (Vec<Attachment>, String) {
    let mut out = Vec::new();
    let mut marks = String::new();
    for (key, value) in fields {
        let Some(items) = value.as_array() else {
            continue;
        };
        match key.as_uint().map(|k| k as u8) {
            Some(FIELD_IMAGE) => {
                let format = items.first().and_then(text_of).unwrap_or_default();
                let Some(bytes) = items.get(1).and_then(Value::as_bin) else {
                    continue;
                };
                out.push(match image_mime(&format) {
                    Some(mime) => Attachment {
                        kind: "image".into(),
                        name: format!("image.{}", mime.trim_start_matches("image/")),
                        mime: mime.into(),
                        data: b64(bytes),
                    },
                    None => Attachment {
                        kind: "file".into(),
                        name: file_name(&format!("image.{format}")),
                        mime: "application/octet-stream".into(),
                        data: b64(bytes),
                    },
                });
            }
            Some(FIELD_FILE_ATTACHMENTS) => {
                for file in items {
                    let Some(pair) = file.as_array() else {
                        continue;
                    };
                    if let (Some(name), Some(bytes)) =
                        (pair.first().and_then(text_of), pair.get(1).and_then(Value::as_bin))
                    {
                        out.push(Attachment {
                            kind: "file".into(),
                            name: file_name(&name),
                            mime: "application/octet-stream".into(),
                            data: b64(bytes),
                        });
                    }
                }
            }
            Some(FIELD_AUDIO) => {
                let mode = items.first().and_then(Value::as_uint).unwrap_or(0);
                match items.get(1).and_then(Value::as_bin) {
                    Some(bytes)
                        if (AM_OPUS_OGG as u64..=AM_OPUS_LOSSLESS as u64).contains(&mode) =>
                    {
                        out.push(Attachment {
                            kind: "audio".into(),
                            name: "voice.ogg".into(),
                            mime: "audio/ogg".into(),
                            data: b64(bytes),
                        })
                    }
                    _ => marks.push('🎤'),
                }
            }
            _ => {}
        }
    }
    (out, marks)
}

/// Поля LXMF для отправки: первая картинка — FIELD_IMAGE, голос Ogg Opus —
/// FIELD_AUDIO в режиме AM_OPUS_OGG (другие режимы Opus Sideband не играет),
/// остальное — файлами, как у Sideband и MeshChat.
fn fields_of(attachments: &[Attachment]) -> Result<Vec<(Value, Value)>, String> {
    let mut image = None;
    let mut audio = None;
    let mut files = Vec::new();
    let mut total = 0usize;
    for a in attachments {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(a.data.as_bytes())
            .map_err(|_| err("rns_error: attachment data"))?;
        total += bytes.len();
        match (a.kind.as_str(), image_mime(&a.mime)) {
            ("image", Some(mime)) if image.is_none() => {
                let format = mime.trim_start_matches("image/").replace("jpeg", "jpg");
                image = Some(Value::Array(vec![Value::Str(format), Value::Bin(bytes)]));
            }
            ("audio", _) if audio.is_none() && a.mime == "audio/ogg" => {
                audio = Some(Value::Array(vec![
                    Value::UInt(AM_OPUS_OGG as u64),
                    Value::Bin(bytes),
                ]));
            }
            ("image" | "file" | "audio", _) => files.push(Value::Array(vec![
                Value::Str(file_name(&a.name)),
                Value::Bin(bytes),
            ])),
            _ => return Err(err("rns_error: attachment kind")),
        }
    }
    if total > MAX_ATTACHMENT_BYTES {
        return Err(err("rns_too_large"));
    }
    let mut fields = Vec::new();
    if let Some(img) = image {
        fields.push((Value::UInt(FIELD_IMAGE as u64), img));
    }
    if let Some(voice) = audio {
        fields.push((Value::UInt(FIELD_AUDIO as u64), voice));
    }
    if !files.is_empty() {
        fields.push((Value::UInt(FIELD_FILE_ATTACHMENTS as u64), Value::Array(files)));
    }
    Ok(fields)
}

/// Предел данных приложения в сообщении: запись связки — сотни байт.
const MAX_CUSTOM_BYTES: usize = 4096;

/// Данные приложения из полей LXMF, если они текстовые и не больше предела.
fn custom_of(fields: &[(Value, Value)]) -> Option<Custom> {
    let field = |id: u8| {
        fields
            .iter()
            .find(|(k, _)| k.as_uint() == Some(id as u64))
            .map(|(_, v)| v)
    };
    let kind = field(FIELD_CUSTOM_TYPE).and_then(text_of)?;
    let data = field(FIELD_CUSTOM_DATA)?;
    let bytes = data
        .as_bin()
        .map(<[u8]>::to_vec)
        .or_else(|| data.as_str().map(|s| s.as_bytes().to_vec()))?;
    if kind.len() > 64 || bytes.len() > MAX_CUSTOM_BYTES {
        return None;
    }
    Some(Custom {
        kind,
        data: String::from_utf8(bytes).ok()?,
    })
}

fn message_event(d: &LxmDelivery) -> RnsEvent {
    let mut content = String::from_utf8_lossy(&d.content).into_owned();
    let (attachments, marks) = attachments_of(&d.fields);
    if !marks.is_empty() {
        if !content.is_empty() {
            content.push('\n');
        }
        content.push_str(&marks);
    }
    RnsEvent::Message {
        id: hex::encode(d.message_hash),
        from: hex::encode(d.source_hash),
        title: String::from_utf8_lossy(&d.title).into_owned(),
        content,
        timestamp: d.timestamp,
        signed: d.signature_valid == Some(true),
        method: method_name(d.method).to_string(),
        attachments,
        custom: custom_of(&d.fields),
    }
}

// ---------------------------------------------------------------------------
// Конфиг rns-net

fn valid_host(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 253
        && s
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | ':' | '_' | '%'))
}

#[cfg(not(windows))]
fn valid_port_path(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 200
        && s
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | '/' | ':' | '\\'))
}

/// Текст конфига в формате Python RNS. Значения проверяются: конфиг умеет
/// PipeInterface, который запускает команды, — подмешать секцию нельзя.
pub(crate) fn config_text(ifaces: &[IfaceConfig]) -> Result<String, String> {
    let mut out = String::from(
        "[reticulum]\n  enable_transport = No\n  share_instance = No\n  panic_on_interface_error = No\n\n[logging]\n  loglevel = 2\n\n[interfaces]\n",
    );
    let mut seen = HashSet::new();
    for iface in ifaces {
        let name = iface.name();
        if !seen.insert(name.clone()) {
            continue;
        }
        match iface {
            IfaceConfig::Tcp { host, port } => {
                if !valid_host(host) || *port == 0 {
                    return Err(format!("bad_interface: {name}"));
                }
                let _ = write!(
                    out,
                    "  [[{name}]]\n    type = TCPClientInterface\n    enabled = yes\n    target_host = {host}\n    target_port = {port}\n"
                );
            }
            IfaceConfig::Auto => {
                let _ = write!(
                    out,
                    "  [[{name}]]\n    type = AutoInterface\n    enabled = yes\n"
                );
            }
            // На Windows у rns-net нет последовательного порта (termios).
            #[cfg(windows)]
            IfaceConfig::Rnode { .. } => return Err(format!("unsupported: {name}")),
            #[cfg(not(windows))]
            IfaceConfig::Rnode {
                port,
                frequency,
                bandwidth,
                spreading_factor,
                coding_rate,
                tx_power,
                fd,
            } => {
                let ok = valid_port_path(port)
                    && fd.is_none_or(|fd| fd >= 0)
                    && (100_000_000..=3_000_000_000).contains(frequency)
                    && (7_800..=1_625_000).contains(bandwidth)
                    && (5..=12).contains(spreading_factor)
                    && (5..=8).contains(coding_rate)
                    && (-9..=37).contains(tx_power);
                if !ok {
                    return Err(format!("bad_interface: {name}"));
                }
                let source = match fd {
                    Some(fd) => format!("fd = {fd}"),
                    None => format!("port = {port}"),
                };
                let _ = write!(
                    out,
                    "  [[{name}]]\n    type = RNodeInterface\n    enabled = yes\n    {source}\n    frequency = {frequency}\n    bandwidth = {bandwidth}\n    txpower = {tx_power}\n    spreadingfactor = {spreading_factor}\n    codingrate = {coding_rate}\n"
                );
            }
        }
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// Общее состояние колбэков и потоков

/// Link, которые модуль открыл сам, и что с ними происходит.
#[derive(Default)]
struct LinkBook {
    watched: HashSet<[u8; 16]>,
    /// Установленные исходящие Link — все, не только свои: Link может
    /// установиться раньше, чем его id вернётся из create_link.
    established: HashSet<[u8; 16]>,
    closed: HashSet<[u8; 16]>,
    /// Ответы на свои запросы: msgpack и метаданные ресурса (имя файла).
    responses: HashMap<[u8; 16], VecDeque<Response>>,
    /// Когда по Link последний раз пришла часть ответа-ресурса: пока файл
    /// идёт, ответа ждём дальше.
    progress: HashMap<[u8; 16], Instant>,
}

/// Ответ на запрос: msgpack ответа и метаданные ресурса, если ответ пришёл им.
type Response = (Vec<u8>, Option<Vec<u8>>);

struct Hub {
    sink: Sink,
    running: AtomicBool,
    book: Mutex<LinkBook>,
    cv: Condvar,
    /// Стоимость штампа узлов доставки — из их announce.
    pn_costs: Mutex<HashMap<[u8; 16], u8>>,
}

impl Hub {
    fn emit(&self, ev: RnsEvent) {
        (self.sink)(ev);
    }

    fn book(&self) -> MutexGuard<'_, LinkBook> {
        self.book.lock().unwrap_or_else(|p| p.into_inner())
    }

    fn watch(&self, link: [u8; 16]) {
        self.book().watched.insert(link);
    }

    fn unwatch(&self, link: &[u8; 16]) {
        let mut book = self.book();
        book.watched.remove(link);
        book.closed.remove(link);
        book.responses.remove(link);
        book.progress.remove(link);
    }

    fn wait<T>(
        &self,
        timeout: Duration,
        mut check: impl FnMut(&mut LinkBook) -> Option<T>,
    ) -> Option<T> {
        let deadline = Instant::now() + timeout;
        let mut book = self.book();
        loop {
            if let Some(v) = check(&mut book) {
                return Some(v);
            }
            let now = Instant::now();
            if now >= deadline || !self.running.load(Ordering::SeqCst) {
                return None;
            }
            let step = (deadline - now).min(Duration::from_millis(500));
            book = self
                .cv
                .wait_timeout(book, step)
                .unwrap_or_else(|p| p.into_inner())
                .0;
        }
    }

    /// Some(true) — установлен, Some(false) — закрылся, None — не дождались.
    fn wait_established(&self, link: [u8; 16], timeout: Duration) -> Option<bool> {
        self.wait(timeout, |b| {
            if b.established.contains(&link) {
                Some(true)
            } else if b.closed.contains(&link) {
                Some(false)
            } else {
                None
            }
        })
    }

    /// Ok — ответ (msgpack), Err — Link закрылся, None — не дождались.
    fn wait_response(&self, link: [u8; 16], timeout: Duration) -> Option<Result<Vec<u8>, ()>> {
        self.wait_transfer(link, timeout, timeout)
            .map(|r| r.map(|(data, _)| data))
    }

    /// Ответ, который может идти ресурсом долго (файл по радио): ждать, пока
    /// части приходят не реже `idle`, но не дольше `max`.
    fn wait_transfer(
        &self,
        link: [u8; 16],
        idle: Duration,
        max: Duration,
    ) -> Option<Result<Response, ()>> {
        let started = Instant::now();
        let mut active = started;
        let mut book = self.book();
        loop {
            if let Some(r) = book.responses.get_mut(&link).and_then(|q| q.pop_front()) {
                return Some(Ok(r));
            }
            if book.closed.contains(&link) {
                return Some(Err(()));
            }
            if let Some(t) = book.progress.get(&link) {
                active = active.max(*t);
            }
            let now = Instant::now();
            let deadline = (active + idle).min(started + max);
            if now >= deadline || !self.running.load(Ordering::SeqCst) {
                return None;
            }
            let step = (deadline - now).min(Duration::from_millis(500));
            book = self
                .cv
                .wait_timeout(book, step)
                .unwrap_or_else(|p| p.into_inner())
                .0;
        }
    }
}

/// Событие драйвера для роутера LXMF. `LxmfCallbacks` работает в своём потоке:
/// в потоке драйвера он ждал бы блокировку роутера, пока `jobs()` под той же
/// блокировкой ждёт ответа драйвера, — взаимная блокировка.
enum Ev {
    Announce(AnnouncedIdentity),
    Path(DestHash, u8),
    Local(DestHash, Vec<u8>, PacketHash),
    LinkUp(LinkId, DestHash, f64, bool),
    LinkDown(LinkId, Option<TeardownReason>),
    Identified(LinkId, IdentityHash, [u8; 64]),
    Resource(LinkId, Vec<u8>, Option<Vec<u8>>),
    ResourceDone(LinkId),
    ResourceFailed(LinkId, String),
    ResourceProgress(LinkId, usize, usize),
    ResourceAccepted(LinkId, Vec<u8>, u64),
    Data(LinkId, u8, Vec<u8>),
    Response(LinkId, [u8; 16], Vec<u8>, Option<Vec<u8>>),
    Proof(DestHash, PacketHash, f64),
}

/// Поток колбэков роутера: заканчивается, когда драйвер останавливается и
/// отпускает `Bridge` с отправителем.
fn callbacks_loop(router: Arc<Mutex<LxmRouter>>, rx: mpsc::Receiver<Ev>) {
    let mut lx = LxmfCallbacks::new(router.clone());
    while let Ok(ev) = rx.recv() {
        match ev {
            Ev::Announce(a) => lx.on_announce(a),
            Ev::Path(d, h) => lx.on_path_updated(d, h),
            Ev::Local(d, raw, p) => lx.on_local_delivery(d, raw, p),
            Ev::LinkUp(l, d, rtt, init) => lx.on_link_established(l, d, rtt, init),
            Ev::LinkDown(l, r) => lx.on_link_closed(l, r),
            Ev::Identified(l, h, k) => lx.on_remote_identified(l, h, k),
            Ev::Resource(l, data, meta) => lx.on_resource_received(l, data, meta),
            Ev::ResourceDone(l) => lx.on_resource_completed(l),
            Ev::ResourceFailed(l, e) => lx.on_resource_failed(l, e),
            Ev::ResourceProgress(l, r, t) => lx.on_resource_progress(l, r, t),
            Ev::ResourceAccepted(l, hash, size) => {
                lock(&router).track_inbound_delivery_resource(l.0, hash, size)
            }
            Ev::Data(l, c, data) => lx.on_link_data(l, c, data),
            Ev::Response(l, id, data, meta) => lx.on_response_with_metadata(l, id, data, meta),
            Ev::Proof(d, p, rtt) => lx.on_proof(d, p, rtt),
        }
    }
}

/// Колбэки драйвера. Сами ничего не ждут: события роутера — в его поток,
/// события своих Link — в `LinkBook`, announce знакомых аспектов — интерфейсу.
struct Bridge {
    tx: mpsc::Sender<Ev>,
    hub: Arc<Hub>,
    own_delivery: [u8; 16],
    /// Входящие Link → адрес, к которому они открыты: решать о приёме
    /// ресурса нужно сразу, в потоке драйвера.
    inbound: HashMap<[u8; 16], [u8; 16]>,
    /// Предел размера входящего сообщения, байт.
    delivery_limit: u64,
    /// Когда интерфейсу последний раз сообщали ход скачивания.
    last_progress: Option<Instant>,
}

impl Bridge {
    fn is_watched(&self, link: &LinkId) -> bool {
        self.hub.book().watched.contains(&link.0)
    }

    fn forward(&self, ev: Ev) {
        let _ = self.tx.send(ev);
    }
}

impl Callbacks for Bridge {
    fn on_announce(&mut self, a: AnnouncedIdentity) {
        if a.dest_hash.0 != self.own_delivery {
            if let Some((ev, pn_cost)) = peer_event(
                a.dest_hash.0,
                a.identity_hash.0,
                a.app_data.as_deref(),
                a.hops,
                a.received_at,
            ) {
                if let Some(cost) = pn_cost {
                    lock(&self.hub.pn_costs).insert(a.dest_hash.0, cost);
                }
                self.hub.emit(ev);
            }
        }
        self.forward(Ev::Announce(a));
    }

    fn on_path_updated(&mut self, dest_hash: DestHash, hops: u8) {
        self.forward(Ev::Path(dest_hash, hops));
    }

    fn on_local_delivery(&mut self, dest_hash: DestHash, raw: Vec<u8>, packet_hash: PacketHash) {
        self.forward(Ev::Local(dest_hash, raw, packet_hash));
    }

    fn on_link_established(
        &mut self,
        link_id: LinkId,
        dest_hash: DestHash,
        rtt: f64,
        is_initiator: bool,
    ) {
        let mine = {
            let mut book = self.hub.book();
            if is_initiator {
                book.established.insert(link_id.0);
            }
            book.watched.contains(&link_id.0)
        };
        self.hub.cv.notify_all();
        if !is_initiator {
            self.inbound.insert(link_id.0, dest_hash.0);
        }
        if !mine {
            self.forward(Ev::LinkUp(link_id, dest_hash, rtt, is_initiator));
        }
    }

    fn on_link_closed(&mut self, link_id: LinkId, reason: Option<TeardownReason>) {
        self.inbound.remove(&link_id.0);
        let mine = {
            let mut book = self.hub.book();
            book.established.remove(&link_id.0);
            let mine = book.watched.contains(&link_id.0);
            if mine {
                book.closed.insert(link_id.0);
            }
            mine
        };
        self.hub.cv.notify_all();
        if !mine {
            self.forward(Ev::LinkDown(link_id, reason));
        }
    }

    fn on_remote_identified(
        &mut self,
        link_id: LinkId,
        identity_hash: IdentityHash,
        public_key: [u8; 64],
    ) {
        self.forward(Ev::Identified(link_id, identity_hash, public_key));
    }

    fn on_resource_received(&mut self, link_id: LinkId, data: Vec<u8>, metadata: Option<Vec<u8>>) {
        if !self.is_watched(&link_id) {
            self.forward(Ev::Resource(link_id, data, metadata));
        }
    }

    fn on_resource_completed(&mut self, link_id: LinkId) {
        if !self.is_watched(&link_id) {
            self.forward(Ev::ResourceDone(link_id));
        }
    }

    fn on_resource_failed(&mut self, link_id: LinkId, error: String) {
        if !self.is_watched(&link_id) {
            self.forward(Ev::ResourceFailed(link_id, error));
        }
    }

    fn on_resource_progress(&mut self, link_id: LinkId, received: usize, total: usize) {
        let mine = {
            let mut book = self.hub.book();
            let mine = book.watched.contains(&link_id.0);
            if mine {
                book.progress.insert(link_id.0, Instant::now());
            }
            mine
        };
        if !mine {
            self.forward(Ev::ResourceProgress(link_id, received, total));
            return;
        }
        self.hub.cv.notify_all();
        // Ход скачивания — интерфейсу, не чаще раза в PROGRESS_EVERY.
        let due = self
            .last_progress
            .is_none_or(|t| t.elapsed() >= PROGRESS_EVERY)
            || received >= total;
        if due {
            self.last_progress = Some(Instant::now());
            self.hub.emit(RnsEvent::Progress {
                received: received as u64,
                total: total as u64,
            });
        }
    }

    /// Ресурсом приходят только большие сообщения нам. Узлом доставки мы не
    /// работаем — чужие ресурсы не принимаем. Ответы на свои запросы
    /// принимаются драйвером сами, сюда не попадают.
    fn on_resource_accept_query(
        &mut self,
        link_id: LinkId,
        resource_hash: Vec<u8>,
        transfer_size: u64,
        _has_metadata: bool,
    ) -> bool {
        let accept = self.inbound.get(&link_id.0) == Some(&self.own_delivery)
            && transfer_size <= self.delivery_limit;
        if accept {
            self.forward(Ev::ResourceAccepted(link_id, resource_hash, transfer_size));
        }
        accept
    }

    fn on_link_data(&mut self, link_id: LinkId, context: u8, data: Vec<u8>) {
        self.forward(Ev::Data(link_id, context, data));
    }

    fn on_response(&mut self, link_id: LinkId, request_id: [u8; 16], data: Vec<u8>) {
        self.on_response_with_metadata(link_id, request_id, data, None);
    }

    fn on_response_with_metadata(
        &mut self,
        link_id: LinkId,
        request_id: [u8; 16],
        data: Vec<u8>,
        metadata: Option<Vec<u8>>,
    ) {
        let mut data = Some(data);
        let mine = {
            let mut book = self.hub.book();
            let mine = book.watched.contains(&link_id.0);
            if mine {
                if let Some(d) = data.take() {
                    book.responses
                        .entry(link_id.0)
                        .or_default()
                        .push_back((d, metadata.clone()));
                }
            }
            mine
        };
        if mine {
            self.hub.cv.notify_all();
        } else if let Some(d) = data {
            self.forward(Ev::Response(link_id, request_id, d, metadata));
        }
    }

    fn on_proof(&mut self, dest_hash: DestHash, packet_hash: PacketHash, rtt: f64) {
        self.forward(Ev::Proof(dest_hash, packet_hash, rtt));
    }
}

// ---------------------------------------------------------------------------
// Исходящие

/// Что стало с сообщением, зашифрованным нам целиком.
#[derive(Debug, PartialEq, Eq)]
enum Sealed {
    Delivered,
    Duplicate,
    NotOurs,
}

/// Своё исходящее сообщение: что показано интерфейсу и как переслать, если
/// прямая доставка не удалась.
struct Tracked {
    method: DeliveryMethod,
    /// Способ «auto»: не дошло напрямую — через узел доставки.
    fallback: bool,
    state: &'static str,
    job: SendJob,
}

#[derive(Clone)]
struct SendJob {
    id: [u8; 32],
    dest: [u8; 16],
    timestamp: f64,
    title: String,
    content: String,
    /// Поля LXMF (вложения).
    fields: Vec<(Value, Value)>,
    method: DeliveryMethod,
}

/// Link к узлу NomadNet и когда им пользовались.
type PageLink = ([u8; 16], Instant);

struct Ctx {
    hub: Arc<Hub>,
    router: Arc<Mutex<LxmRouter>>,
    node: Weak<RnsNode>,
    identity: Identity,
    delivery_hash: [u8; 16],
    ifaces: Vec<IfaceConfig>,
    send_tx: Mutex<mpsc::Sender<SendJob>>,
    tracked: Mutex<HashMap<[u8; 32], Tracked>>,
    sync_busy: AtomicBool,
    /// Узел NomadNet → (Link, когда им пользовались).
    page_links: Mutex<HashMap<[u8; 16], PageLink>>,
    page_lock: Mutex<()>,
    /// Флаг отмены штампа, который считается сейчас.
    stamp_cancel: Mutex<Option<Arc<AtomicBool>>>,
}

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|p| p.into_inner())
}

/// jobs роутера и привязка ресурсов к Link. lxmf-rs отдаёт сообщение
/// ресурсом по уже открытому Link (прямому или к узлу доставки), не запомнив
/// этот Link у сообщения, — и доказательство ресурса не находит, чьё оно:
/// сообщение навсегда остаётся в Sending. Привязать сразу, под той же
/// блокировкой, пока доказательство не пришло.
fn jobs(router: &mut LxmRouter) {
    router.jobs();
    let (direct, pn_link) = (router.direct_links.clone(), router.propagation_link);
    for msg in &mut router.outbound {
        if msg.state != MessageState::Sending
            || msg.link_id.is_some()
            || msg.representation != Representation::Resource
        {
            continue;
        }
        msg.link_id = match msg.method {
            DeliveryMethod::Direct => direct.get(&msg.destination_hash).copied(),
            DeliveryMethod::Propagated => pn_link,
            _ => None,
        };
    }
}

impl Ctx {
    fn node(&self) -> Result<Arc<RnsNode>, String> {
        if !self.hub.running.load(Ordering::SeqCst) {
            return Err(err("rns_not_running"));
        }
        self.node.upgrade().ok_or_else(|| err("rns_not_running"))
    }

    fn router(&self) -> MutexGuard<'_, LxmRouter> {
        lock(&self.router)
    }

    fn announce(&self) {
        self.router().announce_delivery(&self.identity);
    }

    /// Публичный ключ адресата: из кэша роутера или из известных узлу адресов
    /// (после перезапуска кэш роутера пуст). Найденный кладётся в кэш роутера —
    /// без него прямая доставка не откроет Link.
    fn recall_key(&self, dest: [u8; 16]) -> Option<[u8; 64]> {
        if let Some(key) = self.router().identity_cache.get(&dest).copied() {
            return Some(key);
        }
        let known = self.node().ok()?.recall_identity(&DestHash(dest)).ok()??;
        let mut router = self.router();
        router.identity_cache.insert(dest, known.public_key);
        router
            .identity_hash_cache
            .insert(dest, known.identity_hash.0);
        Some(known.public_key)
    }

    fn await_path(&self, dest: [u8; 16], deadline: Instant) -> Result<(), String> {
        let node = self.node()?;
        if node.has_path(&DestHash(dest)).map_err(not_running)? {
            return Ok(());
        }
        node.request_path(&DestHash(dest)).map_err(not_running)?;
        drop(node);
        while Instant::now() < deadline {
            thread::sleep(TICK);
            if self.node()?.has_path(&DestHash(dest)).map_err(not_running)? {
                return Ok(());
            }
        }
        Err(err("rns_no_path"))
    }

    /// Открыть свой Link к адресату и дождаться установки.
    fn open_link(&self, dest: [u8; 16], timeout: Duration) -> Result<[u8; 16], String> {
        let deadline = Instant::now() + timeout;
        self.await_path(dest, deadline)?;
        let node = self.node()?;
        let known = node
            .recall_identity(&DestHash(dest))
            .map_err(not_running)?
            .ok_or_else(|| err("rns_unknown_destination"))?;
        let mut sig_pub = [0u8; 32];
        sig_pub.copy_from_slice(&known.public_key[32..]);
        let link = node
            .create_link(dest, sig_pub)
            .map_err(|_| err("rns_link_failed"))?;
        self.hub.watch(link);
        drop(node);
        let left = deadline
            .saturating_duration_since(Instant::now())
            .max(Duration::from_secs(5));
        match self.hub.wait_established(link, left) {
            Some(true) => Ok(link),
            outcome => {
                if let Ok(node) = self.node() {
                    let _ = node.teardown_link(link);
                }
                self.hub.unwatch(&link);
                Err(err(if outcome.is_none() {
                    "rns_timeout"
                } else {
                    "rns_link_failed"
                }))
            }
        }
    }

    fn close_link(&self, link: [u8; 16]) {
        if let Some(node) = self.node.upgrade() {
            let _ = node.teardown_link(link);
        }
        self.hub.unwatch(&link);
    }

    fn request(&self, link: [u8; 16], path: &str, data: &Value) -> Result<(), String> {
        self.node()?
            .send_request(link, path, &msgpack::pack(data))
            .map_err(not_running)
    }

    // --- отправка ---------------------------------------------------------

    fn queue(&self, job: SendJob, fallback: bool) {
        lock(&self.tracked).insert(
            job.id,
            Tracked {
                method: job.method,
                fallback,
                state: "sending",
                job: job.clone(),
            },
        );
        let _ = lock(&self.send_tx).send(job);
    }

    fn sign_pack(&self, job: &SendJob, stamp: Option<&[u8]>) -> Result<message::PackResult, String> {
        message::pack(
            &job.dest,
            &self.delivery_hash,
            job.timestamp,
            job.title.as_bytes(),
            job.content.as_bytes(),
            job.fields.clone(),
            stamp,
            |data| {
                self.identity
                    .sign(data)
                    .map_err(|_| message::Error::SignError)
            },
        )
        .map_err(|e| format!("rns_error: {e:?}"))
    }

    fn stamp(&self, material: &[u8], cost: u8, rounds: u32) -> Result<[u8; STAMP_SIZE], String> {
        if cost > MAX_STAMP_COST {
            return Err(err("rns_stamp_too_expensive"));
        }
        let cancel = Arc::new(AtomicBool::new(false));
        *lock(&self.stamp_cancel) = Some(cancel.clone());
        let stamp = generate_stamp(material, cost, rounds, cancel);
        *lock(&self.stamp_cancel) = None;
        stamp
            .map(|(s, _)| s)
            .ok_or_else(|| err("rns_not_running"))
    }

    /// Стоимость штампа узла доставки: из announce; если его не слышали —
    /// запросить путь (ответ несёт announce) и подождать.
    fn pn_cost(&self, pn: [u8; 16]) -> Result<u8, String> {
        let deadline = Instant::now() + PATH_TIMEOUT;
        loop {
            if let Some(cost) = lock(&self.hub.pn_costs).get(&pn).copied() {
                return Ok(cost);
            }
            let known = self.node()?.recall_identity(&DestHash(pn)).map_err(not_running)?;
            if let Some(cost) = known
                .and_then(|k| k.app_data)
                .and_then(|d| announce::pn_stamp_cost_from_app_data(&d))
            {
                lock(&self.hub.pn_costs).insert(pn, cost);
                return Ok(cost);
            }
            if Instant::now() >= deadline {
                return Err(err("rns_no_path"));
            }
            let _ = self.node()?.request_path(&DestHash(pn));
            thread::sleep(Duration::from_secs(1));
        }
    }

    /// Собрать сообщение для роутера: штамп адресата, для узла доставки —
    /// шифрование адресату и штамп узла.
    fn prepare(&self, job: &SendJob) -> Result<OutboundMessage, String> {
        let cost = self.router().get_stamp_cost(&job.dest).filter(|c| *c > 0);
        let stamp = match cost {
            Some(cost) => Some(self.stamp(&job.id, cost, WORKBLOCK_EXPAND_ROUNDS)?),
            None => None,
        };
        let packed = self.sign_pack(job, stamp.as_ref().map(|s| &s[..]))?;
        let mut method = job.method;
        if method == DeliveryMethod::Opportunistic
            && packed.packed.len() - DESTINATION_LENGTH > ENCRYPTED_PACKET_MDU
        {
            // В один пакет не влезает — как Python LXMF, через Link.
            method = DeliveryMethod::Direct;
        }
        let (propagation_packed, propagation_stamp, transient_id) =
            if method == DeliveryMethod::Propagated {
                let pn = self
                    .router()
                    .outbound_propagation_node
                    .ok_or_else(|| err("rns_no_propagation_node"))?;
                let key = self
                    .recall_key(job.dest)
                    .ok_or_else(|| err("rns_unknown_destination"))?;
                let recipient = Identity::from_public_key(&key);
                let encrypted = recipient
                    .encrypt(&packed.packed[DESTINATION_LENGTH..], &mut OsRng)
                    .map_err(|_| err("rns_error: encrypt"))?;
                let mut lxmf_data = job.dest.to_vec();
                lxmf_data.extend_from_slice(&encrypted);
                let transient_id = sha256(&lxmf_data);
                let pn_stamp = self.stamp(
                    &transient_id,
                    self.pn_cost(pn)?,
                    WORKBLOCK_EXPAND_ROUNDS_PN,
                )?;
                let (prop, tid) =
                    message::propagation_pack(&packed.packed, now_timestamp(), Some(&pn_stamp), |_| {
                        Ok(encrypted.clone())
                    })
                    .map_err(|e| format!("rns_error: {e:?}"))?;
                (Some(prop), Some(pn_stamp.to_vec()), Some(tid))
            } else {
                (None, None, None)
            };
        if method == DeliveryMethod::Direct {
            // Роутер открывает Link только к адресатам из своего кэша ключей.
            self.recall_key(job.dest);
        }
        Ok(OutboundMessage {
            destination_hash: job.dest,
            source_hash: self.delivery_hash,
            packed: packed.packed,
            message_hash: packed.message_hash,
            method,
            state: MessageState::Outbound,
            representation: Representation::Unknown,
            attempts: 0,
            last_attempt: 0.0,
            stamp: stamp.map(|s| s.to_vec()),
            stamp_cost: cost,
            propagation_packed,
            propagation_stamp,
            transient_id,
            delivery_callback: None,
            failed_callback: None,
            progress_callback: None,
            link_id: None,
            packet_hash: None,
        })
    }

    fn fail(&self, id: [u8; 32], reason: String) {
        lock(&self.tracked).remove(&id);
        self.hub.emit(RnsEvent::State {
            id: hex::encode(id),
            state: "failed".into(),
            reason: Some(reason),
        });
    }

    fn sender_loop(&self, rx: mpsc::Receiver<SendJob>) {
        while self.hub.running.load(Ordering::SeqCst) {
            let job = match rx.recv_timeout(TICK) {
                Ok(job) => job,
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => return,
            };
            match self.prepare(&job) {
                Ok(msg) => {
                    let method = msg.method;
                    if let Some(t) = lock(&self.tracked).get_mut(&job.id) {
                        t.method = method;
                    }
                    let mut router = self.router();
                    match router.handle_outbound(msg) {
                        Ok(()) => jobs(&mut router),
                        Err(_) => {
                            drop(router);
                            self.fail(job.id, err("rns_no_propagation_node"));
                        }
                    }
                }
                Err(reason) => {
                    if self.hub.running.load(Ordering::SeqCst) {
                        self.fail(job.id, reason);
                    }
                }
            }
        }
    }

    /// Судьба своих сообщений в очереди роутера → события интерфейсу;
    /// законченные из очереди убираются (роутер их не удаляет сам).
    fn poll_outbound(&self, router: &mut LxmRouter) {
        let mut tracked = lock(&self.tracked);
        let pn = router.outbound_propagation_node;
        let mut retry = Vec::new();
        let mut finished = HashSet::new();
        for msg in &router.outbound {
            let Some(t) = tracked.get_mut(&msg.message_hash) else {
                continue;
            };
            if t.method != msg.method {
                // Прежняя попытка сообщения, которое уже пересылается иначе.
                finished.insert((msg.message_hash, msg.method as u8));
                continue;
            }
            // Пакет узлу доставки роутер шлёт по Link без квитанции и оставляет
            // в Sending: отправлен — значит на узле (как прямые пакеты по Link).
            let packet_on_pn = msg.method == DeliveryMethod::Propagated
                && msg.state == MessageState::Sending
                && msg.representation == Representation::Packet;
            let state = if packet_on_pn { "sent" } else { state_name(msg.state) };
            let done = match state {
                "delivered" | "failed" => true,
                "sent" => msg.method == DeliveryMethod::Propagated,
                _ => false,
            };
            if state == "failed" && t.fallback && pn.is_some() {
                t.fallback = false;
                t.method = DeliveryMethod::Propagated;
                let mut job = t.job.clone();
                job.method = DeliveryMethod::Propagated;
                retry.push(job);
                finished.insert((msg.message_hash, msg.method as u8));
                continue;
            }
            if state != t.state {
                t.state = state;
                self.hub.emit(RnsEvent::State {
                    id: hex::encode(msg.message_hash),
                    state: state.into(),
                    reason: None,
                });
            }
            if done {
                finished.insert((msg.message_hash, msg.method as u8));
            }
        }
        router
            .outbound
            .retain(|m| !finished.contains(&(m.message_hash, m.method as u8)));
        tracked.retain(|id, t| {
            // Сообщение ушло из очереди окончательно — больше не следим.
            !(matches!(t.state, "delivered" | "failed")
                || (t.state == "sent" && t.method == DeliveryMethod::Propagated))
                || retry.iter().any(|j| j.id == *id)
        });
        drop(tracked);
        let tx = lock(&self.send_tx);
        for job in retry {
            let _ = tx.send(job);
        }
    }

    // --- интерфейсы и адреса ---------------------------------------------

    fn interface_status(&self, node: &RnsNode) -> Vec<IfaceStatus> {
        let stats = match node.query(QueryRequest::InterfaceStats) {
            Ok(QueryResponse::InterfaceStats(s)) => s.interfaces,
            _ => Vec::new(),
        };
        self.ifaces
            .iter()
            .map(|cfg| {
                let name = cfg.name();
                // AutoInterface заводит по подынтерфейсу на соседа: «имя:адрес».
                let prefix = format!("{name}:");
                let mine: Vec<_> = stats
                    .iter()
                    .filter(|s| s.name == name || s.name.starts_with(&prefix))
                    .collect();
                IfaceStatus {
                    kind: cfg.kind().to_string(),
                    // Нет в списке — не поднялся при старте (хаб недоступен,
                    // RNode не подключён); rns-net его больше не пробует. У
                    // AutoInterface своей записи нет вовсе — только соседи.
                    started: !mine.is_empty() || matches!(cfg, IfaceConfig::Auto),
                    online: mine.iter().any(|s| s.status),
                    rx_bytes: mine.iter().map(|s| s.rxb).sum(),
                    tx_bytes: mine.iter().map(|s| s.txb).sum(),
                    name,
                }
            })
            .collect()
    }

    /// Настроенный интерфейс по имени из статистики rns-net (у AutoInterface
    /// подынтерфейсы соседей — «имя:адрес»).
    fn configured(&self, stat_name: &str) -> Option<&IfaceConfig> {
        self.ifaces.iter().find(|cfg| {
            let name = cfg.name();
            stat_name == name
                || stat_name
                    .strip_prefix(&name)
                    .is_some_and(|rest| rest.starts_with(':'))
        })
    }

    /// Таблица путей узла: куда он знает дорогу, через кого и по какому
    /// интерфейсу. Ближние — первыми.
    fn paths(&self, node: &RnsNode) -> Vec<PathInfo> {
        let entries = match node.query(QueryRequest::PathTable { max_hops: None }) {
            Ok(QueryResponse::PathTable(p)) => p,
            _ => Vec::new(),
        };
        let mut out: Vec<PathInfo> = entries
            .into_iter()
            .filter(|e| e.hash != self.delivery_hash)
            .map(|e| {
                let cfg = self.configured(&e.interface_name);
                PathInfo {
                    dest: hex::encode(e.hash),
                    hops: e.hops,
                    via: (e.hops > 1 && e.via != e.hash && e.via != [0; 16])
                        .then(|| hex::encode(e.via)),
                    interface: cfg.map(IfaceConfig::name).unwrap_or(e.interface_name),
                    kind: cfg.map(|c| c.kind().to_string()).unwrap_or_default(),
                    updated: e.timestamp,
                    expires: e.expires,
                }
            })
            .collect();
        out.sort_by(|a, b| a.hops.cmp(&b.hops).then_with(|| a.dest.cmp(&b.dest)));
        out
    }

    /// Разослать изменения интерфейсов; true — какой-то только что поднялся.
    fn poll_interfaces(&self, node: &RnsNode, online: &mut HashMap<String, bool>) -> bool {
        let mut came_up = false;
        for s in self.interface_status(node) {
            let was = online.insert(s.name.clone(), s.online);
            if was != Some(s.online) {
                came_up |= s.online;
                if was.is_some() || s.online {
                    self.hub.emit(RnsEvent::Interface {
                        name: s.name,
                        online: s.online,
                    });
                }
            }
        }
        came_up
    }

    /// Адреса, которые узел помнит с прошлых запусков: в кэш ключей роутера
    /// (подписи входящих, прямая доставка) и интерфейсу — как announce.
    fn known_destinations(&self, emit: bool) {
        let Ok(node) = self.node() else { return };
        let Ok(known) = node.known_destinations() else {
            return;
        };
        drop(node);
        let mut events = Vec::new();
        {
            let mut router = self.router();
            for k in &known {
                router.identity_cache.insert(k.dest_hash, k.public_key);
                router.identity_hash_cache.insert(k.dest_hash, k.identity_hash);
            }
        }
        for k in known {
            if k.dest_hash == self.delivery_hash {
                continue;
            }
            if let Some((ev, pn_cost)) = peer_event(
                k.dest_hash,
                k.identity_hash,
                k.app_data.as_deref(),
                k.hops,
                k.received_at,
            ) {
                if let Some(cost) = pn_cost {
                    lock(&self.hub.pn_costs).insert(k.dest_hash, cost);
                }
                events.push(ev);
            }
        }
        if emit {
            for ev in events {
                self.hub.emit(ev);
            }
        }
    }

    fn expire_page_links(&self) {
        let stale: Vec<[u8; 16]> = {
            let mut links = lock(&self.page_links);
            let stale = links
                .values()
                .filter(|(_, used)| used.elapsed() >= PAGE_LINK_IDLE)
                .map(|(link, _)| *link)
                .collect::<Vec<_>>();
            links.retain(|_, (_, used)| used.elapsed() < PAGE_LINK_IDLE);
            stale
        };
        for link in stale {
            self.close_link(link);
        }
    }

    fn worker_loop(&self) {
        let started = Instant::now();
        let mut last_jobs = started;
        let mut last_ifaces: Option<Instant> = None;
        let mut last_announce: Option<Instant> = None;
        let mut replayed = false;
        let mut online = HashMap::new();
        while self.hub.running.load(Ordering::SeqCst) {
            if last_jobs.elapsed() >= JOBS_EVERY {
                let mut router = self.router();
                jobs(&mut router);
                self.poll_outbound(&mut router);
                drop(router);
                last_jobs = Instant::now();
            }
            if !replayed && started.elapsed() >= REPLAY_AFTER {
                self.known_destinations(true);
                replayed = true;
            }
            if last_ifaces.is_none_or(|t| t.elapsed() >= IFACES_EVERY) {
                if let Ok(node) = self.node() {
                    let came_up = self.poll_interfaces(&node, &mut online);
                    drop(node);
                    // Связь появилась — объявить адрес, чтобы нас нашли.
                    if came_up && last_announce.is_none_or(|t| t.elapsed() >= MIN_REANNOUNCE) {
                        self.announce();
                        last_announce = Some(Instant::now());
                    }
                }
                self.expire_page_links();
                last_ifaces = Some(Instant::now());
            }
            if last_announce.is_some_and(|t| t.elapsed() >= ANNOUNCE_EVERY) {
                self.announce();
                last_announce = Some(Instant::now());
            }
            thread::sleep(TICK);
        }
    }

    // --- узел доставки ------------------------------------------------------

    /// Сообщение, зашифрованное нашему адресу целиком (скачанное с узла
    /// доставки или бумажное): расшифровать и отдать роутеру.
    fn open_sealed(&self, lxmf_data: &[u8], method: DeliveryMethod) -> Sealed {
        if lxmf_data.len() <= DESTINATION_LENGTH || lxmf_data[..DESTINATION_LENGTH] != self.delivery_hash {
            return Sealed::NotOurs;
        }
        let transient_id = sha256(lxmf_data);
        let mut router = self.router();
        if router.locally_delivered_transient_ids.contains_key(&transient_id) {
            return Sealed::Duplicate;
        }
        let Ok(plain) = self.identity.decrypt(&lxmf_data[DESTINATION_LENGTH..]) else {
            return Sealed::NotOurs;
        };
        let mut bytes = self.delivery_hash.to_vec();
        bytes.extend_from_slice(&plain);
        router.lxmf_delivery(&bytes, true, ENCRYPTION_DESCRIPTION_EC, method);
        router
            .locally_delivered_transient_ids
            .insert(transient_id, now_timestamp());
        Sealed::Delivered
    }

    fn get_request(
        &self,
        link: [u8; 16],
        wants: Option<&[[u8; 32]]>,
        haves: Option<&[[u8; 32]]>,
        timeout: Duration,
    ) -> Result<Value, String> {
        let list = |ids: Option<&[[u8; 32]]>| match ids {
            Some(ids) => Value::Array(ids.iter().map(|id| Value::Bin(id.to_vec())).collect()),
            None => Value::Nil,
        };
        let limit_kb = self.router().config.delivery_limit;
        let mut request = vec![list(wants), list(haves)];
        if wants.is_some() {
            request.push(Value::Float(limit_kb));
        }
        self.request(link, MESSAGE_GET_PATH, &Value::Array(request))?;
        match self.hub.wait_response(link, timeout) {
            Some(Ok(bytes)) => msgpack::unpack_exact(&bytes).map_err(|_| err("rns_bad_response")),
            Some(Err(())) => Err(err("rns_link_closed")),
            None => Err(err("rns_timeout")),
        }
    }

    fn run_sync(&self, pn: [u8; 16]) -> Result<u32, String> {
        self.hub.emit(RnsEvent::Sync {
            state: "requesting".into(),
            received: 0,
        });
        let link = self.open_link(pn, LINK_TIMEOUT)?;
        let result = (|| {
            let prv = self
                .identity
                .get_private_key()
                .ok_or_else(|| err("rns_error: identity"))?;
            self.node()?.identify_on_link(link, prv).map_err(not_running)?;
            let ids: Vec<[u8; 32]> = match self.get_request(link, None, None, SYNC_LIST_TIMEOUT)? {
                Value::Array(items) => items
                    .iter()
                    .filter_map(|v| v.as_bin().and_then(|b| b.try_into().ok()))
                    .collect(),
                Value::UInt(code) => return Err(format!("rns_sync_refused: {code}")),
                Value::Nil => Vec::new(),
                _ => return Err(err("rns_bad_response")),
            };
            let (haves, wants): (Vec<[u8; 32]>, Vec<[u8; 32]>) = {
                let router = self.router();
                ids.into_iter()
                    .partition(|id| router.locally_delivered_transient_ids.contains_key(id))
            };
            let mut received = 0u32;
            let mut purge = haves;
            if !wants.is_empty() {
                self.hub.emit(RnsEvent::Sync {
                    state: "receiving".into(),
                    received: 0,
                });
            }
            for chunk in wants.chunks(IDS_PER_REQUEST) {
                let messages = match self.get_request(link, Some(chunk), Some(&[]), SYNC_GET_TIMEOUT)? {
                    Value::Array(items) => items,
                    Value::UInt(code) => return Err(format!("rns_sync_refused: {code}")),
                    _ => Vec::new(),
                };
                for m in &messages {
                    if let Some(data) = m.as_bin() {
                        if self.open_sealed(data, DeliveryMethod::Propagated) == Sealed::Delivered {
                            received += 1;
                        }
                        purge.push(sha256(data));
                    }
                }
                self.hub.emit(RnsEvent::Sync {
                    state: "receiving".into(),
                    received,
                });
            }
            // Полученное — удалить на узле, как это делает Python LXMF.
            for chunk in purge.chunks(IDS_PER_REQUEST) {
                let _ = self.get_request(link, None, Some(chunk), Duration::from_secs(15));
            }
            Ok(received)
        })();
        self.close_link(link);
        result
    }

    // --- страницы NomadNet -------------------------------------------------

    fn page_link(&self, node_hash: [u8; 16]) -> Result<[u8; 16], String> {
        let cached = lock(&self.page_links).get(&node_hash).map(|(l, _)| *l);
        if let Some(link) = cached {
            let alive = {
                let book = self.hub.book();
                book.established.contains(&link) && !book.closed.contains(&link)
            };
            if alive {
                return Ok(link);
            }
            lock(&self.page_links).remove(&node_hash);
            self.hub.unwatch(&link);
        }
        let link = self.open_link(node_hash, LINK_TIMEOUT)?;
        lock(&self.page_links).insert(node_hash, (link, Instant::now()));
        Ok(link)
    }

    fn drop_page_link(&self, node_hash: [u8; 16]) {
        if let Some((link, _)) = lock(&self.page_links).remove(&node_hash) {
            self.close_link(link);
        }
    }
}

fn parse_page(bytes: &[u8]) -> Result<Page, String> {
    match msgpack::unpack_exact(bytes) {
        Ok(Value::Bin(b)) => Ok(Page {
            content: String::from_utf8_lossy(&b).into_owned(),
            binary: std::str::from_utf8(&b).is_err(),
        }),
        Ok(Value::Str(s)) => Ok(Page {
            content: s,
            binary: false,
        }),
        Ok(Value::Nil) => Err(err("rns_page_not_found")),
        Ok(_) => Ok(Page {
            content: String::new(),
            binary: true,
        }),
        Err(_) => Err(err("rns_bad_response")),
    }
}

/// Ответ на `/file/…`. NomadNet 0.5+ шлёт файл ресурсом с метаданными
/// `{"name": байты}`, прежние узлы — msgpack `[имя, байты]`; отказ приходит
/// страницей.
fn parse_download(bytes: &[u8], metadata: Option<&[u8]>, path: &str) -> Result<Download, String> {
    let value = msgpack::unpack_exact(bytes).map_err(|_| err("rns_bad_response"))?;
    let from_path = || file_name(path);
    if let Some(meta) = metadata {
        let name = match msgpack::unpack_exact(meta) {
            Ok(Value::Map(entries)) => entries
                .iter()
                .find(|(k, _)| text_of(k).as_deref() == Some("name"))
                .and_then(|(_, v)| text_of(v)),
            _ => None,
        };
        let Value::Bin(data) = value else {
            return Err(err("rns_bad_response"));
        };
        return Ok(Download::File {
            name: name.map(|n| file_name(&n)).unwrap_or_else(from_path),
            data,
        });
    }
    match value {
        Value::Array(items) if items.len() == 2 => match (text_of(&items[0]), &items[1]) {
            (Some(name), Value::Bin(data)) => Ok(Download::File {
                name: file_name(&name),
                data: data.clone(),
            }),
            _ => Err(err("rns_bad_response")),
        },
        Value::Bin(b) if std::str::from_utf8(&b).is_err() => Ok(Download::File {
            name: from_path(),
            data: b,
        }),
        other => parse_page(&msgpack::pack(&other)).map(Download::Page),
    }
}

// ---------------------------------------------------------------------------
// Внешний интерфейс модуля

/// Запущенный узел. Останавливать через `stop` — иначе потоки живут дальше.
pub struct Runtime {
    ctx: Arc<Ctx>,
    node: Arc<RnsNode>,
    worker: Option<JoinHandle<()>>,
    sender: Option<JoinHandle<()>>,
    started: Started,
}

/// Для долгих запросов (страницы) вне блокировки менеджера.
pub struct Handle {
    ctx: Arc<Ctx>,
}

impl Runtime {
    pub fn start(
        options: StartOptions,
        dir: PathBuf,
        sink: impl Fn(RnsEvent) + Send + Sync + 'static,
    ) -> Result<Runtime, String> {
        let prv: [u8; 64] = options
            .identity
            .as_slice()
            .try_into()
            .map_err(|_| err("rns_error: identity must be 64 bytes"))?;
        let config = config_text(&options.interfaces)?;
        std::fs::create_dir_all(&dir).map_err(|e| format!("rns_error: {e}"))?;
        std::fs::write(dir.join("config"), config).map_err(|e| format!("rns_error: {e}"))?;
        let propagation_node = match options.propagation_node.as_deref() {
            Some(h) if !h.is_empty() => Some(crate::types::parse_hash::<16>(h)?),
            _ => None,
        };

        let identity = Identity::from_private_key(&prv);
        let identity_hash = *identity.hash();
        let delivery_hash = delivery_hash_of(&identity_hash);
        let hub = Arc::new(Hub {
            sink: Box::new(sink),
            running: AtomicBool::new(true),
            book: Mutex::new(LinkBook::default()),
            cv: Condvar::new(),
            pn_costs: Mutex::new(HashMap::new()),
        });

        let mut router = LxmRouter::new(
            Identity::from_private_key(&prv),
            RouterConfig {
                storagepath: dir.join("lxmf"),
                ..RouterConfig::default()
            },
        );
        {
            let hub = hub.clone();
            router.set_delivery_callback(Box::new(move |d| {
                if d.destination_hash == delivery_hash {
                    hub.emit(message_event(d));
                }
            }));
        }
        router.outbound_propagation_node = propagation_node;
        let delivery_limit = (router.config.delivery_limit * 1000.0) as u64;
        let router = Arc::new(Mutex::new(router));
        let (ev_tx, ev_rx) = mpsc::channel();
        let bridge = Bridge {
            tx: ev_tx,
            hub: hub.clone(),
            own_delivery: delivery_hash,
            inbound: HashMap::new(),
            delivery_limit,
            last_progress: None,
        };
        {
            let router = router.clone();
            thread::Builder::new()
                .name("rns-lxmf".into())
                .spawn(move || callbacks_loop(router, ev_rx))
                .map_err(|e| format!("rns_error: {e}"))?;
        }
        let node = Arc::new(
            RnsNode::from_config(Some(&dir), Box::new(bridge))
                .map_err(|e| format!("rns_error: {e}"))?,
        );

        {
            let mut r = lock(&router);
            r.set_node(node.clone());
            let name = options.display_name.trim();
            r.register_delivery_identity(
                &identity,
                None,
                (!name.is_empty()).then(|| name.to_string()),
            );
        }
        // Доказательства доставки для пакетов на наш адрес: без них отправитель
        // «оппортунистического» сообщения так и не узнает, что оно дошло.
        let mut delivery = Destination::single_in(LXMF, &["delivery"], IdentityHash(identity_hash));
        delivery.proof_strategy = ProofStrategy::ProveAll;
        let _ = node.register_destination_with_proof(&delivery, identity.get_private_key());

        let (send_tx, send_rx) = mpsc::channel();
        let ctx = Arc::new(Ctx {
            hub,
            router,
            node: Arc::downgrade(&node),
            identity,
            delivery_hash,
            ifaces: options.interfaces,
            send_tx: Mutex::new(send_tx),
            tracked: Mutex::new(HashMap::new()),
            sync_busy: AtomicBool::new(false),
            page_links: Mutex::new(HashMap::new()),
            page_lock: Mutex::new(()),
            stamp_cancel: Mutex::new(None),
        });
        // Ключи известных адресов — сразу, до первых сообщений.
        ctx.known_destinations(false);
        if let Some(pn) = propagation_node {
            let _ = node.request_path(&DestHash(pn));
        }

        let worker = {
            let ctx = ctx.clone();
            let node = node.clone();
            thread::Builder::new()
                .name("rns-worker".into())
                .spawn(move || {
                    // Держит узел, пока работает: stop дожидается потока.
                    let _node = node;
                    ctx.worker_loop();
                })
                .map_err(|e| format!("rns_error: {e}"))?
        };
        let sender = {
            let ctx = ctx.clone();
            thread::Builder::new()
                .name("rns-sender".into())
                .spawn(move || ctx.sender_loop(send_rx))
                .map_err(|e| format!("rns_error: {e}"))?
        };

        Ok(Runtime {
            started: Started {
                address: hex::encode(delivery_hash),
                identity_hash: hex::encode(identity_hash),
            },
            ctx,
            node,
            worker: Some(worker),
            sender: Some(sender),
        })
    }

    pub fn started(&self) -> Started {
        self.started.clone()
    }

    pub fn status(&self) -> Status {
        let paths = match self.node.query(QueryRequest::PathTable { max_hops: None }) {
            Ok(QueryResponse::PathTable(p)) => p.len(),
            _ => 0,
        };
        Status {
            running: true,
            interfaces: self.ctx.interface_status(&self.node),
            paths,
            propagation_node: self.ctx.router().outbound_propagation_node.map(hex::encode),
        }
    }

    pub fn announce(&self) -> Result<(), String> {
        self.ctx.announce();
        Ok(())
    }

    /// Запомнить публичный ключ адресата LXMF (из проверенной записи связки):
    /// писать ему можно, не дожидаясь его announce. Ключ должен давать этот адрес.
    pub fn learn(&self, dest: [u8; 16], public_key: [u8; 64]) -> Result<(), String> {
        let identity = Identity::from_public_key(&public_key);
        if delivery_hash_of(identity.hash()) != dest {
            return Err(err("rns_bad_key"));
        }
        let mut router = self.ctx.router();
        router.identity_cache.insert(dest, public_key);
        router.identity_hash_cache.insert(dest, *identity.hash());
        Ok(())
    }

    /// Обзор сети: известные узлу пути.
    pub fn paths(&self) -> Vec<PathInfo> {
        self.ctx.paths(&self.node)
    }

    /// Поставить сообщение в очередь; id — хэш сообщения LXMF (hex).
    /// `custom` — данные приложения (у Bastyon — запись связки с аккаунтом).
    pub fn send(
        &self,
        dest: [u8; 16],
        title: &str,
        content: &str,
        attachments: &[Attachment],
        method: Method,
        custom: Option<&Custom>,
    ) -> Result<String, String> {
        if dest == self.ctx.delivery_hash {
            return Err(err("rns_error: own address"));
        }
        let (lx_method, fallback) = match method {
            Method::Auto => (DeliveryMethod::Direct, true),
            Method::Direct => (DeliveryMethod::Direct, false),
            Method::Opportunistic => (DeliveryMethod::Opportunistic, false),
            Method::Propagated => (DeliveryMethod::Propagated, false),
        };
        let mut job = SendJob {
            id: [0; 32],
            dest,
            timestamp: now_timestamp(),
            title: title.to_string(),
            content: content.to_string(),
            fields: {
                let mut fields = fields_of(attachments)?;
                if let Some(c) = custom {
                    if c.kind.len() > 64 || c.data.len() > MAX_CUSTOM_BYTES {
                        return Err(err("rns_too_large"));
                    }
                    fields.push((Value::UInt(FIELD_CUSTOM_TYPE as u64), Value::Str(c.kind.clone())));
                    fields.push((
                        Value::UInt(FIELD_CUSTOM_DATA as u64),
                        Value::Bin(c.data.as_bytes().to_vec()),
                    ));
                }
                fields
            },
            method: lx_method,
        };
        // id не зависит от штампа — его можно вернуть сразу, а штамп считать потом.
        job.id = self.ctx.sign_pack(&job, None)?.message_hash;
        let id = hex::encode(job.id);
        self.ctx.queue(job, fallback);
        Ok(id)
    }

    /// Бумажное сообщение (`lxm://`): зашифровано адресату целиком, его можно
    /// передать как угодно — QR-кодом, текстом, — а адресат откроет ссылку.
    pub fn paper(&self, dest: [u8; 16], content: &str) -> Result<String, String> {
        let key = self
            .ctx
            .recall_key(dest)
            .ok_or_else(|| err("rns_unknown_destination"))?;
        let job = SendJob {
            id: [0; 32],
            dest,
            timestamp: now_timestamp(),
            title: String::new(),
            content: content.to_string(),
            fields: Vec::new(),
            method: DeliveryMethod::Paper,
        };
        let packed = self.ctx.sign_pack(&job, None)?;
        let recipient = Identity::from_public_key(&key);
        let paper = message::paper_pack(&packed.packed, |data| {
            recipient
                .encrypt(data, &mut OsRng)
                .map_err(|_| message::Error::EncryptError)
        })
        .map_err(|e| format!("rns_error: {e:?}"))?;
        if paper.len() > PAPER_MDU {
            return Err(err("rns_too_large"));
        }
        Ok(message::as_uri(&paper))
    }

    /// Открыть бумажное сообщение (`lxm://…`): оно придёт событием `message`.
    pub fn ingest(&self, uri: &str) -> Result<(), String> {
        // Python LXMF пишет ссылку без «=» и терпит лишние «/».
        let body = uri.trim().trim_start_matches("lxm://").replace('/', "");
        let data = message::from_uri(&format!("lxm://{body}")).map_err(|_| err("rns_bad_paper"))?;
        match self.ctx.open_sealed(&data, DeliveryMethod::Paper) {
            Sealed::NotOurs => Err(err("rns_paper_not_ours")),
            Sealed::Delivered | Sealed::Duplicate => Ok(()),
        }
    }

    pub fn request_path(&self, dest: [u8; 16]) -> Result<(), String> {
        self.node
            .request_path(&DestHash(dest))
            .map_err(not_running)
    }

    pub fn set_propagation_node(&self, node_hash: Option<[u8; 16]>) -> Result<(), String> {
        self.ctx.router().outbound_propagation_node = node_hash;
        if let Some(pn) = node_hash {
            let _ = self.node.request_path(&DestHash(pn));
        }
        Ok(())
    }

    /// Забрать сообщения с узла доставки (в фоне; ход — событиями `sync`).
    pub fn sync(&self) -> Result<(), String> {
        let pn = self
            .ctx
            .router()
            .outbound_propagation_node
            .ok_or_else(|| err("rns_no_propagation_node"))?;
        if self.ctx.sync_busy.swap(true, Ordering::SeqCst) {
            return Ok(());
        }
        let ctx = self.ctx.clone();
        thread::spawn(move || {
            let result = ctx.run_sync(pn);
            ctx.sync_busy.store(false, Ordering::SeqCst);
            let (state, received) = match result {
                Ok(n) => ("done", n),
                Err(e) => {
                    log::warn!("rns: sync failed: {e}");
                    ("failed", 0)
                }
            };
            ctx.hub.emit(RnsEvent::Sync {
                state: state.into(),
                received,
            });
        });
        Ok(())
    }

    pub fn handle(&self) -> Handle {
        Handle {
            ctx: self.ctx.clone(),
        }
    }

    pub fn stop(mut self) {
        let ctx = &self.ctx;
        ctx.hub.running.store(false, Ordering::SeqCst);
        ctx.hub.cv.notify_all();
        if let Some(cancel) = lock(&ctx.stamp_cancel).take() {
            cancel.store(true, Ordering::SeqCst);
        }
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
        if let Some(sender) = self.sender.take() {
            let _ = sender.join();
        }
        let links: Vec<[u8; 16]> = lock(&ctx.page_links).drain().map(|(_, (l, _))| l).collect();
        for link in links {
            let _ = self.node.teardown_link(link);
        }
        ctx.router().exit_handler();
        // Узел сохраняет известные адреса только при shutdown, а тот требует
        // единственной ссылки: короткие потоки роутера могут ещё держать узел.
        let mut node = self.node;
        for _ in 0..40 {
            match Arc::try_unwrap(node) {
                Ok(n) => {
                    n.shutdown();
                    return;
                }
                Err(back) => {
                    node = back;
                    thread::sleep(Duration::from_millis(50));
                }
            }
        }
        log::warn!("rns: node still shared on stop, shutting the driver down");
        let _ = node.event_sender().send(Event::Shutdown);
    }
}

impl Handle {
    /// Запрос `path` у узла NomadNet по Link: ответ (msgpack) и метаданные
    /// ресурса. Link к узлу переиспользуется несколько минут; пока ответ идёт
    /// ресурсом, ждём, сколько бы он ни шёл.
    fn fetch(
        &self,
        node_hash: [u8; 16],
        path: &str,
        data: &HashMap<String, String>,
    ) -> Result<Response, String> {
        if !path.starts_with('/') || path.len() > 255 {
            return Err(err("rns_bad_path"));
        }
        let ctx = &self.ctx;
        // Ответ сопоставляется с запросом по Link — по одному запросу за раз.
        let _serial = lock(&ctx.page_lock);
        let link = ctx.page_link(node_hash)?;
        {
            let mut book = ctx.hub.book();
            book.responses.remove(&link);
            book.progress.remove(&link);
        }
        let payload = if data.is_empty() {
            Value::Nil
        } else {
            let mut entries: Vec<(Value, Value)> = data
                .iter()
                .map(|(k, v)| (Value::Str(k.clone()), Value::Str(v.clone())))
                .collect();
            entries.sort_by(|a, b| a.0.as_str().cmp(&b.0.as_str()));
            Value::Map(entries)
        };
        if let Err(e) = ctx.request(link, path, &payload) {
            ctx.drop_page_link(node_hash);
            return Err(e);
        }
        match ctx.hub.wait_transfer(link, PAGE_TIMEOUT, TRANSFER_MAX) {
            Some(Ok(response)) => {
                if let Some(entry) = lock(&ctx.page_links).get_mut(&node_hash) {
                    entry.1 = Instant::now();
                }
                Ok(response)
            }
            outcome => {
                ctx.drop_page_link(node_hash);
                Err(err(if outcome.is_none() {
                    "rns_timeout"
                } else {
                    "rns_link_closed"
                }))
            }
        }
    }

    /// Страница NomadNet (micron).
    pub fn page(
        &self,
        node_hash: [u8; 16],
        path: &str,
        data: &HashMap<String, String>,
    ) -> Result<Page, String> {
        let (bytes, _) = self.fetch(node_hash, path, data)?;
        parse_page(&bytes)
    }

    /// Файл узла NomadNet (`/file/…`). Узел может ответить и страницей —
    /// например, «доступ запрещён».
    pub fn download(&self, node_hash: [u8; 16], path: &str) -> Result<Download, String> {
        let (bytes, metadata) = self.fetch(node_hash, path, &HashMap::new())?;
        parse_download(&bytes, metadata.as_deref(), path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Ключ из src/mesh/reticulum/identity.test.ts (байты 1..32 аккаунта).
    const VECTOR: &str = "9a2c2d869aee8ed2fd877980617a5a028d09a55c762e93f49b030cfbe242d67c8d3f41ca3cb59fb2ec7601471e34345193f6b0a04b76d8f936c1024e7f4a2de0";

    #[test]
    fn identity_matches_python_rns() {
        let prv = hex::decode(VECTOR).unwrap();
        assert_eq!(identity_hash(&prv).unwrap(), "0151a8e9c78317b27ff0a40306b9ef31");
        let key: [u8; 64] = prv.try_into().unwrap();
        let id = Identity::from_private_key(&key);
        assert_eq!(
            hex::encode(delivery_hash_of(id.hash())),
            "41bb60343d8fc4a961a89b7c666dce77"
        );
    }

    #[test]
    fn config_lists_interfaces_in_python_format() {
        let text = config_text(&[
            IfaceConfig::Tcp {
                host: "rns.example.org".into(),
                port: 4242,
            },
            IfaceConfig::Auto,
            IfaceConfig::Rnode {
                port: "/dev/cu.usbserial-0001".into(),
                frequency: 869_525_000,
                bandwidth: 125_000,
                spreading_factor: 8,
                coding_rate: 5,
                tx_power: 14,
                fd: None,
            },
            IfaceConfig::Auto,
        ])
        .unwrap();
        assert!(text.contains("share_instance = No"));
        assert!(text.contains("[[rns.example.org:4242]]\n    type = TCPClientInterface"));
        assert!(text.contains("target_port = 4242"));
        assert_eq!(text.matches("type = AutoInterface").count(), 1);
        assert!(text.contains("port = /dev/cu.usbserial-0001"));
        assert!(text.contains("spreadingfactor = 8"));
        let parsed = rns_net::config::parse(&text).unwrap();
        assert_eq!(parsed.interfaces.len(), 3);
        assert!(!parsed.reticulum.share_instance);
    }

    #[test]
    fn config_refuses_injected_sections() {
        for host in ["evil\n  [[x]]\n    type = PipeInterface", "a b", "h#x", "[x]", ""] {
            let r = config_text(&[IfaceConfig::Tcp {
                host: host.into(),
                port: 4242,
            }]);
            assert!(r.is_err(), "{host:?} passed");
        }
        let r = config_text(&[IfaceConfig::Rnode {
            port: "/dev/tty\ncommand = rm".into(),
            frequency: 869_525_000,
            bandwidth: 125_000,
            spreading_factor: 8,
            coding_rate: 5,
            tx_power: 14,
            fd: None,
        }]);
        assert!(r.is_err());
        // Android: вместо пути — дескриптор моста.
        let text = config_text(&[IfaceConfig::Rnode {
            port: "usb-1234".into(),
            frequency: 869_525_000,
            bandwidth: 125_000,
            spreading_factor: 8,
            coding_rate: 5,
            tx_power: 14,
            fd: Some(42),
        }])
        .unwrap();
        assert!(text.contains("\n    fd = 42\n") && !text.contains("\n    port = "), "{text}");
    }

    #[test]
    fn announces_are_classified_by_aspect() {
        let prv = hex::decode(VECTOR).unwrap();
        let key: [u8; 64] = prv.try_into().unwrap();
        let id = *Identity::from_private_key(&key).hash();
        let delivery = delivery_hash_of(&id);
        let app_data = msgpack::pack(&Value::Array(vec![
            Value::Bin(b"Alice".to_vec()),
            Value::Nil,
        ]));
        let (ev, cost) = peer_event(delivery, id, Some(&app_data), 2, 1.0).unwrap();
        assert!(cost.is_none());
        match ev {
            RnsEvent::Announce { aspect, name, hops, .. } => {
                assert_eq!(aspect, ASPECT_DELIVERY);
                assert_eq!(name.as_deref(), Some("Alice"));
                assert_eq!(hops, Some(2));
            }
            _ => panic!("not an announce"),
        }
        let node = dest_hash(NOMADNET, &["node"], &id);
        let (ev, _) = peer_event(node, id, Some(b"Library"), 1, 1.0).unwrap();
        assert!(matches!(ev, RnsEvent::Announce { ref aspect, ref name, .. }
            if aspect == ASPECT_NOMADNET && name.as_deref() == Some("Library")));
        // Чужой аспект — не наш интерес.
        let other = dest_hash("example", &["app"], &id);
        assert!(peer_event(other, id, None, 1, 1.0).is_none());
    }

    fn attachment(kind: &str, name: &str, mime: &str, bytes: &[u8]) -> Attachment {
        Attachment {
            kind: kind.into(),
            name: name.into(),
            mime: mime.into(),
            data: b64(bytes),
        }
    }

    #[test]
    fn attachments_go_both_ways_as_sideband_fields() {
        let sent = vec![
            attachment("image", "photo.jpeg", "image/jpeg", b"\xff\xd8jpeg"),
            attachment("file", "../notes/plan.txt", "text/plain", b"plan"),
            attachment("image", "second.png", "image/png", b"png"),
        ];
        let fields = fields_of(&sent).unwrap();
        // Картинка — одна, в FIELD_IMAGE с форматом «jpg»; остальное — файлами.
        let image = &fields.iter().find(|(k, _)| k.as_uint() == Some(FIELD_IMAGE as u64)).unwrap().1;
        assert_eq!(image.as_array().unwrap()[0].as_str(), Some("jpg"));
        let (got, marks) = attachments_of(&fields);
        assert!(marks.is_empty());
        assert_eq!(
            got,
            vec![
                attachment("image", "image.jpeg", "image/jpeg", b"\xff\xd8jpeg"),
                attachment("file", "plan.txt", "application/octet-stream", b"plan"),
                attachment("file", "second.png", "application/octet-stream", b"png"),
            ]
        );
        let big = vec![attachment("file", "big.bin", "", &vec![0u8; MAX_ATTACHMENT_BYTES + 1])];
        assert_eq!(fields_of(&big).err().as_deref(), Some("rns_too_large"));
    }

    #[test]
    fn voice_goes_out_as_opus_ogg_audio_field() {
        let sent = vec![attachment("audio", "voice.ogg", "audio/ogg", b"OggS voice")];
        let fields = fields_of(&sent).unwrap();
        assert_eq!(
            fields,
            vec![(
                Value::UInt(FIELD_AUDIO as u64),
                Value::Array(vec![
                    Value::UInt(AM_OPUS_OGG as u64),
                    Value::Bin(b"OggS voice".to_vec())
                ]),
            )]
        );
        let (got, marks) = attachments_of(&fields);
        assert_eq!(got, vec![attachment("audio", "voice.ogg", "audio/ogg", b"OggS voice")]);
        assert!(marks.is_empty());
        // Не Ogg или второй голос — обычным файлом.
        let fields = fields_of(&[
            attachment("audio", "a.ogg", "audio/ogg", b"1"),
            attachment("audio", "b.m4a", "audio/mp4", b"2"),
        ])
        .unwrap();
        assert_eq!(fields.len(), 2);
        assert_eq!(fields[1].0, Value::UInt(FIELD_FILE_ATTACHMENTS as u64));
    }

    #[test]
    fn voice_opus_is_playable_codec2_is_marked() {
        let opus = vec![(
            Value::UInt(FIELD_AUDIO as u64),
            Value::Array(vec![Value::UInt(AM_OPUS_OGG as u64), Value::Bin(b"OggS".to_vec())]),
        )];
        let (got, marks) = attachments_of(&opus);
        assert_eq!(got, vec![attachment("audio", "voice.ogg", "audio/ogg", b"OggS")]);
        assert!(marks.is_empty());
        let codec2 = vec![(
            Value::UInt(FIELD_AUDIO as u64),
            Value::Array(vec![Value::UInt(0x03), Value::Bin(vec![1, 2])]),
        )];
        let (got, marks) = attachments_of(&codec2);
        assert!(got.is_empty());
        assert_eq!(marks, "🎤");
    }

    #[test]
    fn custom_fields_are_text_within_a_limit() {
        let fields = |kind: Value, data: Value| {
            vec![
                (Value::UInt(FIELD_CUSTOM_TYPE as u64), kind),
                (Value::UInt(FIELD_CUSTOM_DATA as u64), data),
            ]
        };
        assert_eq!(
            custom_of(&fields(Value::Str("bastyon.binding/1".into()), Value::Bin(b"{}".to_vec()))),
            Some(Custom {
                kind: "bastyon.binding/1".into(),
                data: "{}".into()
            })
        );
        // Не текст, слишком длинно или нет типа — не наше.
        assert!(custom_of(&fields(Value::Str("t".into()), Value::Bin(vec![0xff, 0xfe]))).is_none());
        let big = Value::Bin(vec![b'a'; MAX_CUSTOM_BYTES + 1]);
        assert!(custom_of(&fields(Value::Str("t".into()), big)).is_none());
        assert!(custom_of(&fields(Value::Nil, Value::Bin(b"{}".to_vec()))).is_none());
    }

    #[test]
    fn page_responses() {
        let page = parse_page(&msgpack::pack(&Value::Bin(b">Hello".to_vec()))).unwrap();
        assert_eq!(page.content, ">Hello");
        assert!(!page.binary);
        assert!(parse_page(&msgpack::pack(&Value::Nil)).is_err());
    }

    #[test]
    fn file_responses_in_both_nomadnet_formats() {
        let bin = |b: &[u8]| msgpack::pack(&Value::Bin(b.to_vec()));
        // NomadNet 0.5+: ресурс с метаданными {"name": байты}.
        let meta = msgpack::pack(&Value::Map(vec![(
            Value::Str("name".into()),
            Value::Bin(b"../../report.pdf".to_vec()),
        )]));
        assert_eq!(
            parse_download(&bin(b"%PDF"), Some(&meta), "/file/report.pdf").unwrap(),
            Download::File {
                name: "report.pdf".into(),
                data: b"%PDF".to_vec()
            }
        );
        // Метаданные без имени — имя из пути.
        let empty = msgpack::pack(&Value::Map(vec![]));
        assert!(matches!(
            parse_download(&bin(b"x"), Some(&empty), "/file/dir/a.txt").unwrap(),
            Download::File { ref name, .. } if name == "a.txt"
        ));
        // Прежние узлы: [имя, байты].
        let legacy = msgpack::pack(&Value::Array(vec![
            Value::Str("map.png".into()),
            Value::Bin(vec![0x89, b'P']),
        ]));
        assert!(matches!(
            parse_download(&legacy, None, "/file/map.png").unwrap(),
            Download::File { ref name, ref data } if name == "map.png" && data == &[0x89, b'P']
        ));
        // Отказ узла — страница micron.
        assert_eq!(
            parse_download(&bin(b">Request Not Allowed"), None, "/file/secret.txt").unwrap(),
            Download::Page(Page {
                content: ">Request Not Allowed".into(),
                binary: false
            })
        );
        assert!(parse_download(&msgpack::pack(&Value::Nil), None, "/file/x").is_err());
        assert!(parse_download(b"\xc1", None, "/file/x").is_err());
    }
}

/// Сверка с Python RNS 1.5 + LXMF 1.1 (собеседник — tests/peer.py). Запуск:
/// `RNS_PYTHON=…/python RNS_PEER_PY=tests/peer.py RNS_TEST_DIR=… cargo test
/// -p bastyon-rns interop -- --ignored --nocapture`.
#[cfg(test)]
mod interop {
    use super::*;
    use crate::types::parse_hash;
    use serde_json::{json, Value as Json};
    use std::io::{BufRead, BufReader, Write};
    use std::path::Path;
    use std::process::{Child, ChildStdin, Command, Stdio};

    const VECTOR: &str = "9a2c2d869aee8ed2fd877980617a5a028d09a55c762e93f49b030cfbe242d67c8d3f41ca3cb59fb2ec7601471e34345193f6b0a04b76d8f936c1024e7f4a2de0";
    const WAIT: Duration = Duration::from_secs(40);

    struct Peer {
        child: Child,
        stdin: ChildStdin,
        rx: mpsc::Receiver<Json>,
    }

    impl Peer {
        fn start(python: &str, script: &str, dir: &Path, port: u16) -> Peer {
            let mut child = Command::new(python)
                // Журнал RNS пишет в stdout без сброса — иначе он теряется.
                .env("PYTHONUNBUFFERED", "1")
                .arg(script)
                .arg(dir)
                .arg(port.to_string())
                .arg("PyPeer")
                .arg("--pn")
                .arg("--node")
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .spawn()
                .expect("python peer");
            let stdout = child.stdout.take().unwrap();
            let stdin = child.stdin.take().unwrap();
            let (tx, rx) = mpsc::channel();
            thread::spawn(move || {
                for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                    match serde_json::from_str::<Json>(&line) {
                        Ok(v) => {
                            eprintln!("py> {v}");
                            let _ = tx.send(v);
                        }
                        // Журнал RNS (RNS_PEER_LOGLEVEL=5 — подробный).
                        Err(_) => eprintln!("py! {line}"),
                    }
                }
            });
            Peer { child, stdin, rx }
        }

        fn cmd(&mut self, v: Json) {
            writeln!(self.stdin, "{v}").unwrap();
            self.stdin.flush().unwrap();
        }

        fn expect(&self, what: &str, pred: impl Fn(&Json) -> bool) -> Json {
            let deadline = Instant::now() + WAIT;
            while let Some(left) = deadline.checked_duration_since(Instant::now()) {
                match self.rx.recv_timeout(left) {
                    Ok(v) if pred(&v) => return v,
                    Ok(_) => {}
                    Err(_) => break,
                }
            }
            panic!("python peer: no {what}");
        }
    }

    impl Drop for Peer {
        fn drop(&mut self) {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
    }

    fn expect_ev(rx: &mpsc::Receiver<RnsEvent>, what: &str, pred: impl Fn(&RnsEvent) -> bool) -> RnsEvent {
        let deadline = Instant::now() + WAIT;
        while let Some(left) = deadline.checked_duration_since(Instant::now()) {
            match rx.recv_timeout(left) {
                Ok(ev) => {
                    eprintln!("rs> {ev:?}");
                    if pred(&ev) {
                        return ev;
                    }
                }
                Err(_) => break,
            }
        }
        panic!("rust node: no {what}");
    }

    /// Ожидаемое событие: подпись для сообщения об ошибке и проверка.
    type Want<'a> = (&'a str, Box<dyn Fn(&RnsEvent) -> bool>);

    /// Дождаться всех событий из списка, в любом порядке.
    fn expect_all(rx: &mpsc::Receiver<RnsEvent>, wants: Vec<Want>) {
        let mut left = wants;
        let deadline = Instant::now() + WAIT;
        while !left.is_empty() {
            let Some(wait) = deadline.checked_duration_since(Instant::now()) else { break };
            let Ok(ev) = rx.recv_timeout(wait) else { break };
            eprintln!("rs> {ev:?}");
            left.retain(|(_, pred)| !pred(&ev));
        }
        let missing: Vec<&str> = left.iter().map(|(what, _)| *what).collect();
        assert!(missing.is_empty(), "rust node: no {missing:?}");
    }

    /// Журнал rns-net в stderr, если задан RNS_LOG (error … trace).
    struct StderrLog(log::LevelFilter);

    impl log::Log for StderrLog {
        fn enabled(&self, m: &log::Metadata) -> bool {
            m.level() <= self.0
        }
        fn log(&self, r: &log::Record) {
            if self.enabled(r.metadata()) {
                eprintln!("rs! {} {}: {}", r.level(), r.target(), r.args());
            }
        }
        fn flush(&self) {}
    }

    fn init_log() {
        let Some(level) = std::env::var("RNS_LOG").ok().and_then(|l| l.parse().ok()) else {
            return;
        };
        let logger: &'static StderrLog = Box::leak(Box::new(StderrLog(level)));
        if log::set_logger(logger).is_ok() {
            log::set_max_level(level);
        }
    }

    fn start(dir: &Path, port: u16, pn: Option<String>) -> (Runtime, mpsc::Receiver<RnsEvent>) {
        let (tx, rx) = mpsc::channel();
        let tx = Mutex::new(tx);
        let runtime = Runtime::start(
            StartOptions {
                identity: hex::decode(VECTOR).unwrap(),
                display_name: "Rusty".into(),
                interfaces: vec![IfaceConfig::Tcp {
                    host: "127.0.0.1".into(),
                    port,
                }],
                propagation_node: pn,
            },
            dir.to_path_buf(),
            move |ev| {
                let _ = lock(&tx).send(ev);
            },
        )
        .expect("rust node");
        (runtime, rx)
    }

    /// Псевдослучайные байты, как noise() в peer.py: не сжимаются.
    fn noise(n: usize) -> Vec<u8> {
        let mut x: u32 = 1;
        (0..n)
            .map(|_| {
                x = (x.wrapping_mul(1_103_515_245).wrapping_add(12_345)) & 0x7FFF_FFFF;
                (x >> 16) as u8
            })
            .collect()
    }

    fn is_state(ev: &RnsEvent, id: &str, want: &str) -> bool {
        matches!(ev, RnsEvent::State { id: i, state, .. } if i == id && state == want)
    }

    fn is_message(ev: &RnsEvent, text: &str, how: &str) -> bool {
        matches!(ev, RnsEvent::Message { content, method, signed, .. }
            if content == text && method == how && *signed)
    }

    /// Python-собеседник на свободном порту и каталог прогона; None — не
    /// заданы переменные окружения.
    fn python(name: &str) -> Option<(Peer, PathBuf, u16)> {
        let (Ok(python), Ok(script), Ok(base)) = (
            std::env::var("RNS_PYTHON"),
            std::env::var("RNS_PEER_PY"),
            std::env::var("RNS_TEST_DIR"),
        ) else {
            eprintln!("RNS_PYTHON / RNS_PEER_PY / RNS_TEST_DIR not set — skipped");
            return None;
        };
        init_log();
        let base = PathBuf::from(base).join(format!("{name}-{}", std::process::id()));
        let port = std::net::TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .port();
        let peer = Peer::start(&python, &script, &base.join("peer"), port);
        Some((peer, base, port))
    }

    #[test]
    #[ignore]
    fn python_nomadnet_files() {
        let Some((mut peer, base, port)) = python("files") else { return };
        let ready = peer.expect("ready", |v| v.get("ready").is_some());
        let nomad = ready["node"].as_str().unwrap().to_string();
        let (runtime, rx) = start(&base.join("rust"), port, None);
        peer.cmd(json!({"announce": true}));
        let n = nomad.clone();
        expect_ev(&rx, "nomadnet announce", move |ev| matches!(ev, RnsEvent::Announce { aspect, dest, .. }
            if aspect == ASPECT_NOMADNET && *dest == n));
        let handle = runtime.handle();
        let node_hash = parse_hash::<16>(&nomad).unwrap();
        // Файлы NomadNet: ресурс с метаданными (маленький и в несколько
        // частей, с ходом скачивания), прежний формат и отказ страницей.
        assert_eq!(
            handle.download(node_hash, "/file/hello.txt").unwrap(),
            Download::File {
                name: "hello.txt".into(),
                data: "Привет из NomadNet\n".as_bytes().to_vec()
            }
        );
        let big = noise(200_000);
        assert_eq!(
            handle.download(node_hash, "/file/big.bin").unwrap(),
            Download::File {
                name: "big.bin".into(),
                data: big
            }
        );
        expect_ev(&rx, "download progress", |ev| {
            matches!(ev, RnsEvent::Progress { received, total } if received == total && *total > 1)
        });
        let legacy: Vec<u8> = (0..8).flat_map(|_| 0..=255u8).collect();
        assert_eq!(
            handle.download(node_hash, "/file/legacy.bin").unwrap(),
            Download::File {
                name: "legacy.bin".into(),
                data: legacy
            }
        );
        assert!(matches!(
            handle.download(node_hash, "/file/secret.txt").unwrap(),
            Download::Page(Page { ref content, .. }) if content == ">Request Not Allowed"
        ));
        runtime.stop();
        peer.cmd(json!({"quit": true}));
    }

    #[test]
    #[ignore]
    fn python_peer() {
        let Some((mut peer, base, port)) = python("interop") else { return };
        let ready = peer.expect("ready", |v| v.get("ready").is_some());
        let peer_dest = ready["ready"].as_str().unwrap().to_string();
        let pn = ready["pn"].as_str().unwrap().to_string();
        let nomad = ready["node"].as_str().unwrap().to_string();

        let (runtime, rx) = start(&base.join("rust"), port, None);
        let our = runtime.started().address;
        assert_eq!(our, "41bb60343d8fc4a961a89b7c666dce77");

        // Ключ из записи связки: писать можно, не услышав announce. Чужой
        // ключ к адресу не подходит.
        let to = parse_hash::<16>(&peer_dest).unwrap();
        let key: [u8; 64] = hex::decode(ready["key"].as_str().unwrap()).unwrap().try_into().unwrap();
        assert_eq!(runtime.paper(to, "x").err().as_deref(), Some("rns_unknown_destination"));
        assert_eq!(runtime.learn(to, [7; 64]).err().as_deref(), Some("rns_bad_key"));
        runtime.learn(to, key).unwrap();
        let uri = runtime.paper(to, "до announce").unwrap();
        peer.cmd(json!({ "ingest": uri }));
        peer.expect("paper before announce", |v| v["message"]["content"] == json!("до announce"));

        // Знакомство: announce в обе стороны, все три аспекта Python.
        peer.cmd(json!({"announce": true}));
        let (d, n, p) = (peer_dest.clone(), nomad.clone(), pn.clone());
        expect_all(
            &rx,
            vec![
                ("peer announce", Box::new(move |ev| matches!(ev, RnsEvent::Announce { aspect, dest, name, .. }
                    if aspect == ASPECT_DELIVERY && *dest == d && name.as_deref() == Some("PyPeer")))),
                ("nomadnet announce", Box::new(move |ev| matches!(ev, RnsEvent::Announce { aspect, dest, name, .. }
                    if aspect == ASPECT_NOMADNET && *dest == n && name.as_deref() == Some("PyNode")))),
                ("propagation announce", Box::new(move |ev| matches!(ev, RnsEvent::Announce { aspect, dest, .. }
                    if aspect == ASPECT_PROPAGATION && *dest == p))),
            ],
        );
        runtime.announce().unwrap();
        peer.expect("our announce", |v| {
            v["announce"]["dest"] == json!(our) && v["announce"]["name"] == json!("Rusty")
        });

        // Обзор сети: пути ко всем трём адресам Python — напрямую, по нашему TCP.
        let paths = runtime.paths();
        for dest in [&peer_dest, &nomad, &pn] {
            let p = paths.iter().find(|p| &p.dest == dest).expect("path");
            assert_eq!((p.hops, p.via.as_deref()), (1, None), "{p:?}");
            assert_eq!((p.interface.as_str(), p.kind.as_str()), (format!("127.0.0.1:{port}").as_str(), "tcp"));
            assert!(p.expires > p.updated);
        }

        // Rust → Python: напрямую (Link) и одним пакетом (с доказательством).
        let id = runtime.send(to, "", "hello direct", &[], Method::Direct, None).unwrap();
        peer.expect("direct message", |v| {
            v["message"]["content"] == json!("hello direct") && v["message"]["signature"] == json!(true)
        });
        expect_ev(&rx, "direct delivered", |ev| is_state(ev, &id, "delivered"));
        let id = runtime.send(to, "", "hello opp", &[], Method::Opportunistic, None).unwrap();
        peer.expect("opportunistic message", |v| v["message"]["content"] == json!("hello opp"));
        expect_ev(&rx, "opportunistic delivered", |ev| is_state(ev, &id, "delivered"));

        // Python → Rust: оба способа; Python должен увидеть «доставлено».
        peer.cmd(json!({"send": our, "text": "hi direct", "method": "direct", "tag": "d"}));
        expect_ev(&rx, "direct from python", |ev| is_message(ev, "hi direct", "direct"));
        peer.expect("python direct delivered", |v| v["state"] == json!({"tag": "d", "state": "delivered"}));
        peer.cmd(json!({"send": our, "text": "hi opp", "method": "opportunistic", "tag": "o"}));
        expect_ev(&rx, "opportunistic from python", |ev| is_message(ev, "hi opp", "opportunistic"));
        peer.expect("python opportunistic delivered", |v| v["state"] == json!({"tag": "o", "state": "delivered"}));

        // Вложения в обе стороны: картинка — FIELD_IMAGE, файл — FIELD_FILE_ATTACHMENTS.
        let photo = b64(&[0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
        let id = runtime
            .send(
                to,
                "",
                "фото и план",
                &[
                    Attachment {
                        kind: "image".into(),
                        name: "photo.jpg".into(),
                        mime: "image/jpeg".into(),
                        data: photo.clone(),
                    },
                    Attachment {
                        kind: "file".into(),
                        name: "plan.txt".into(),
                        mime: "text/plain".into(),
                        data: b64(b"plan"),
                    },
                ],
                Method::Direct,
                None,
            )
            .unwrap();
        let got = peer.expect("attachments", |v| v["message"]["content"] == json!("фото и план"));
        assert_eq!(got["message"]["fields"]["6"], json!(["jpg", photo]));
        assert_eq!(got["message"]["fields"]["5"], json!([["plan.txt", b64(b"plan")]]));
        expect_ev(&rx, "attachments delivered", |ev| is_state(ev, &id, "delivered"));
        peer.cmd(json!({"send": our, "text": "картинка из Python", "method": "direct",
            "image": ["webp", b64(b"RIFFwebp")], "files": [["notes.md", b64(b"# hi")]]}));
        let ev = expect_ev(&rx, "attachments from python", |ev| is_message(ev, "картинка из Python", "direct"));
        match ev {
            RnsEvent::Message { attachments, .. } => assert_eq!(
                attachments,
                vec![
                    Attachment {
                        kind: "image".into(),
                        name: "image.webp".into(),
                        mime: "image/webp".into(),
                        data: b64(b"RIFFwebp"),
                    },
                    Attachment {
                        kind: "file".into(),
                        name: "notes.md".into(),
                        mime: "application/octet-stream".into(),
                        data: b64(b"# hi"),
                    },
                ]
            ),
            _ => unreachable!(),
        }

        // Данные приложения (FIELD_CUSTOM_TYPE/DATA) в обе стороны: так едет
        // запись связки с аккаунтом Bastyon.
        let custom = Custom {
            kind: "bastyon.binding/1".into(),
            data: r#"{"v":1,"dest":"связка"}"#.into(),
        };
        let id = runtime
            .send(to, "", "со связкой", &[], Method::Opportunistic, Some(&custom))
            .unwrap();
        let got = peer.expect("custom fields", |v| v["message"]["content"] == json!("со связкой"));
        assert_eq!(got["message"]["fields"]["251"], json!(custom.kind));
        assert_eq!(got["message"]["fields"]["252"], json!(b64(custom.data.as_bytes())));
        expect_ev(&rx, "custom delivered", |ev| is_state(ev, &id, "delivered"));
        peer.cmd(json!({"send": our, "text": "связка из Python", "method": "opportunistic",
            "custom": [custom.kind, custom.data]}));
        let ev = expect_ev(&rx, "custom from python", |ev| is_message(ev, "связка из Python", "opportunistic"));
        assert!(matches!(ev, RnsEvent::Message { custom: Some(ref c), .. } if *c == custom));

        // Голос: FIELD_AUDIO в режиме AM_OPUS_OGG (0x10) в обе стороны.
        let voice = b64(b"OggS\0\x02voice");
        let id = runtime
            .send(
                to,
                "",
                "",
                &[Attachment {
                    kind: "audio".into(),
                    name: "voice.ogg".into(),
                    mime: "audio/ogg".into(),
                    data: voice.clone(),
                }],
                Method::Direct,
                None,
            )
            .unwrap();
        let got = peer.expect("voice", |v| v["message"]["fields"].get("7").is_some());
        assert_eq!(got["message"]["fields"]["7"], json!([AM_OPUS_OGG, voice]));
        expect_ev(&rx, "voice delivered", |ev| is_state(ev, &id, "delivered"));
        peer.cmd(json!({"send": our, "text": "голос из Python", "method": "direct",
            "audio": [AM_OPUS_OGG, voice]}));
        let ev = expect_ev(&rx, "voice from python", |ev| is_message(ev, "голос из Python", "direct"));
        assert!(matches!(ev, RnsEvent::Message { ref attachments, .. }
            if attachments.len() == 1 && attachments[0].kind == "audio" && attachments[0].data == voice));

        // Большое вложение идёт ресурсом по Link: «доставлено» в обе стороны
        // значит, что доказательства ресурса понимают обе реализации.
        let blob = b64(&noise(60_000));
        let id = runtime
            .send(
                to,
                "",
                "большой файл",
                &[Attachment {
                    kind: "file".into(),
                    name: "noise.bin".into(),
                    mime: "application/octet-stream".into(),
                    data: blob.clone(),
                }],
                Method::Direct,
                None,
            )
            .unwrap();
        let got = peer.expect("big attachment", |v| v["message"]["content"] == json!("большой файл"));
        assert_eq!(got["message"]["fields"]["5"], json!([["noise.bin", blob]]));
        expect_ev(&rx, "big attachment delivered", |ev| is_state(ev, &id, "delivered"));
        peer.cmd(json!({"send": our, "text": "большой из Python", "method": "direct", "tag": "big",
            "files": [["noise.bin", blob]]}));
        let ev = expect_ev(&rx, "big attachment from python", |ev| is_message(ev, "большой из Python", "direct"));
        assert!(matches!(ev, RnsEvent::Message { ref attachments, .. } if attachments[0].data == blob));
        peer.expect("python big delivered", |v| v["state"] == json!({"tag": "big", "state": "delivered"}));

        // Бумажные сообщения (lxm://) в обе стороны.
        let uri = runtime.paper(to, "бумага из Rust").unwrap();
        assert!(uri.starts_with("lxm://") && !uri.contains('='), "{uri}");
        peer.cmd(json!({ "ingest": uri }));
        peer.expect("paper in python", |v| v["message"]["content"] == json!("бумага из Rust"));
        peer.cmd(json!({"paper_for": our, "text": "бумага из Python"}));
        let paper = peer.expect("python paper", |v| v.get("paper").is_some());
        runtime.ingest(paper["paper"].as_str().unwrap()).unwrap();
        expect_ev(&rx, "paper from python", |ev| is_message(ev, "бумага из Python", "paper"));
        // Чужое бумажное сообщение не открывается.
        assert_eq!(
            runtime.ingest("lxm://AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA").err().as_deref(),
            Some("rns_paper_not_ours")
        );

        // Через узел доставки: штамп узла, загрузка, узел отдаёт своему адресату.
        runtime
            .set_propagation_node(Some(parse_hash::<16>(&pn).unwrap()))
            .unwrap();
        let id = runtime.send(to, "", "via pn", &[], Method::Propagated, None).unwrap();
        expect_ev(&rx, "propagated sent", |ev| is_state(ev, &id, "sent"));
        peer.expect("propagated message", |v| v["message"]["content"] == json!("via pn"));

        // Синхронизация: сообщение, ждущее нас на узле, скачивается и удаляется там.
        peer.cmd(json!({"store_for": our, "text": "stored for you"}));
        peer.expect("stored", |v| v.get("stored").is_some());
        runtime.sync().unwrap();
        expect_all(
            &rx,
            vec![
                ("synced message", Box::new(|ev| is_message(ev, "stored for you", "propagated"))),
                ("sync done", Box::new(|ev| matches!(ev, RnsEvent::Sync { state, received }
                    if state == "done" && *received == 1))),
            ],
        );
        peer.cmd(json!({"pn_count": true}));
        peer.expect("purged", |v| v["pn_count"] == json!(0));

        // Страницы NomadNet: вторая идёт по тому же Link, с данными формы.
        let handle = runtime.handle();
        let node_hash = parse_hash::<16>(&nomad).unwrap();
        let page = handle.page(node_hash, "/page/index.mu", &HashMap::new()).unwrap();
        assert!(page.content.starts_with(">Hello from Python"), "{}", page.content);
        let mut form = HashMap::new();
        form.insert("field_name".to_string(), "Боб".to_string());
        let page = handle.page(node_hash, "/page/echo.mu", &form).unwrap();
        assert!(page.content.contains("Боб"), "{}", page.content);
        // Неизвестный путь Python не обслуживает: Link закрывается или ответа нет.
        let missing = handle.page(node_hash, "/page/missing.mu", &HashMap::new());
        assert!(
            matches!(missing.as_ref().err().map(String::as_str), Some("rns_link_closed" | "rns_timeout")),
            "{missing:?}"
        );
        // После ошибки Link открывается заново.
        let page = handle.page(node_hash, "/page/index.mu", &HashMap::new()).unwrap();
        assert!(page.content.starts_with(">Hello from Python"));

        // Остановка сохраняет известные адреса: новый запуск сразу их знает.
        let stopped = Instant::now();
        runtime.stop();
        assert!(stopped.elapsed() < Duration::from_secs(10), "stop took {:?}", stopped.elapsed());
        drop(rx);
        let (runtime, rx) = start(&base.join("rust"), port, Some(pn.clone()));
        expect_ev(&rx, "remembered peer", |ev| matches!(ev, RnsEvent::Announce { dest, heard: Some(h), .. }
            if *dest == peer_dest && *h > 0.0));
        let id = runtime.send(to, "", "after restart", &[], Method::Direct, None).unwrap();
        peer.expect("message after restart", |v| v["message"]["content"] == json!("after restart"));
        expect_ev(&rx, "delivered after restart", |ev| is_state(ev, &id, "delivered"));
        runtime.stop();
        peer.cmd(json!({"quit": true}));
    }
}
