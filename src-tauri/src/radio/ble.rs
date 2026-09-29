//! Bluetooth LE до радио. Протоколы работают с GATT по-разному: MeshCore —
//! Nordic UART (кадр = одна запись или уведомление), Meshtastic пишет toRadio и
//! вычитывает fromRadio по уведомлению fromNum. Поэтому наружу отдаются
//! примитивы GATT — подписка, запись, чтение, — а протокол решает сам.
//!
//! WebView ни на одной платформе приложения не даёт Web Bluetooth (WKWebView,
//! WebKitGTK), поэтому BLE — здесь, на btleplug.

use super::{EventSink, RadioEvent};
use btleplug::api::{
    Central, CentralEvent, CentralState, Characteristic, Manager as _, Peripheral as _,
    ScanFilter, WriteType,
};
use btleplug::platform::{Adapter, Manager, Peripheral};
use futures_util::StreamExt;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use uuid::Uuid;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const DISCOVER_TIMEOUT: Duration = Duration::from_secs(15);
/// Сколько ждать, пока адаптер сообщит состояние: на macOS CoreBluetooth
/// включается асинхронно, и скан до PoweredOn молча ничего не находит.
const POWER_WAIT: Duration = Duration::from_secs(3);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BleDeviceDto {
    pub id: String,
    pub name: Option<String>,
    pub rssi: Option<i16>,
    pub services: Vec<String>,
}

/// Кому сообщить, что устройство отключилось (id периферии).
pub type DisconnectHandler = Arc<dyn Fn(String) + Send + Sync>;

pub struct BleCentral {
    adapter: Adapter,
    /// Найденные при сканировании устройства: подключение идёт по id из списка.
    known: Mutex<HashMap<String, Peripheral>>,
    events: JoinHandle<()>,
}

impl Drop for BleCentral {
    fn drop(&mut self) {
        self.events.abort();
    }
}

impl BleCentral {
    pub async fn new(on_disconnect: DisconnectHandler) -> Result<Self, String> {
        let manager = Manager::new()
            .await
            .map_err(|e| format!("ble_unavailable: {e}"))?;
        let adapter = manager
            .adapters()
            .await
            .map_err(|e| format!("ble_unavailable: {e}"))?
            .into_iter()
            .next()
            .ok_or_else(|| "ble_unavailable: no adapter".to_string())?;
        let mut stream = adapter
            .events()
            .await
            .map_err(|e| format!("ble_unavailable: {e}"))?;
        let events = tokio::spawn(async move {
            while let Some(event) = stream.next().await {
                if let CentralEvent::DeviceDisconnected(id) = event {
                    on_disconnect(id.to_string());
                }
            }
        });
        Ok(Self {
            adapter,
            known: Mutex::new(HashMap::new()),
            events,
        })
    }

    async fn ensure_powered(&self) -> Result<(), String> {
        let deadline = tokio::time::Instant::now() + POWER_WAIT;
        loop {
            match self.adapter.adapter_state().await {
                Ok(CentralState::PoweredOn) => return Ok(()),
                Ok(CentralState::PoweredOff) => return Err("ble_off: bluetooth is off".into()),
                // Unknown: система ещё не ответила или ждёт разрешения
                // пользователя. Недолго ждём, потом пробуем как есть.
                Ok(CentralState::Unknown) | Err(_) => {
                    if tokio::time::Instant::now() >= deadline {
                        return Ok(());
                    }
                    tokio::time::sleep(Duration::from_millis(150)).await;
                }
            }
        }
    }

    /// Сканировать `timeout`. `services` пуст — все устройства с именем.
    pub async fn scan(
        &self,
        services: Vec<Uuid>,
        timeout: Duration,
    ) -> Result<Vec<BleDeviceDto>, String> {
        self.ensure_powered().await?;
        let filter = ScanFilter {
            services: services.clone(),
        };
        self.adapter
            .start_scan(filter)
            .await
            .map_err(|e| format!("scan_failed: {e}"))?;
        tokio::time::sleep(timeout).await;
        let _ = self.adapter.stop_scan().await;
        let peripherals = self
            .adapter
            .peripherals()
            .await
            .map_err(|e| format!("scan_failed: {e}"))?;
        let mut out = Vec::new();
        let mut known = self.known.lock().await;
        for p in peripherals {
            let props = match p.properties().await {
                Ok(Some(props)) => props,
                _ => continue,
            };
            let advertised: Vec<String> = props.services.iter().map(|u| u.to_string()).collect();
            let matches_filter =
                services.is_empty() || props.services.iter().any(|u| services.contains(u));
            let name = props.local_name.or(props.advertisement_name);
            // Без фильтра показываем только устройства с именем: безымянные —
            // это чужие маячки и гарнитуры, выбрать среди них нельзя.
            if !matches_filter || (services.is_empty() && name.is_none()) {
                continue;
            }
            let id = p.id().to_string();
            out.push(BleDeviceDto {
                id: id.clone(),
                name,
                rssi: props.rssi,
                services: advertised,
            });
            known.insert(id, p);
        }
        out.sort_by(|a, b| b.rssi.unwrap_or(i16::MIN).cmp(&a.rssi.unwrap_or(i16::MIN)));
        Ok(out)
    }

