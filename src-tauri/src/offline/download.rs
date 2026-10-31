//! Загрузка одного ролика кусками по `Range` с докачкой и проверкой.
//!
//! - Кусок — 4 МиБ; после каждого `state.json` записан, и обрыв, перезапуск
//!   или смена сети продолжают с последнего целого куска.
//! - Суммы фрагментов (`segmentsSha256Url` PeerTube: `{ "<файл>": {
//!   "<начало>-<конец>": "<sha256>" } }`, концы включительно) проверяются,
//!   пока фрагмент пишется. Не сошлось — фрагмент качается заново, второй раз
//!   не сошлось — сбой. Подмену самой нодой это не ловит: суммы с той же
//!   ноды, — ловит обрезанное и побитое при докачке.
//! - Сбой сети — повтор через 1, 2, 5, 15, 30 с, каждый раз со следующего
//!   адреса (рядом с плейлистом, исходная нода, архив).

use std::collections::{HashMap, HashSet};
use std::io::SeekFrom;
use std::path::Path;
use std::time::Duration;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::io::{AsyncSeekExt, AsyncWriteExt};
use tokio::sync::watch;

use super::space;
use super::store::{self, Job, State};

const MB: u64 = 1024 * 1024;
/// Сверх размера ролика должно оставаться свободным.
pub const SPARE: u64 = 200 * MB;
/// Обложка, аватар, субтитры — не больше.
const EXTRA_MAX: u64 = 20 * MB;
const HASHES_MAX: u64 = 5 * MB;
const SMALL_TIMEOUT: Duration = Duration::from_secs(20);

/// Чем остановить загрузку.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Signal {
    Run,
    Pause,
    Remove,
}

#[derive(Debug, Clone)]
pub struct Policy {
    pub chunk: u64,
    pub retry_delays: Vec<Duration>,
    /// Пауза без единого байта, после которой запрос считается оборванным.
    pub stall: Duration,
}

