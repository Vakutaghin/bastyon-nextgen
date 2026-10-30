//! Moat — API Tor Project, которое подбирает мосты под страну
//! (`circumvention/settings` в rdsys), как Connection Assist в Tor Browser.
//! Капчи у этого вызова нет; документация схем:
//! https://gitlab.torproject.org/tpo/anti-censorship/rdsys/-/blob/main/doc/moat.md
//!
//! Там, где мосты нужны, bridges.torproject.org заблокирован, поэтому запрос
//! идёт через meek: lyrebird поднимает локальный SOCKS и прячет соединение за
//! обращением к CDN (domain fronting). TLS сквозной до bridges.torproject.org,
//! CDN видит только фронт-домен. Страну сервер определяет по адресу клиента —
//! поэтому через Tor её спрашивать нельзя: ответ был бы для страны выходного
//! узла.

use crate::bridges;
use crate::pt_config::PtConfig;
use crate::state::TorPaths;
use serde::Deserialize;
use std::process::Stdio;
use std::time::Duration;
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio_socks::tcp::Socks5Stream;

const MOAT_HOST: &str = "bridges.torproject.org";
const MOAT_PATH: &str = "/moat";
/// `extensions.torlauncher.bridgedb_targets` из Tor Browser 15.0: отражатель
/// meek и фронт-домены через `+`.
const MOAT_TARGETS: &str = "https://1723079976.rsc.cdn77.org|cdn.zk.mk+www.cdn77.com";
/// Транспорты бандла; `vanilla` — мост без транспорта.
const REQUEST_TRANSPORTS: &[&str] = &["obfs4", "snowflake", "webtunnel", "meek", "vanilla"];
const PT_START_TIMEOUT: Duration = Duration::from_secs(15);
/// Moat через meek отвечает за 2–20 с. Где отражатель закрыт (CDN77 в РФ,
/// замер 30.10.2026), ждать дольше незачем: автоподбор тем временем стоит.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_RESPONSE: u64 = 1 << 20;
/// Moat: «не удалось определить страну».
pub const CODE_NO_COUNTRY: i64 = 406;

