//! Типы на границе с интерфейсом: настройки узла и события — в camelCase,
//! как их ждёт src/mesh/reticulum/rns-api.ts.

use serde::{Deserialize, Serialize};

/// Интерфейс Reticulum: хаб сообщества по TCP, LAN или RNode по USB.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum IfaceConfig {
    Tcp {
        host: String,
        port: u16,
    },
    Auto,
    Rnode {
        port: String,
        frequency: u64,
        bandwidth: u32,
        spreading_factor: u8,
        coding_rate: u8,
        tx_power: i8,
        /// Android: порт открыт приложением (USB через usb-serial), узлу
        /// отдан конец socketpair, байты между ними перекачивает Java.
        #[serde(default)]
        fd: Option<i32>,
    },
}

impl IfaceConfig {
    pub fn kind(&self) -> &'static str {
        match self {
            IfaceConfig::Tcp { .. } => "tcp",
            IfaceConfig::Auto => "auto",
            IfaceConfig::Rnode { .. } => "rnode",
        }
    }

    /// Имя интерфейса для статуса и событий.
    pub fn name(&self) -> String {
        match self {
            IfaceConfig::Tcp { host, port } => format!("{host}:{port}"),
            IfaceConfig::Auto => "LAN".to_string(),
            IfaceConfig::Rnode { port, .. } => format!("RNode {port}"),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartOptions {
    /// 64 байта: приватный X25519 и сид Ed25519.
    pub identity: Vec<u8>,
    pub display_name: String,
    pub interfaces: Vec<IfaceConfig>,
    pub propagation_node: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Started {
    pub address: String,
    pub identity_hash: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IfaceStatus {
    pub name: String,
    pub kind: String,
    /// false — интерфейс не поднялся при старте узла, и rns-net его больше не
    /// пробует: нужен перезапуск узла.
    pub started: bool,
    pub online: bool,
    pub rx_bytes: u64,
    pub tx_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub running: bool,
    pub interfaces: Vec<IfaceStatus>,
    pub paths: usize,
    pub propagation_node: Option<String>,
}

/// Способ доставки LXMF: auto — узел выберет сам по размеру и пути.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Method {
    Auto,
    Opportunistic,
    Direct,
    Propagated,
}

/// Вложение LXMF: картинка (FIELD_IMAGE), файл (FIELD_FILE_ATTACHMENTS) или
/// голос Opus (FIELD_AUDIO). Байты — в base64: так они идут через IPC.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    /// `image`, `file` или `audio`.
    pub kind: String,
    pub name: String,
    pub mime: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum RnsEvent {
    Announce {
        aspect: String,
        dest: String,
        identity: String,
        name: Option<String>,
        hops: Option<u8>,
        /// Когда announce услышан, секунды (для адресов из прошлых запусков).
        heard: Option<f64>,
    },
    Message {
        id: String,
        from: String,
        title: String,
        content: String,
        timestamp: f64,
        signed: bool,
        method: String,
        attachments: Vec<Attachment>,
    },
    State {
        id: String,
        state: String,
        reason: Option<String>,
    },
    Interface {
        name: String,
        online: bool,
    },
    Sync {
        state: String,
        received: u32,
    },
    /// Ход ответа, который идёт ресурсом (страница или файл NomadNet): частей
    /// из скольких. Запросы к узлам идут по одному, так что он — о текущем.
    Progress {
        received: u64,
        total: u64,
    },
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub content: String,
    pub binary: bool,
}

/// Путь к адресу из таблицы путей узла — для обзора сети.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PathInfo {
    /// Адрес назначения, hex.
    pub dest: String,
    pub hops: u8,
    /// Следующий транспортный узел (hex его identity), если путь не прямой.
    pub via: Option<String>,
    /// Наш интерфейс (имя из настроек), откуда пришёл путь; пусто — неизвестный.
    pub interface: String,
    /// `tcp`, `auto`, `rnode`; пусто — не наш интерфейс (общий, служебный).
    pub kind: String,
    /// Когда путь обновлён и когда истечёт, секунды Unix.
    pub updated: f64,
    pub expires: f64,
}

/// Что узел NomadNet ответил на запрос файла.
#[derive(Debug, PartialEq, Eq)]
pub enum Download {
    File { name: String, data: Vec<u8> },
    Page(Page),
}

/// hex → байты фиксированной длины (адрес — 16 байт).
pub fn parse_hash<const N: usize>(hex_str: &str) -> Result<[u8; N], String> {
    let bytes = hex::decode(hex_str.trim()).map_err(|_| format!("bad_address: {hex_str}"))?;
    bytes
        .try_into()
        .map_err(|_| format!("bad_address: {hex_str}"))
}