impl Default for Policy {
    fn default() -> Self {
        Self {
            chunk: 4 * MB,
            retry_delays: [1, 2, 5, 15, 30].map(Duration::from_secs).to_vec(),
            stall: Duration::from_secs(60),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum DlError {
    #[error("stopped")]
    Stopped(Signal),
    #[error("not_found")]
    NotFound,
    #[error("network: {0}")]
    Network(String),
    #[error("hash_mismatch")]
    HashMismatch,
    #[error("no_space")]
    NoSpace,
    #[error("disk_full")]
    DiskFull,
    #[error("io: {0}")]
    Io(std::io::Error),
}

impl From<std::io::Error> for DlError {
    fn from(e: std::io::Error) -> Self {
        if space::is_disk_full(&e) {
            DlError::DiskFull
        } else {
            DlError::Io(e)
        }
    }
}

impl DlError {
    /// Код для `state.error` и интерфейса.
    pub fn code(&self) -> &'static str {
        match self {
            DlError::Stopped(_) => "stopped",
            DlError::NotFound => "not_found",
            DlError::Network(_) => "network",
            DlError::HashMismatch => "hash_mismatch",
            DlError::NoSpace => "no_space",
            DlError::DiskFull => "disk_full",
            DlError::Io(_) => "io",
        }
    }
}

/// Фрагмент с суммой: `[начало, конец]` включительно.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HashRange(pub u64, pub u64, pub String);

/// Суммы одного файла из ответа `segmentsSha256Url`, по порядку.
pub fn parse_hashes(body: &[u8], file_name: &str) -> Option<Vec<HashRange>> {
    let all: HashMap<String, HashMap<String, String>> = serde_json::from_slice(body).ok()?;
    let mine = all.get(file_name)?;
    let mut ranges: Vec<HashRange> = mine
        .iter()
        .filter_map(|(span, sha)| {
            let (a, b) = span.split_once('-')?;
            let (start, end) = (a.parse().ok()?, b.parse().ok()?);
            let valid = end >= start && sha.len() == 64 && sha.bytes().all(|c| c.is_ascii_hexdigit());
            valid.then(|| HashRange(start, end, sha.to_ascii_lowercase()))
        })
        .collect();
    ranges.sort_by_key(|r| r.0);
    // Перекрытия значат чужой формат — без проверки лучше, чем ложный сбой.
    if ranges.windows(2).any(|w| w[1].0 <= w[0].1) {
        return None;
    }
    Some(ranges)
}

/// Продолжать с начала фрагмента: середину уже не проверить.
fn snap_to_fragment(ranges: &[HashRange], pos: u64) -> u64 {
    ranges
        .iter()
        .find(|r| pos > r.0 && pos <= r.1)
        .map(|r| r.0)
        .unwrap_or(pos)
}

/// Сверяет фрагменты по мере записи.
struct Verifier {
    ranges: Vec<HashRange>,
    /// Первый ещё не проверенный фрагмент.
    next: usize,
    hasher: Option<Sha256>,
    strikes: HashMap<usize, u8>,
}

enum Checked {
    Ok,
    /// Фрагмент не сошёлся: писать заново с его начала.
    Retry(u64),
    /// Не сошёлся второй раз: обрезать до его начала и сдаться — иначе
    /// «Повторить» продолжило бы после него, и битые байты остались бы в файле.
    Failed(u64),
}

impl Verifier {
    fn new(ranges: Vec<HashRange>, pos: u64) -> Self {
        let mut v = Self {
            ranges,
            next: 0,
            hasher: None,
            strikes: HashMap::new(),
        };
        v.seek(pos);
        v
    }

    fn seek(&mut self, pos: u64) {
        self.next = self.ranges.iter().position(|r| r.1 >= pos).unwrap_or(self.ranges.len());
        self.hasher = None;
    }

    /// Сколько байт с `pos` можно записать до следующей границы фрагмента.
    fn piece(&self, pos: u64, len: usize) -> usize {
        match self.ranges.get(self.next) {
            Some(r) if pos < r.0 => len.min((r.0 - pos) as usize),
            Some(r) => len.min((r.1 + 1 - pos) as usize),
            None => len,
        }
    }

    /// Записанный кусок `[pos, pos + data.len())` — внутри одного фрагмента
    /// или между ними (см. `piece`).
    fn absorb(&mut self, pos: u64, data: &[u8]) -> Checked {
        let Some(r) = self.ranges.get(self.next) else {
            return Checked::Ok;
        };
        if pos < r.0 {
            return Checked::Ok;
        }
        if pos == r.0 {
            self.hasher = Some(Sha256::new());
        }
        let Some(hasher) = self.hasher.as_mut() else {
            // Сюда не попасть: продолжаем всегда с начала фрагмента.
            return Checked::Ok;
        };
        hasher.update(data);
        if pos + data.len() as u64 != r.1 + 1 {
            return Checked::Ok;
        }
        let actual = hex::encode(self.hasher.take().unwrap_or_default().finalize());
        let index = self.next;
        self.next += 1;
        if actual == r.2 {
            return Checked::Ok;
        }
        let (start, end) = (r.0, r.1);
        let strikes = {
            let n = self.strikes.entry(index).or_insert(0);
            *n += 1;
            *n
        };
        self.seek(start);
        if strikes >= 2 {
            return Checked::Failed(start);
        }
        log::warn!("[offline] fragment {start}-{end} mismatch, fetching again");
        Checked::Retry(start)
    }

    /// Все фрагменты проверены (или проверять нечего).
    fn complete(&self) -> bool {
        self.next >= self.ranges.len()
    }
}

/// Небольшой файл целиком — обложка, субтитры, суммы.
async fn fetch_small(client: &reqwest::Client, url: &str, max: u64) -> Result<Vec<u8>, String> {
    let work = async {
        let response = client
            .get(url)
            .send()
            .await
            .and_then(|r| r.error_for_status())
            .map_err(|e| e.to_string())?;
        if response.content_length().is_some_and(|n| n > max) {
            return Err("too_large".to_string());
        }
        let mut body = Vec::new();
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            body.extend_from_slice(&chunk);
            if body.len() as u64 > max {
                return Err("too_large".to_string());
            }
        }
        Ok(body)
    };
    tokio::time::timeout(SMALL_TIMEOUT, work)
        .await
        .map_err(|_| "timeout".to_string())?
}

/// Обложка, аватар и субтитры — по возможности: без них ролик всё равно играет.
async fn fetch_extras(client: &reqwest::Client, dir: &Path, job: &Job) {
    for extra in &job.extras {
        let dest = dir.join(&extra.name);
        if dest.is_file() {
            continue;
        }
        match fetch_small(client, &extra.url, EXTRA_MAX).await {
            Ok(body) => {
                if let Some(parent) = dest.parent() {
                    let _ = tokio::fs::create_dir_all(parent).await;
                }
                let tmp = dest.with_extension("tmp");
                if tokio::fs::write(&tmp, &body).await.is_ok() {
                    let _ = tokio::fs::rename(&tmp, &dest).await;
                }
            }
            Err(e) => log::info!("[offline] {} skipped: {e}", extra.name),
        }
    }
}

/// Суммы фрагментов: с диска, а нет — с ноды. Не вышло — без проверки.
async fn load_hashes(client: &reqwest::Client, dir: &Path, job: &Job) -> Vec<HashRange> {
    let saved = dir.join(store::HASHES);
    if let Some(ranges) = std::fs::read(&saved)
        .ok()
        .and_then(|b| serde_json::from_slice::<Vec<HashRange>>(&b).ok())
    {
        return ranges;
    }
    for url in &job.sha256_urls {
        match fetch_small(client, url, HASHES_MAX).await {
            Ok(body) => {
                if let Some(ranges) = parse_hashes(&body, &job.file_name) {
                    if let Ok(bytes) = serde_json::to_vec(&ranges) {
                        let _ = std::fs::write(&saved, bytes);
                    }
                    return ranges;
                }
                log::info!("[offline] no hashes for {} at {url}", job.file_name);
            }
            Err(e) => log::info!("[offline] hashes unavailable: {e}"),
        }
    }
    Vec::new()
}

enum Outcome {
    /// Кусок записан целиком.
    Done,
    /// Продолжить с `state.received` (фрагмент не сошёлся, файл на ноде сменился).
    Restart,
}

enum FetchError {
    NotFound,
    Network(String),
    Fatal(DlError),
}

impl From<DlError> for FetchError {
    fn from(e: DlError) -> Self {
        FetchError::Fatal(e)
    }
}

impl From<std::io::Error> for FetchError {
    fn from(e: std::io::Error) -> Self {
        FetchError::Fatal(e.into())
    }
}

/// `bytes 0-99/1234` → (0, 1234).
fn parse_content_range(value: &str) -> Option<(u64, u64)> {
    let rest = value.trim().strip_prefix("bytes ")?;
    let (span, total) = rest.split_once('/')?;
    let (start, _) = span.split_once('-')?;
    Some((start.trim().parse().ok()?, total.trim().parse().ok()?))
}

/// Ход загрузки наружу: `persist` — записать `state.json`.
pub trait Report {
    fn report(&mut self, state: &State, persist: bool);
}

impl<F: FnMut(&State, bool)> Report for F {
    fn report(&mut self, state: &State, persist: bool) {
        self(state, persist)
    }
}

struct Run<'a, R: Report> {
    client: &'a reqwest::Client,
    policy: &'a Policy,
    file: tokio::fs::File,
    verifier: Verifier,
    state: &'a mut State,
    stop: &'a mut watch::Receiver<Signal>,
    report: &'a mut R,
}

