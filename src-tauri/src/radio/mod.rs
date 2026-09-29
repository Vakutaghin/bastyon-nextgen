//! Радио-слой для mesh-сетей (MeshCore, дальше Meshtastic и RNode): байты до
//! LoRa-устройства по USB-serial, TCP в локальной сети и Bluetooth LE.
//!
//! Протоколы живут во фронтенде (src/mesh) — одни и те же для десктопа,
//! Android и браузера. Здесь только транспорт: открыть соединение, писать,
//! отдавать пришедшее. События идут через `Channel` команды — только окну,
//! которое открыло соединение, а не всем окнам, как глобальные события.
//!
//! Ошибки — строкой «код: подробности», код переводит интерфейс.

pub mod addr;
pub mod ble;
pub mod serial;
pub mod tcp;

use dashmap::DashMap;
use serde::Serialize;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RadioEvent {
    /// Байты из serial или TCP.
    Data { bytes: Vec<u8> },
    /// Уведомление характеристики BLE.
    Notify {
        characteristic: String,
        bytes: Vec<u8>,
    },
    /// Соединение пропало не по просьбе интерфейса (кабель, питание, вне зоны).
    Closed { reason: Option<String> },
}

pub type EventSink = Arc<dyn Fn(RadioEvent) + Send + Sync>;

/// Больше одновременных соединений приложению не нужно: одно радио на сеть.
const MAX_LINKS: usize = 8;
/// Кадры протоколов — сотни байт; больше — не запись радио.
const MAX_WRITE: usize = 4096;

enum Link {
    Serial(serial::SerialLink),
    Tcp(tcp::TcpLink),
    Ble(ble::BleLink),
}

struct Entry {
    link: Link,
    sink: EventSink,
}

type Links = Arc<DashMap<u32, Arc<Entry>>>;

pub struct RadioManager {
    links: Links,
    next_id: AtomicU32,
    ble: tokio::sync::Mutex<Option<Arc<ble::BleCentral>>>,
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    app.manage(RadioManager {
        links: Arc::new(DashMap::new()),
        next_id: AtomicU32::new(1),
        ble: tokio::sync::Mutex::new(None),
    });
    Ok(())
}

fn channel_sink(channel: Channel<RadioEvent>) -> EventSink {
    Arc::new(move |ev| {
        let _ = channel.send(ev);
    })
}

impl RadioManager {
    fn reserve(&self) -> Result<u32, String> {
        if self.links.len() >= MAX_LINKS {
            return Err("too_many_links: close another device first".into());
        }
        Ok(self.next_id.fetch_add(1, Ordering::SeqCst))
    }

    /// Соединение само убирает себя из таблицы, когда устройство пропало.
    fn remover(&self, id: u32) -> Box<dyn FnOnce() + Send> {
        let links = self.links.clone();
        Box::new(move || {
            links.remove(&id);
        })
    }

    fn get(&self, id: u32) -> Result<Arc<Entry>, String> {
        self.links
            .get(&id)
            .map(|e| e.value().clone())
            .ok_or_else(|| format!("link_not_found: {id}"))
    }

    async fn central(&self) -> Result<Arc<ble::BleCentral>, String> {
        let mut guard = self.ble.lock().await;
        if let Some(c) = guard.as_ref() {
            return Ok(c.clone());
        }
        let links = self.links.clone();
        let on_disconnect: ble::DisconnectHandler = Arc::new(move |peripheral_id: String| {
            let gone: Vec<u32> = links
                .iter()
                .filter(|e| matches!(&e.value().link, Link::Ble(b) if b.peripheral_id() == peripheral_id))
                .map(|e| *e.key())
                .collect();
            for id in gone {
                if let Some((_, entry)) = links.remove(&id) {
                    (entry.sink)(RadioEvent::Closed {
                        reason: Some("device_lost: disconnected".into()),
                    });
                }
            }
        });
        let central = Arc::new(ble::BleCentral::new(on_disconnect).await?);
        *guard = Some(central.clone());
        Ok(central)
    }
}

async fn close_entry(entry: &Entry) {
    match &entry.link {
        Link::Serial(l) => l.close(),
        Link::Tcp(l) => l.close().await,
        Link::Ble(l) => l.close().await,
    }
}

/// Порты USB-serial системы.
#[tauri::command]
pub async fn radio_serial_ports() -> Result<Vec<serial::SerialPortDto>, String> {
    tokio::task::spawn_blocking(serial::list_ports)
        .await
        .map_err(|e| format!("list_failed: {e}"))?
}

/// Открыть порт из списка системы. Возвращает номер соединения.
#[tauri::command]
pub async fn radio_serial_open(
    state: State<'_, RadioManager>,
    path: String,
    baud: Option<u32>,
    on_event: Channel<RadioEvent>,
) -> Result<u32, String> {
    let id = state.reserve()?;
    let sink = channel_sink(on_event);
    let remover = state.remover(id);
    let link_sink = sink.clone();
    let link = tokio::task::spawn_blocking(move || {
        serial::SerialLink::open(&path, baud.unwrap_or(serial::DEFAULT_BAUD), link_sink, remover)
    })
    .await
    .map_err(|e| format!("open_failed: {e}"))??;
    state.links.insert(
        id,
        Arc::new(Entry {
            link: Link::Serial(link),
            sink,
        }),
    );
    Ok(id)
}

