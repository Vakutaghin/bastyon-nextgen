//! Узел Reticulum в модуле: rns-net (стек, интерфейсы) и lxmf-rs (сообщения
//! LXMF, узлы доставки). Identity приходит из интерфейса — она выведена из
//! ключа аккаунта (src/mesh/reticulum/identity.ts), поэтому мнемоника
//! восстанавливает и адрес Reticulum.
//!
//! Стек работает на своих потоках (без tokio); события — announce,
//! сообщения, их судьба, интерфейсы — идут в сток команды `rns_start`, а
//! через приложение — окну, которое его запустило.
//!
//! Ошибки — строкой «код: подробности», код переводит интерфейс.
//!
//! Сам узел — в крейте bastyon-rns (общий с Android). На Windows нет RNode
//! по USB (у rns-net там нет последовательного порта) — только хабы и LAN.

use bastyon_rns::{node, types};

use base64::Engine as _;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use types::{Attachment, Download, Method, Page, RnsEvent, StartOptions, Started, Status};

/// Один узел на модуль; `None` — остановлен.
#[derive(Default)]
pub struct RnsManager {
    node: Mutex<Option<node::Runtime>>,
}

fn blocking_err(e: tokio::task::JoinError) -> String {
    format!("rns_error: {e}")
}

impl RnsManager {
    fn with_node<T>(
        &self,
        run: impl FnOnce(&node::Runtime) -> Result<T, String>,
    ) -> Result<T, String> {
        let guard = self
            .node
            .lock()
            .map_err(|_| "rns_error: lock".to_string())?;
        match guard.as_ref() {
            Some(node) => run(node),
            None => Err("rns_not_running".to_string()),
        }
    }

    fn handle(&self) -> Result<node::Handle, String> {
        self.with_node(|n| Ok(n.handle()))
    }

    /// Поднять узел. `base_dir` — каталог узлов в данных приложения: у каждого
    /// адреса свой подкаталог (таблица путей, известные identity, очередь
    /// LXMF), чтобы аккаунты не видели чужое.
    pub async fn start(
        &self,
        options: StartOptions,
        base_dir: PathBuf,
        sink: impl Fn(RnsEvent) + Send + Sync + 'static,
    ) -> Result<Started, String> {
        if options.identity.len() != 64 {
            return Err("rns_error: identity must be 64 bytes".into());
        }
        // Прежний узел (другой аккаунт, новые настройки) — остановить и дождаться:
        // новый займёт те же порты LAN и тот же RNode.
        self.stop().await?;
        let identity_hash = node::identity_hash(&options.identity)?;
        let dir = base_dir.join(identity_hash);
        let runtime = tokio::task::spawn_blocking(move || node::Runtime::start(options, dir, sink))
            .await
            .map_err(blocking_err)??;
        let started = runtime.started();
        *self.node.lock().map_err(|_| "rns_error: lock")? = Some(runtime);
        Ok(started)
    }

    pub async fn stop(&self) -> Result<(), String> {
        let node = self.node.lock().map_err(|_| "rns_error: lock")?.take();
        if let Some(node) = node {
            tokio::task::spawn_blocking(move || node.stop())
                .await
                .map_err(blocking_err)?;
        }
        Ok(())
    }

    pub fn status(&self) -> Result<Status, String> {
        let guard = self
            .node
            .lock()
            .map_err(|_| "rns_error: lock".to_string())?;
        Ok(match guard.as_ref() {
            Some(node) => node.status(),
            None => Status {
                running: false,
                interfaces: vec![],
                paths: 0,
                propagation_node: None,
            },
        })
    }

    pub fn announce(&self) -> Result<(), String> {
        self.with_node(|n| n.announce())
    }

    /// Обзор сети: таблица путей узла.
    pub fn paths(&self) -> Result<Vec<types::PathInfo>, String> {
        self.with_node(|n| Ok(n.paths()))
    }

    pub fn send(
        &self,
        to: &str,
        content: &str,
        title: &str,
        method: Method,
        attachments: Vec<Attachment>,
        custom: Option<types::Custom>,
    ) -> Result<serde_json::Value, String> {
        let dest = types::parse_hash::<16>(to)?;
        let id = self
            .with_node(|n| n.send(dest, title, content, &attachments, method, custom.as_ref()))?;
        Ok(serde_json::json!({ "id": id }))
    }

    /// Запомнить ключ адресата из проверенной записи связки: писать ему можно до
    /// его announce.
    pub fn learn(&self, dest: &str, key: &str) -> Result<(), String> {
        let dest = types::parse_hash::<16>(dest)?;
        let key = types::parse_hash::<64>(key)?;
        self.with_node(|n| n.learn(dest, key))
    }

    /// Бумажное сообщение адресату: ссылка `lxm://` (для QR или текста).
    pub fn paper(&self, to: &str, content: &str) -> Result<serde_json::Value, String> {
        let dest = types::parse_hash::<16>(to)?;
        let uri = self.with_node(|n| n.paper(dest, content))?;
        Ok(serde_json::json!({ "uri": uri }))
    }

    /// Открыть бумажное сообщение: придёт событием `message`.
    pub fn ingest(&self, uri: &str) -> Result<(), String> {
        self.with_node(|n| n.ingest(uri))
    }

    pub fn request_path(&self, to: &str) -> Result<(), String> {
        let dest = types::parse_hash::<16>(to)?;
        self.with_node(|n| n.request_path(dest))
    }

    pub fn set_propagation_node(&self, hash: Option<&str>) -> Result<(), String> {
        let node_hash = match hash {
            Some(h) => Some(types::parse_hash::<16>(h)?),
            None => None,
        };
        self.with_node(|n| n.set_propagation_node(node_hash))
    }

    pub fn sync(&self) -> Result<(), String> {
        self.with_node(|n| n.sync())
    }

    /// Страница узла NomadNet. Запрос идёт через Link и может ждать десятки
    /// секунд — не в потоке команд.
    pub async fn page(
        &self,
        node: &str,
        path: String,
        data: HashMap<String, String>,
    ) -> Result<Page, String> {
        let dest = types::parse_hash::<16>(node)?;
        let handle = self.handle()?;
        tokio::task::spawn_blocking(move || handle.page(dest, &path, &data))
            .await
            .map_err(blocking_err)?
    }

    /// Файл узла NomadNet (`/file/…`). Сохраняет его приложение — через
    /// системный диалог, поэтому файл уходит ему целиком, в base64. Узел может
    /// ответить страницей (отказ) — она возвращается для показа.
    pub async fn download(&self, node: &str, path: String) -> Result<serde_json::Value, String> {
        let dest = types::parse_hash::<16>(node)?;
        let handle = self.handle()?;
        let got = tokio::task::spawn_blocking(move || handle.download(dest, &path))
            .await
            .map_err(blocking_err)??;
        Ok(match got {
            Download::Page(page) => serde_json::json!({
                "kind": "page",
                "content": page.content,
                "binary": page.binary,
            }),
            Download::File { name, data } => serde_json::json!({
                "kind": "file",
                "name": name,
                "data": base64::engine::general_purpose::STANDARD.encode(data),
            }),
        })
    }

    /// Выход: закрыть интерфейсы и сохранить известные адреса.
    pub async fn shutdown(&self) {
        let _ = self.stop().await;
    }
}