impl<R: Report> Run<'_, R> {
    fn stopped(&self) -> Option<Signal> {
        let signal = *self.stop.borrow();
        (signal != Signal::Run).then_some(signal)
    }

    async fn restart_from(&mut self, pos: u64) -> std::io::Result<()> {
        self.file.set_len(pos).await?;
        self.file.seek(SeekFrom::Start(pos)).await?;
        self.state.received = pos;
        Ok(())
    }

    async fn fetch_chunk(&mut self, url: &str) -> Result<Outcome, FetchError> {
        let start = self.state.received;
        let end = if self.state.total > 0 {
            (start + self.policy.chunk - 1).min(self.state.total - 1)
        } else {
            start + self.policy.chunk - 1
        };
        let request = self
            .client
            .get(url)
            .header(reqwest::header::RANGE, format!("bytes={start}-{end}"))
            .send();
        let response = tokio::select! {
            biased;
            _ = self.stop.changed() => {
                return Err(DlError::Stopped(self.stopped().unwrap_or(Signal::Pause)).into());
            }
            r = tokio::time::timeout(self.policy.stall, request) => r,
        };
        let response = match response {
            Err(_) => return Err(FetchError::Network("stalled".into())),
            Ok(Err(e)) => return Err(FetchError::Network(e.to_string())),
            Ok(Ok(r)) => r,
        };
        let status = response.status();
        if status == reqwest::StatusCode::NOT_FOUND || status == reqwest::StatusCode::GONE {
            return Err(FetchError::NotFound);
        }
        if !status.is_success() {
            return Err(FetchError::Network(format!("http {}", status.as_u16())));
        }

        // 206 — кусок с `start`; 200 — нода не умеет Range и шлёт файл с начала.
        let (mut skip, total) = if status == reqwest::StatusCode::PARTIAL_CONTENT {
            let range = response
                .headers()
                .get(reqwest::header::CONTENT_RANGE)
                .and_then(|v| v.to_str().ok())
                .and_then(parse_content_range);
            match range {
                Some((from, total)) if from == start => (0u64, total),
                _ => return Err(FetchError::Network("bad content-range".into())),
            }
        } else {
            (start, response.content_length().unwrap_or(0))
        };
        if total > 0 && self.state.total > 0 && total != self.state.total && start > 0 {
            // Файл на ноде другой: прежнее скачанное к нему не подходит.
            log::warn!("[offline] size changed {} -> {total}, starting over", self.state.total);
            self.state.total = total;
            self.restart_from(0).await?;
            self.verifier.seek(0);
            return Ok(Outcome::Restart);
        }
        if total > 0 {
            self.state.total = total;
        }

        let mut stream = response.bytes_stream();
        let mut since_persist: u64 = 0;
        let mut wrote: u64 = 0;
        loop {
            let next = tokio::select! {
                biased;
                _ = self.stop.changed() => {
                    return Err(DlError::Stopped(self.stopped().unwrap_or(Signal::Pause)).into());
                }
                n = tokio::time::timeout(self.policy.stall, stream.next()) => n,
            };
            let bytes = match next {
                Err(_) => return Err(FetchError::Network("stalled".into())),
                Ok(None) => break,
                Ok(Some(Err(e))) => return Err(FetchError::Network(e.to_string())),
                Ok(Some(Ok(bytes))) => bytes,
            };
            let mut data: &[u8] = &bytes;
            if skip > 0 {
                let n = (skip as usize).min(data.len());
                skip -= n as u64;
                data = &data[n..];
            }
            if self.state.total > 0 {
                let room = self.state.total.saturating_sub(self.state.received) as usize;
                data = &data[..data.len().min(room)];
            }
            while !data.is_empty() {
                let pos = self.state.received;
                let n = self.verifier.piece(pos, data.len());
                let (piece, rest) = data.split_at(n);
                self.file.write_all(piece).await?;
                self.state.received += n as u64;
                since_persist += n as u64;
                wrote += n as u64;
                data = rest;
                match self.verifier.absorb(pos, piece) {
                    Checked::Ok => {}
                    Checked::Retry(from) => {
                        self.restart_from(from).await?;
                        self.file.flush().await?;
                        self.report.report(self.state, true);
                        return Ok(Outcome::Restart);
                    }
                    Checked::Failed(from) => {
                        self.restart_from(from).await?;
                        self.file.flush().await?;
                        self.report.report(self.state, true);
                        return Err(DlError::HashMismatch.into());
                    }
                }
            }
            if since_persist >= self.policy.chunk {
                // Нода без Range шлёт файл целиком — сохраняемся по ходу.
                self.file.flush().await?;
                self.report.report(self.state, true);
                since_persist = 0;
            } else {
                self.report.report(self.state, false);
            }
            if self.state.total > 0 && self.state.received >= self.state.total {
                break;
            }
        }
        self.file.flush().await?;
        if wrote == 0 && (self.state.total == 0 || self.state.received < self.state.total) {
            // Пустой ответ посреди файла — как обрыв: с паузой и другим адресом,
            // а не тот же запрос по кругу.
            return Err(FetchError::Network("empty response".into()));
        }
        Ok(Outcome::Done)
    }

    async fn wait(&mut self, delay: Duration) -> Result<(), DlError> {
        tokio::select! {
            biased;
            _ = self.stop.changed() => Err(DlError::Stopped(self.stopped().unwrap_or(Signal::Pause))),
            _ = tokio::time::sleep(delay) => Ok(()),
        }
    }
}