/// Подключиться по TCP к радио в локальной сети.
#[tauri::command]
pub async fn radio_tcp_open(
    state: State<'_, RadioManager>,
    host: String,
    port: u16,
    on_event: Channel<RadioEvent>,
) -> Result<u32, String> {
    let id = state.reserve()?;
    let sink = channel_sink(on_event);
    let link = tcp::TcpLink::open(&host, port, sink.clone(), state.remover(id)).await?;
    state.links.insert(
        id,
        Arc::new(Entry {
            link: Link::Tcp(link),
            sink,
        }),
    );
    Ok(id)
}

/// Записать байты в serial- или TCP-соединение.
#[tauri::command]
pub async fn radio_write(
    state: State<'_, RadioManager>,
    link: u32,
    data: Vec<u8>,
) -> Result<(), String> {
    if data.len() > MAX_WRITE {
        return Err(format!("too_large: {} bytes", data.len()));
    }
    let entry = state.get(link)?;
    match &entry.link {
        Link::Serial(l) => l.write(data).await,
        Link::Tcp(l) => l.write(data).await,
        Link::Ble(_) => Err("wrong_link: use radio_ble_write".into()),
    }
}

/// Закрыть соединение. Неизвестный номер — не ошибка: соединение могло уже
/// закрыться само.
#[tauri::command]
pub async fn radio_close(state: State<'_, RadioManager>, link: u32) -> Result<(), String> {
    if let Some((_, entry)) = state.links.remove(&link) {
        close_entry(&entry).await;
    }
    Ok(())
}

/// Найти устройства BLE. `services` — UUID сервисов протокола; пусто — все
/// устройства с именем.
#[tauri::command]
pub async fn radio_ble_scan(
    state: State<'_, RadioManager>,
    services: Vec<String>,
    timeout_ms: Option<u32>,
) -> Result<Vec<ble::BleDeviceDto>, String> {
    let uuids = services
        .iter()
        .map(|s| ble::parse_uuid(s))
        .collect::<Result<Vec<_>, _>>()?;
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(4000).clamp(1000, 15000) as u64);
    let central = state.central().await?;
    central.scan(uuids, timeout).await
}

/// Подключиться к устройству BLE из результатов сканирования.
#[tauri::command]
pub async fn radio_ble_connect(
    state: State<'_, RadioManager>,
    id: String,
    on_event: Channel<RadioEvent>,
) -> Result<u32, String> {
    let link_id = state.reserve()?;
    let central = state.central().await?;
    let sink = channel_sink(on_event);
    let link = ble::BleLink::open(&central, &id, sink.clone()).await?;
    state.links.insert(
        link_id,
        Arc::new(Entry {
            link: Link::Ble(link),
            sink,
        }),
    );
    Ok(link_id)
}

fn ble_link(entry: &Entry) -> Result<&ble::BleLink, String> {
    match &entry.link {
        Link::Ble(l) => Ok(l),
        _ => Err("wrong_link: not a bluetooth link".into()),
    }
}

/// Включить уведомления характеристики.
#[tauri::command]
pub async fn radio_ble_subscribe(
    state: State<'_, RadioManager>,
    link: u32,
    characteristic: String,
) -> Result<(), String> {
    let uuid = ble::parse_uuid(&characteristic)?;
    let entry = state.get(link)?;
    ble_link(&entry)?.subscribe(uuid).await
}

/// Записать в характеристику.
#[tauri::command]
pub async fn radio_ble_write(
    state: State<'_, RadioManager>,
    link: u32,
    characteristic: String,
    data: Vec<u8>,
    with_response: Option<bool>,
) -> Result<(), String> {
    if data.len() > MAX_WRITE {
        return Err(format!("too_large: {} bytes", data.len()));
    }
    let uuid = ble::parse_uuid(&characteristic)?;
    let entry = state.get(link)?;
    ble_link(&entry)?
        .write(uuid, data, with_response.unwrap_or(true))
        .await
}

/// Прочитать характеристику.
#[tauri::command]
pub async fn radio_ble_read(
    state: State<'_, RadioManager>,
    link: u32,
    characteristic: String,
) -> Result<Vec<u8>, String> {
    let uuid = ble::parse_uuid(&characteristic)?;
    let entry = state.get(link)?;
    ble_link(&entry)?.read(uuid).await
}

/// При выходе из приложения отпустить порты и отключиться от устройств.
/// Синхронно, как у IPFS и Tor: обработчик выхода — не асинхронный контекст.
pub fn shutdown_on_exit(mgr: &RadioManager) {
    let entries: Vec<Arc<Entry>> = mgr.links.iter().map(|e| e.value().clone()).collect();
    mgr.links.clear();
    for entry in entries {
        match &entry.link {
            Link::Serial(l) => l.close(),
            Link::Tcp(l) => l.abort(),
            Link::Ble(l) => l.abort(),
        }
    }
}