#[derive(Debug, Error)]
pub enum MoatError {
    #[error("meek: {0}")]
    Meek(String),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("socks: {0}")]
    Socks(#[from] tokio_socks::Error),
    #[error("tls: {0}")]
    Tls(String),
    #[error("http: {0}")]
    Http(String),
    #[error("moat {code}: {detail}")]
    Api { code: i64, detail: String },
    #[error("bad response: {0}")]
    BadResponse(String),
    #[error("timed out")]
    Timeout,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BridgeSource {
    /// Встроенные мосты этого типа из pt_config — строки Moat не присылает.
    BuiltIn,
    BridgeDb,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MoatBridges {
    /// Тип по Moat: `snowflake`, `webtunnel`, `obfs4`, `meek`, `vanilla`.
    pub kind: String,
    pub source: BridgeSource,
    /// Проверенные строки (для `BuiltIn` пусто).
    pub lines: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct MoatSettings {
    /// ISO 3166-1 alpha-2 в нижнем регистре, как определил сервер.
    pub country: Option<String>,
    /// По порядку: что Tor Project советует пробовать первым.
    pub bridges: Vec<MoatBridges>,
}

impl MoatSettings {
    /// Строки мостов из BridgeDB — их нет во встроенных, это и есть «получить мосты».
    pub fn bridgedb_lines(&self) -> Vec<String> {
        self.bridges
            .iter()
            .filter(|b| b.source == BridgeSource::BridgeDb)
            .flat_map(|b| b.lines.iter().cloned())
            .collect()
    }
}

/// Мосты, которые Tor Project советует для страны клиента. Пустой список при
/// известной стране — мосты там не нужны.
pub async fn circumvention_settings(
    paths: &TorPaths,
    pt: &PtConfig,
) -> Result<MoatSettings, MoatError> {
    let body = serde_json::json!({ "transports": REQUEST_TRANSPORTS, "country": null });
    parse_settings(&request(paths, pt, "circumvention/settings", &body).await?)
}

/// Общие запасные мосты — когда страну определить не удалось.
pub async fn circumvention_defaults(
    paths: &TorPaths,
    pt: &PtConfig,
) -> Result<MoatSettings, MoatError> {
    let body = serde_json::json!({ "transports": REQUEST_TRANSPORTS });
    parse_settings(&request(paths, pt, "circumvention/defaults", &body).await?)
}

/// Советы для страны, а если её не определить — общие запасные.
pub async fn settings_or_defaults(
    paths: &TorPaths,
    pt: &PtConfig,
) -> Result<MoatSettings, MoatError> {
    match circumvention_settings(paths, pt).await {
        Err(MoatError::Api { code, .. }) if code == CODE_NO_COUNTRY => {
            circumvention_defaults(paths, pt).await
        }
        other => other,
    }
}

async fn request(
    paths: &TorPaths,
    pt: &PtConfig,
    procedure: &str,
    body: &serde_json::Value,
) -> Result<String, MoatError> {
    let meek = MeekClient::spawn(paths, pt).await?;
    let body = serde_json::to_vec(body).map_err(|e| MoatError::BadResponse(e.to_string()))?;
    let head = format!(
        "POST {MOAT_PATH}/{procedure} HTTP/1.1\r\n\
         Host: {MOAT_HOST}\r\n\
         Content-Type: application/vnd.api+json\r\n\
         Accept: application/json\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\r\n",
        body.len()
    );

    let exchange = async {
        let user = meek_credentials(MOAT_TARGETS);
        // Адрес назначения meek не смотрит: отражатель сам ведёт к Moat.
        let stream = Socks5Stream::connect_with_password(
            ("127.0.0.1", meek.port),
            (MOAT_HOST, 443),
            &user,
            "\0",
        )
        .await?
        .into_inner();
        let connector = crate::ws::build_rustls_connector().map_err(MoatError::Tls)?;
        let name = rustls_pki_types::ServerName::try_from(MOAT_HOST)
            .map_err(|e| MoatError::Tls(e.to_string()))?;
        let mut tls = connector
            .connect(name, stream)
            .await
            .map_err(|e| MoatError::Tls(e.to_string()))?;
        tls.write_all(head.as_bytes()).await?;
        tls.write_all(&body).await?;
        tls.flush().await?;

        let mut raw = Vec::new();
        match (&mut tls).take(MAX_RESPONSE).read_to_end(&mut raw).await {
            Ok(_) => {}
            // Сервер закрыл соединение без close_notify — ответ уже целиком.
            Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof && !raw.is_empty() => {}
            Err(e) => return Err(e.into()),
        }
        parse_http_response(&raw)
    };
    let result = tokio::time::timeout(REQUEST_TIMEOUT, exchange)
        .await
        .map_err(|_| MoatError::Timeout)?;
    drop(meek);
    result
}

/// Аргументы meek передаются логином SOCKS5 (раздел 3.5 спецификации PT):
/// `\`, `=` и `;` экранируются, пароль — один нулевой байт, как в Tor Browser.
fn meek_credentials(targets: &str) -> String {
    let escaped = targets
        .replace('\\', "\\\\")
        .replace('=', "\\=")
        .replace(';', "\\;");
    format!("targets={escaped}")
}

/// lyrebird в режиме клиента meek_lite, только на время запроса к Moat.
struct MeekClient {
    _child: tokio::process::Child,
    port: u16,
}

impl MeekClient {
    async fn spawn(paths: &TorPaths, pt: &PtConfig) -> Result<Self, MoatError> {
        let plugin = pt
            .plugin_for("meek_lite")
            .ok_or_else(|| MoatError::Meek("no meek_lite transport in the bundle".into()))?;
        let state_dir = paths.data_dir.join("moat_pt_state");
        std::fs::create_dir_all(&state_dir)?;

        let mut cmd = tokio::process::Command::new(paths.pt_program(&plugin.program));
        cmd.args(&plugin.args)
            .env("TOR_PT_MANAGED_TRANSPORT_VER", "1")
            .env("TOR_PT_STATE_LOCATION", &state_dir)
            // Приложение упало — stdin закрылся, lyrebird вышел следом.
            .env("TOR_PT_EXIT_ON_STDIN_CLOSE", "1")
            .env("TOR_PT_CLIENT_TRANSPORTS", "meek_lite")
            .current_dir(&paths.pt_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        #[cfg(windows)]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let mut child = cmd.spawn()?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| MoatError::Meek("no stdout".into()))?;
        let mut lines = BufReader::new(stdout).lines();

        let port = tokio::time::timeout(PT_START_TIMEOUT, async {
            let mut port = None;
            while let Some(line) = lines.next_line().await? {
                match parse_pt_line(&line) {
                    PtLine::Cmethod(p) => port = Some(p),
                    PtLine::Done => break,
                    PtLine::Error(e) => return Err(MoatError::Meek(e)),
                    PtLine::Other => {}
                }
            }
            port.ok_or_else(|| MoatError::Meek("no CMETHOD meek_lite".into()))
        })
        .await
        .map_err(|_| MoatError::Timeout)??;

        // Дальше lyrebird пишет в stdout статусы; закрытый пайп убил бы его
        // SIGPIPE посреди запроса.
        tokio::spawn(async move { while let Ok(Some(_)) = lines.next_line().await {} });

        Ok(Self {
            _child: child,
            port,
        })
    }
}

#[derive(Debug, PartialEq, Eq)]
enum PtLine {
    Cmethod(u16),
    Done,
    Error(String),
    Other,
}

fn parse_pt_line(line: &str) -> PtLine {
    let mut it = line.split_whitespace();
    match it.next() {
        Some("CMETHOD") => {
            let (Some("meek_lite"), Some("socks5"), Some(addr)) = (it.next(), it.next(), it.next())
            else {
                return PtLine::Other;
            };
            match addr.parse::<std::net::SocketAddr>() {
                Ok(a) if a.ip().is_loopback() && a.port() != 0 => PtLine::Cmethod(a.port()),
                _ => PtLine::Error(format!("bad CMETHOD address {addr}")),
            }
        }
        Some("CMETHODS") if it.next() == Some("DONE") => PtLine::Done,
        Some(k @ ("VERSION-ERROR" | "ENV-ERROR" | "PROXY-ERROR" | "CMETHOD-ERROR")) => {
            PtLine::Error(format!("{k} {}", it.collect::<Vec<_>>().join(" ")))
        }
        _ => PtLine::Other,
    }
}

/// Тело ответа HTTP/1.1 с кодом 200; `chunked` разбирается.
fn parse_http_response(raw: &[u8]) -> Result<String, MoatError> {
    let split = raw
        .windows(4)
        .position(|w| w == b"\r\n\r\n")
        .ok_or_else(|| MoatError::BadResponse("no header terminator".into()))?;
    let head = String::from_utf8_lossy(&raw[..split]);
    let mut head_lines = head.split("\r\n");
    let status_line = head_lines.next().unwrap_or_default();
    let status = status_line.split_whitespace().nth(1).unwrap_or_default();
    if status != "200" {
        return Err(MoatError::Http(status_line.to_string()));
    }
    let chunked = head_lines.any(|h| {
        h.split_once(':').is_some_and(|(k, v)| {
            k.trim().eq_ignore_ascii_case("transfer-encoding")
                && v.to_ascii_lowercase().contains("chunked")
        })
    });
    let body = &raw[split + 4..];
    let body = if chunked {
        dechunk(body).ok_or_else(|| MoatError::BadResponse("bad chunked body".into()))?
    } else {
        body.to_vec()
    };
    String::from_utf8(body).map_err(|e| MoatError::BadResponse(e.to_string()))
}

fn dechunk(mut data: &[u8]) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    loop {
        let line_end = data.windows(2).position(|w| w == b"\r\n")?;
        let size_str = std::str::from_utf8(&data[..line_end]).ok()?;
        let size = usize::from_str_radix(size_str.split(';').next()?.trim(), 16).ok()?;
        data = &data[line_end + 2..];
        if size == 0 {
            return Some(out);
        }
        if data.len() < size + 2 {
            return None;
        }
        out.extend_from_slice(&data[..size]);
        data = &data[size + 2..];
    }
}

#[derive(Deserialize)]
struct RawResponse {
    #[serde(default)]
    settings: Option<Vec<RawSetting>>,
    #[serde(default)]
    country: Option<String>,
    #[serde(default)]
    errors: Option<Vec<RawError>>,
}

#[derive(Deserialize)]
struct RawSetting {
    bridges: RawBridges,
}

#[derive(Deserialize)]
struct RawBridges {
    #[serde(rename = "type")]
    kind: String,
    source: String,
    #[serde(default)]
    bridge_strings: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct RawError {
    code: i64,
    #[serde(default)]
    detail: String,
}

/// Ответ Moat → настройки. Строки мостов проверяются так же, как введённые
/// руками: в torrc попадает только то, что похоже на мост.
fn parse_settings(json: &str) -> Result<MoatSettings, MoatError> {
    let raw: RawResponse =
        serde_json::from_str(json).map_err(|e| MoatError::BadResponse(e.to_string()))?;
    if let Some(err) = raw.errors.as_ref().and_then(|e| e.first()) {
        return Err(MoatError::Api {
            code: err.code,
            detail: err.detail.clone(),
        });
    }
    let country = raw
        .country
        .map(|c| c.trim().to_ascii_lowercase())
        .filter(|c| c.len() == 2 && c.chars().all(|ch| ch.is_ascii_lowercase()));

    let mut bridges = Vec::new();
    for setting in raw.settings.unwrap_or_default() {
        let kind = setting.bridges.kind.trim().to_ascii_lowercase();
        if kind.is_empty() || !kind.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
            continue;
        }
        match setting.bridges.source.as_str() {
            "builtin" => bridges.push(MoatBridges {
                kind,
                source: BridgeSource::BuiltIn,
                lines: Vec::new(),
            }),
            "bridgedb" => {
                let lines =
                    bridges::parse_lines(&setting.bridges.bridge_strings.unwrap_or_default())
                        .lines();
                if !lines.is_empty() {
                    bridges.push(MoatBridges {
                        kind,
                        source: BridgeSource::BridgeDb,
                        lines,
                    });
                }
            }
            _ => {}
        }
    }
    Ok(MoatSettings { country, bridges })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Ответ Moat для `ru` от 17.10.2026 (строки сокращены).
    const RU: &str = r#"{"settings":[
      {"bridges":{"type":"snowflake","source":"bridgedb","bridge_strings":[
        "snowflake 192.0.2.3:80 2B280B23E1107BB62ABFC40DDCC8824814F80A72 fingerprint=2B280B23E1107BB62ABFC40DDCC8824814F80A72 url=https://1098762253.rsc.cdn77.org fronts=cdn.zk.mk,img.icons8.com ice=stun:stun.antisip.com:3478 utls-imitate=hellorandomizedalpn"]}},
      {"bridges":{"type":"webtunnel","source":"bridgedb","bridge_strings":[
        "webtunnel [2001:db8:a360:a7ae:fada:eb77:8706:c0f3]:443 DF82B4001F68C2312CB01762E8AE203EB9F1FF54 url=https://webtunnel.giacento.com ver=0.0.5"]}},
      {"bridges":{"type":"obfs4","source":"bridgedb","bridge_strings":[
        "obfs4 207.136.101.198:1778 E00DE29F04E89959B9D3612AD1BF5C40E4FF1719 cert=QxPx iat-mode=0",
        "obfs4 1.2.3.4:443 X\nControlPort 9999"]}},
      {"bridges":{"type":"meek","source":"builtin","bridge_strings":["ignored"]}}
    ],"country":"ru"}"#;

    #[test]
    fn settings_keep_the_order_and_check_every_line() {
        let s = parse_settings(RU).unwrap();
        assert_eq!(s.country.as_deref(), Some("ru"));
        let kinds: Vec<&str> = s.bridges.iter().map(|b| b.kind.as_str()).collect();
        assert_eq!(kinds, ["snowflake", "webtunnel", "obfs4", "meek"]);
        assert_eq!(
            s.bridges[2].lines.len(),
            1,
            "line with a torrc directive is dropped"
        );
        assert_eq!(s.bridges[3].source, BridgeSource::BuiltIn);
        assert!(s.bridges[3].lines.is_empty());
        assert_eq!(s.bridgedb_lines().len(), 3);
    }

    #[test]
    fn empty_settings_mean_no_bridges_needed_and_errors_surface() {
        let s = parse_settings(r#"{"settings":[],"country":"GE"}"#).unwrap();
        assert_eq!(
            s,
            MoatSettings {
                country: Some("ge".into()),
                bridges: vec![]
            }
        );
        match parse_settings(r#"{"errors":[{"code":406,"detail":"Could not find country code"}]}"#)
        {
            Err(MoatError::Api { code, .. }) => assert_eq!(code, CODE_NO_COUNTRY),
            other => panic!("{other:?}"),
        }
        let s = parse_settings(r#"{"settings":null,"country":"../etc"}"#).unwrap();
        assert_eq!(s.country, None);
        assert!(parse_settings("<html>").is_err());
    }

    #[test]
    fn meek_targets_go_into_the_socks_username() {
        let user = meek_credentials(MOAT_TARGETS);
        assert_eq!(user, format!("targets={MOAT_TARGETS}"));
        assert!(user.len() <= 255);
        assert_eq!(meek_credentials("a=b;c\\d"), "targets=a\\=b\\;c\\\\d");
    }

    #[test]
    fn pt_handshake_lines() {
        assert_eq!(
            parse_pt_line("CMETHOD meek_lite socks5 127.0.0.1:51177"),
            PtLine::Cmethod(51177)
        );
        assert_eq!(parse_pt_line("CMETHODS DONE"), PtLine::Done);
        assert_eq!(parse_pt_line("VERSION 1"), PtLine::Other);
        assert!(matches!(
            parse_pt_line("CMETHOD meek_lite socks5 10.0.0.1:1"),
            PtLine::Error(_)
        ));
        assert!(matches!(
            parse_pt_line("ENV-ERROR no TOR_PT_STATE_LOCATION"),
            PtLine::Error(_)
        ));
    }

    /// Живой запрос через meek. Нужен распакованный бандл (каталог с `tor/` и
    /// `data/`): `BASTYON_TOR_ROOT=… cargo test --lib moat_live -- --ignored --nocapture`.
    #[tokio::test]
    #[ignore]
    async fn moat_live() {
        let root = std::env::var("BASTYON_TOR_ROOT").expect("BASTYON_TOR_ROOT");
        let paths = TorPaths::from_root(root.into());
        let pt = PtConfig::load(&paths.pt_dir);
        let started = std::time::Instant::now();
        let s = settings_or_defaults(&paths, &pt)
            .await
            .expect("moat over meek");
        println!("{:?} in {:?}", s, started.elapsed());
        let defaults = circumvention_defaults(&paths, &pt).await.expect("defaults");
        assert!(!defaults.bridgedb_lines().is_empty(), "{defaults:?}");
    }

    #[test]
    fn http_responses() {
        let ok = b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"a\":1}";
        assert_eq!(parse_http_response(ok).unwrap(), "{\"a\":1}");
        let chunked = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\n{\"a\"\r\n3\r\n:1}\r\n0\r\n\r\n";
        assert_eq!(parse_http_response(chunked).unwrap(), "{\"a\":1}");
        assert!(matches!(
            parse_http_response(b"HTTP/1.1 502 Bad Gateway\r\n\r\n"),
            Err(MoatError::Http(_))
        ));
        assert!(parse_http_response(b"garbage").is_err());
    }
}