    async fn find(&self, id: &str) -> Result<Peripheral, String> {
        if let Some(p) = self.known.lock().await.get(id) {
            return Ok(p.clone());
        }
        // Устройство с прошлого запуска: коротко сканируем и ищем его.
        self.scan(Vec::new(), Duration::from_secs(4)).await?;
        self.known
            .lock()
            .await
            .get(id)
            .cloned()
            .ok_or_else(|| format!("ble_device_not_found: {id}"))
    }
}

pub struct BleLink {
    peripheral: Peripheral,
    peripheral_id: String,
    characteristics: Vec<Characteristic>,
    notifier: JoinHandle<()>,
}

impl BleLink {
    pub async fn open(central: &BleCentral, id: &str, sink: EventSink) -> Result<Self, String> {
        let peripheral = central.find(id).await?;
        if !peripheral.is_connected().await.unwrap_or(false) {
            tokio::time::timeout(CONNECT_TIMEOUT, peripheral.connect())
                .await
                .map_err(|_| "ble_connect_failed: timeout".to_string())?
                .map_err(|e| format!("ble_connect_failed: {e}"))?;
        }
        tokio::time::timeout(DISCOVER_TIMEOUT, peripheral.discover_services())
            .await
            .map_err(|_| "ble_connect_failed: service discovery timeout".to_string())?
            .map_err(|e| format!("ble_connect_failed: {e}"))?;
        let characteristics: Vec<Characteristic> = peripheral.characteristics().into_iter().collect();
        let mut notifications = peripheral
            .notifications()
            .await
            .map_err(|e| format!("ble_connect_failed: {e}"))?;
        let notifier = tokio::spawn(async move {
            while let Some(n) = notifications.next().await {
                sink(RadioEvent::Notify {
                    characteristic: n.uuid.to_string(),
                    bytes: n.value,
                });
            }
        });
        Ok(Self {
            peripheral_id: peripheral.id().to_string(),
            peripheral,
            characteristics,
            notifier,
        })
    }

    pub fn peripheral_id(&self) -> &str {
        &self.peripheral_id
    }

    fn characteristic(&self, uuid: Uuid) -> Result<&Characteristic, String> {
        self.characteristics
            .iter()
            .find(|c| c.uuid == uuid)
            .ok_or_else(|| format!("characteristic_not_found: {uuid}"))
    }

    pub async fn subscribe(&self, uuid: Uuid) -> Result<(), String> {
        let c = self.characteristic(uuid)?;
        self.peripheral
            .subscribe(c)
            .await
            .map_err(|e| format!("ble_io_failed: {e}"))
    }

    pub async fn write(&self, uuid: Uuid, data: Vec<u8>, with_response: bool) -> Result<(), String> {
        let c = self.characteristic(uuid)?;
        let kind = if with_response {
            WriteType::WithResponse
        } else {
            WriteType::WithoutResponse
        };
        self.peripheral
            .write(c, &data, kind)
            .await
            .map_err(|e| format!("write_failed: {e}"))
    }

    pub async fn read(&self, uuid: Uuid) -> Result<Vec<u8>, String> {
        let c = self.characteristic(uuid)?;
        self.peripheral
            .read(c)
            .await
            .map_err(|e| format!("ble_io_failed: {e}"))
    }

    pub async fn close(&self) {
        self.notifier.abort();
        let _ = self.peripheral.disconnect().await;
    }

    /// Выход из приложения: отключение в фоне, не дожидаясь (выключенное
    /// устройство может не ответить). Соединение всё равно рвётся с процессом.
    pub fn abort(&self) {
        self.notifier.abort();
        let peripheral = self.peripheral.clone();
        tauri::async_runtime::spawn(async move {
            let _ = peripheral.disconnect().await;
        });
    }
}

/// UUID из интерфейса: полный вид (`6e400001-…`) или короткий 16-битный
/// (`2a19`), как их пишут в спецификациях Bluetooth.
pub fn parse_uuid(text: &str) -> Result<Uuid, String> {
    let t = text.trim();
    if t.len() == 4 && t.chars().all(|c| c.is_ascii_hexdigit()) {
        let short = u16::from_str_radix(t, 16).map_err(|_| format!("bad_uuid: {text}"))?;
        return Ok(btleplug::api::bleuuid::uuid_from_u16(short));
    }
    Uuid::parse_str(t).map_err(|_| format!("bad_uuid: {text}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uuids_are_parsed_in_both_forms() {
        assert_eq!(
            parse_uuid("6E400001-B5A3-F393-E0A9-E50E24DCCA9E").unwrap().to_string(),
            "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
        );
        assert_eq!(
            parse_uuid("2a19").unwrap().to_string(),
            "00002a19-0000-1000-8000-00805f9b34fb"
        );
        assert!(parse_uuid("zz").is_err());
        assert!(parse_uuid("").is_err());
    }
}