#[allow(clippy::too_many_arguments)]
/// Скачать ролик в `dir` до `video.mp4`. `state` — с прошлого раза (или
/// новый); по ходу уходит в `report`. `free` — сколько свободно на диске.
pub async fn run<R: Report>(
    client: &reqwest::Client,
    policy: &Policy,
    dir: &Path,
    job: &Job,
    state: &mut State,
    stop: &mut watch::Receiver<Signal>,
    report: &mut R,
    free: impl Fn() -> Option<u64>,
) -> Result<(), DlError> {
    tokio::fs::create_dir_all(dir).await?;
    if dir.join(store::VIDEO).is_file() {
        return Ok(());
    }
    fetch_extras(client, dir, job).await;
    let ranges = load_hashes(client, dir, job).await;

    let part = dir.join(store::PART);
    let mut file = tokio::fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(&part)
        .await?;
    let on_disk = file.metadata().await?.len();
    if state.total == 0 {
        state.total = job.size;
    }
    let resume = snap_to_fragment(&ranges, state.received.min(on_disk));
    file.set_len(resume).await?;
    file.seek(SeekFrom::Start(resume)).await?;
    state.received = resume;

    if let Some(available) = free() {
        let needed = state.total.saturating_sub(state.received) + SPARE;
        if available < needed {
            return Err(DlError::NoSpace);
        }
    }

    let verifier = Verifier::new(ranges, resume);
    let mut run = Run {
        client,
        policy,
        file,
        verifier,
        state,
        stop,
        report,
    };
    let sources = &job.sources;
    let mut source = 0usize;
    let mut failures = 0usize;
    let mut missing: HashSet<usize> = HashSet::new();
    loop {
        if let Some(signal) = run.stopped() {
            return Err(DlError::Stopped(signal));
        }
        if run.state.total > 0 && run.state.received >= run.state.total {
            break;
        }
        let index = source % sources.len();
        match run.fetch_chunk(&sources[index]).await {
            Ok(Outcome::Done) => {
                failures = 0;
                missing.clear();
                run.report.report(run.state, true);
                if run.state.total == 0 {
                    // Размер так и не узнали, а нода всё отдала.
                    break;
                }
            }
            Ok(Outcome::Restart) => {}
            Err(FetchError::Fatal(e)) => {
                run.report.report(run.state, true);
                return Err(e);
            }
            Err(FetchError::NotFound) => {
                missing.insert(index);
                if missing.len() >= sources.len() {
                    return Err(DlError::NotFound);
                }
                source += 1;
            }
            Err(FetchError::Network(e)) => {
                run.report.report(run.state, true);
                let Some(delay) = run.policy.retry_delays.get(failures).copied() else {
                    return Err(DlError::Network(e));
                };
                log::info!("[offline] {} failed: {e}; retry in {delay:?}", job.id);
                failures += 1;
                source += 1;
                run.wait(delay).await?;
            }
        }
    }
    if !run.verifier.complete() {
        // Файл кончился раньше фрагментов из сумм — это не тот файл.
        return Err(DlError::HashMismatch);
    }
    run.file.flush().await?;
    run.file.sync_all().await?;
    drop(run.file);
    tokio::fs::rename(&part, dir.join(store::VIDEO)).await?;
    let _ = tokio::fs::remove_file(dir.join(store::HASHES)).await;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::{Arc, Mutex};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    /// Подменная нода: файл по Range, суммы, обрывы и порча по заказу.
    #[derive(Default)]
    struct Knobs {
        /// Отдать столько байт тела и оборвать соединение (один раз).
        cut_after: Mutex<Option<usize>>,
        /// Испортить байт по этому смещению в ответах (столько раз).
        corrupt_at: Mutex<Option<(u64, usize)>>,
        /// Отвечать 404 на файл.
        missing: Mutex<bool>,
        /// Не уметь Range: всегда 200 с начала.
        no_range: Mutex<bool>,
        /// Столько раз ответить на кусок не с начала пустым 206.
        empty_replies: Mutex<usize>,
        served: AtomicUsize,
        requests: AtomicUsize,
    }

    struct Node {
        base: String,
        knobs: Arc<Knobs>,
    }

    fn sample(len: usize) -> Vec<u8> {
        (0..len).map(|i| (i * 7 + i / 251) as u8).collect()
    }

    /// Суммы как у PeerTube: заголовок без суммы, дальше фрагменты.
    fn hashes_json(data: &[u8], name: &str, header: usize, fragment: usize) -> Vec<u8> {
        let mut map = serde_json::Map::new();
        let mut start = header;
        while start < data.len() {
            let end = (start + fragment).min(data.len()) - 1;
            map.insert(
                format!("{start}-{end}"),
                serde_json::Value::String(hex::encode(Sha256::digest(&data[start..=end]))),
            );
            start = end + 1;
        }
        serde_json::to_vec(&serde_json::json!({ name: map })).unwrap()
    }

    async fn serve(data: Vec<u8>, hashes: Vec<u8>) -> Node {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let knobs = Arc::new(Knobs::default());
        let k = knobs.clone();
        let data = Arc::new(data);
        let hashes = Arc::new(hashes);
        tokio::spawn(async move {
            loop {
                let Ok((mut socket, _)) = listener.accept().await else { return };
                let (k, data, hashes) = (k.clone(), data.clone(), hashes.clone());
                tokio::spawn(async move {
                    let mut buf = vec![0u8; 8192];
                    let mut head = Vec::new();
                    while !head.windows(4).any(|w| w == b"\r\n\r\n") {
                        let Ok(n) = socket.read(&mut buf).await else { return };
                        if n == 0 {
                            return;
                        }
                        head.extend_from_slice(&buf[..n]);
                    }
                    let head = String::from_utf8_lossy(&head).to_string();
                    let path = head.split_whitespace().nth(1).unwrap_or("/").to_string();
                    let range = head
                        .lines()
                        .find_map(|l| l.to_ascii_lowercase().strip_prefix("range: bytes=").map(str::to_string));
                    if path == "/sha.json" {
                        let reply = format!(
                            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                            hashes.len()
                        );
                        let _ = socket.write_all(reply.as_bytes()).await;
                        let _ = socket.write_all(&hashes).await;
                        return;
                    }
                    k.requests.fetch_add(1, Ordering::SeqCst);
                    if *k.missing.lock().unwrap() || path != "/video.mp4" {
                        let _ = socket
                            .write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                            .await;
                        return;
                    }
                    let total = data.len() as u64;
                    let no_range = *k.no_range.lock().unwrap();
                    let (start, end, status) = match range.filter(|_| !no_range) {
                        Some(r) => {
                            let (a, b) = r.trim().split_once('-').unwrap();
                            let a: u64 = a.parse().unwrap();
                            let b: u64 = b.parse::<u64>().map(|b| b.min(total - 1)).unwrap_or(total - 1);
                            (a, b, 206)
                        }
                        None => (0, total - 1, 200),
                    };
                    let mut body = data[start as usize..=end as usize].to_vec();
                    {
                        let mut empty = k.empty_replies.lock().unwrap();
                        if status == 206 && start > 0 && *empty > 0 {
                            *empty -= 1;
                            body.clear();
                        }
                    }
                    {
                        let mut corrupt = k.corrupt_at.lock().unwrap();
                        if let Some((at, times)) = *corrupt {
                            if times > 0 && at >= start && at <= end {
                                body[(at - start) as usize] ^= 0xff;
                                *corrupt = Some((at, times - 1));
                            }
                        }
                    }
                    let mut reply = if status == 206 {
                        format!(
                            "HTTP/1.1 206 Partial Content\r\nContent-Range: bytes {start}-{end}/{total}\r\n"
                        )
                    } else {
                        "HTTP/1.1 200 OK\r\n".to_string()
                    };
                    reply.push_str(&format!("Content-Length: {}\r\nConnection: close\r\n\r\n", body.len()));
                    let _ = socket.write_all(reply.as_bytes()).await;
                    let cut = k.cut_after.lock().unwrap().take();
                    let send = cut.map(|c| c.min(body.len())).unwrap_or(body.len());
                    let _ = socket.write_all(&body[..send]).await;
                    k.served.fetch_add(send, Ordering::SeqCst);
                    let _ = socket.flush().await;
                });
            }
        });
        Node { base, knobs }
    }

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("bastyon-offline-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    fn quick() -> Policy {
        Policy {
            chunk: 64 * 1024,
            retry_delays: vec![Duration::from_millis(10); 3],
            stall: Duration::from_secs(5),
        }
    }

    fn job(node: &Node, size: usize) -> Job {
        Job {
            id: "v-144".into(),
            sources: vec![format!("{}/video.mp4", node.base)],
            file_name: "video.mp4".into(),
            sha256_urls: vec![format!("{}/sha.json", node.base)],
            extras: vec![],
            size: size as u64,
        }
    }

    async fn download(
        node: &Node,
        dir: &Path,
        job: &Job,
        state: &mut State,
        stop: &mut watch::Receiver<Signal>,
    ) -> (Result<(), DlError>, Vec<State>) {
        let mut persisted = Vec::new();
        let mut report = |s: &State, persist: bool| {
            if persist {
                persisted.push(s.clone());
            }
        };
        let _ = node;
        let client = reqwest::Client::new();
        let result = run(&client, &quick(), dir, job, state, stop, &mut report, || None).await;
        (result, persisted)
    }

    #[tokio::test]
    async fn downloads_in_chunks_and_checks_every_fragment() {
        let data = sample(300_000);
        let node = serve(data.clone(), hashes_json(&data, "video.mp4", 1343, 50_000)).await;
        let dir = temp_dir("full");
        let (_tx, mut rx) = watch::channel(Signal::Run);
        let mut state = State::queued(0);
        // Размер заранее не известен — его даёт Content-Range первого куска.
        let (result, persisted) = download(&node, &dir, &job(&node, 0), &mut state, &mut rx).await;
        result.unwrap();
        assert_eq!(std::fs::read(dir.join(store::VIDEO)).unwrap(), data);
        assert!(!dir.join(store::PART).exists());
        assert_eq!(state.received, 300_000);
        assert_eq!(state.total, 300_000);
        // Куски по 64 КиБ.
        assert_eq!(node.knobs.requests.load(Ordering::SeqCst), 5);
        assert!(persisted.len() >= 5);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn resumes_from_the_last_whole_fragment() {
        let data = sample(300_000);
        let node = serve(data.clone(), hashes_json(&data, "video.mp4", 1343, 50_000)).await;
        let dir = temp_dir("resume");
        std::fs::create_dir_all(&dir).unwrap();
        // Прошлый запуск записал 120 000 байт, но середину фрагмента 101 343…
        std::fs::write(dir.join(store::PART), &data[..120_000]).unwrap();
        let mut state = State {
            status: store::Status::Downloading,
            received: 120_000,
            total: 300_000,
            error: None,
        };
        let (_tx, mut rx) = watch::channel(Signal::Run);
        let (result, _) = download(&node, &dir, &job(&node, 300_000), &mut state, &mut rx).await;
        result.unwrap();
        assert_eq!(std::fs::read(dir.join(store::VIDEO)).unwrap(), data);
        // …поэтому продолжили с его начала, а не с нуля.
        assert_eq!(node.knobs.served.load(Ordering::SeqCst), 300_000 - 101_343);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn broken_fragment_is_fetched_again() {
        let data = sample(300_000);
        let node = serve(data.clone(), hashes_json(&data, "video.mp4", 1343, 50_000)).await;
        *node.knobs.corrupt_at.lock().unwrap() = Some((160_000, 1));
        let dir = temp_dir("corrupt-once");
        let (_tx, mut rx) = watch::channel(Signal::Run);
        let mut state = State::queued(0);
        let (result, _) = download(&node, &dir, &job(&node, 300_000), &mut state, &mut rx).await;
        result.unwrap();
        assert_eq!(std::fs::read(dir.join(store::VIDEO)).unwrap(), data);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn fragment_broken_twice_fails() {
        let data = sample(300_000);
        let node = serve(data.clone(), hashes_json(&data, "video.mp4", 1343, 50_000)).await;
        *node.knobs.corrupt_at.lock().unwrap() = Some((160_000, 10));
        let dir = temp_dir("corrupt-always");
        let (_tx, mut rx) = watch::channel(Signal::Run);
        let mut state = State::queued(0);
        let (result, _) = download(&node, &dir, &job(&node, 300_000), &mut state, &mut rx).await;
        assert!(matches!(result, Err(DlError::HashMismatch)));
        assert!(!dir.join(store::VIDEO).exists());
        // Битый фрагмент 151 343…201 342 не остался: «Повторить» начнёт с него.
        assert_eq!(state.received, 151_343);
        assert_eq!(std::fs::metadata(dir.join(store::PART)).unwrap().len(), 151_343);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn cut_connection_is_retried_from_where_it_stopped() {
        let data = sample(200_000);
        let node = serve(data.clone(), b"{}".to_vec()).await;
        *node.knobs.cut_after.lock().unwrap() = Some(10_000);
        let dir = temp_dir("cut");
        let (_tx, mut rx) = watch::channel(Signal::Run);
        let mut state = State::queued(0);
        let (result, _) = download(&node, &dir, &job(&node, 200_000), &mut state, &mut rx).await;
        result.unwrap();
        assert_eq!(std::fs::read(dir.join(store::VIDEO)).unwrap(), data);
        // Оборванные 10 000 байт не качались второй раз.
        assert_eq!(node.knobs.served.load(Ordering::SeqCst), 200_000);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn empty_reply_mid_file_is_a_failure_not_a_busy_loop() {
        let data = sample(200_000);
        let node = serve(data.clone(), b"{}".to_vec()).await;
        *node.knobs.empty_replies.lock().unwrap() = 2;
        let dir = temp_dir("empty-once");
        let (_tx, mut rx) = watch::channel(Signal::Run);
        let mut state = State::queued(0);
        let (result, _) = download(&node, &dir, &job(&node, 200_000), &mut state, &mut rx).await;
        result.unwrap();
        assert_eq!(std::fs::read(dir.join(store::VIDEO)).unwrap(), data);
        std::fs::remove_dir_all(&dir).unwrap();

        let node = serve(data.clone(), b"{}".to_vec()).await;
        *node.knobs.empty_replies.lock().unwrap() = 100;
        let dir = temp_dir("empty-always");
        let mut state = State::queued(0);
        let (result, _) = download(&node, &dir, &job(&node, 200_000), &mut state, &mut rx).await;
        assert!(matches!(result, Err(DlError::Network(_))));
        // Первый кусок и 3 повтора (quick): не по кругу.
        assert_eq!(node.knobs.requests.load(Ordering::SeqCst), 5);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn node_without_range_support_still_works() {
        let data = sample(150_000);
        let node = serve(data.clone(), hashes_json(&data, "video.mp4", 1343, 40_000)).await;
        *node.knobs.no_range.lock().unwrap() = true;
        let dir = temp_dir("no-range");
        let (_tx, mut rx) = watch::channel(Signal::Run);
        let mut state = State::queued(0);
        let (result, _) = download(&node, &dir, &job(&node, 150_000), &mut state, &mut rx).await;
        result.unwrap();
        assert_eq!(std::fs::read(dir.join(store::VIDEO)).unwrap(), data);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn next_source_when_the_first_has_no_file() {
        let data = sample(100_000);
        let dead = serve(data.clone(), b"{}".to_vec()).await;
        *dead.knobs.missing.lock().unwrap() = true;
        let alive = serve(data.clone(), b"{}".to_vec()).await;
        let dir = temp_dir("sources");
        let mut j = job(&alive, 100_000);
        j.sources.insert(0, format!("{}/video.mp4", dead.base));
        let (_tx, mut rx) = watch::channel(Signal::Run);
        let mut state = State::queued(0);
        let (result, _) = download(&alive, &dir, &j, &mut state, &mut rx).await;
        result.unwrap();
        assert_eq!(std::fs::read(dir.join(store::VIDEO)).unwrap(), data);

        let gone = temp_dir("gone");
        let mut state = State::queued(0);
        let (result, _) = download(&dead, &gone, &job(&dead, 100_000), &mut state, &mut rx).await;
        assert!(matches!(result, Err(DlError::NotFound)));
        let _ = std::fs::remove_dir_all(&dir);
        let _ = std::fs::remove_dir_all(&gone);
    }

    #[tokio::test]
    async fn pause_keeps_what_was_downloaded() {
        let data = sample(2_000_000);
        let node = serve(data.clone(), b"{}".to_vec()).await;
        let dir = temp_dir("pause");
        let (tx, mut rx) = watch::channel(Signal::Run);
        let mut state = State::queued(0);
        let client = reqwest::Client::new();
        let policy = quick();
        let j = job(&node, 2_000_000);
        let mut report = |s: &State, persist: bool| {
            if persist && s.received >= 200_000 {
                let _ = tx.send(Signal::Pause);
            }
        };
        let result = run(&client, &policy, &dir, &j, &mut state, &mut rx, &mut report, || None).await;
        assert!(matches!(result, Err(DlError::Stopped(Signal::Pause))));
        assert!(state.received >= 200_000 && state.received < 2_000_000);
        let on_disk = std::fs::metadata(dir.join(store::PART)).unwrap().len();
        assert!(on_disk >= state.received);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn refuses_without_room_on_disk() {
        let data = sample(10_000);
        let node = serve(data, b"{}".to_vec()).await;
        let dir = temp_dir("space");
        let (_tx, mut rx) = watch::channel(Signal::Run);
        let mut state = State::queued(0);
        let client = reqwest::Client::new();
        let mut report = |_: &State, _: bool| {};
        let result = run(
            &client,
            &quick(),
            &dir,
            &job(&node, 10_000),
            &mut state,
            &mut rx,
            &mut report,
            || Some(SPARE),
        )
        .await;
        assert!(matches!(result, Err(DlError::NoSpace)));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn hashes_parse_like_peertube_writes_them() {
        let body = br#"{"a.mp4":{"1343-101448":"AB","101449-207003":"00"},"b.mp4":{}}"#;
        assert_eq!(parse_hashes(body, "a.mp4"), Some(vec![]));
        let sha = "a".repeat(64);
        let body = format!(r#"{{"a.mp4":{{"101449-207003":"{sha}","1343-101448":"{sha}"}}}}"#);
        let ranges = parse_hashes(body.as_bytes(), "a.mp4").unwrap();
        assert_eq!(ranges[0], HashRange(1343, 101_448, sha.clone()));
        assert_eq!(ranges[1].0, 101_449);
        assert_eq!(parse_hashes(body.as_bytes(), "b.mp4"), None);
        assert_eq!(snap_to_fragment(&ranges, 120_000), 101_449);
        assert_eq!(snap_to_fragment(&ranges, 101_449), 101_449);
        assert_eq!(snap_to_fragment(&ranges, 500), 500);
        assert_eq!(parse_content_range("bytes 0-99/1234"), Some((0, 1234)));
        assert_eq!(parse_content_range("bytes */1234"), None);
    }
}
