//! TCP до радио в локальной сети: MeshCore companion по Wi-Fi (порт 5000),
//! Meshtastic (4403), `meshtasticd`. Разрешены только адреса LAN — см. addr.rs.

use super::addr::{is_lan_ip, parse_target, TcpTarget};
use super::{EventSink, RadioEvent};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::tcp::OwnedWriteHalf;
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(6);

pub struct TcpLink {
    writer: Arc<Mutex<OwnedWriteHalf>>,
    reader: JoinHandle<()>,
}

/// Адреса, к которым можно подключиться: сам IP или всё, во что разрешилось
/// имя, — и только в пределах локальной сети.
pub async fn resolve(host: &str, port: u16) -> Result<Vec<SocketAddr>, String> {
    if port == 0 {
        return Err("bad_address: port 0".into());
    }
    match parse_target(host)? {
        TcpTarget::Ip(ip) => Ok(vec![SocketAddr::new(ip, port)]),
        TcpTarget::Name(name) => {
            let found: Vec<SocketAddr> = tokio::net::lookup_host((name.as_str(), port))
                .await
                .map_err(|e| format!("resolve_failed: {e}"))?
                .collect();
            if found.is_empty() {
                return Err(format!("resolve_failed: {name}"));
            }
            // Имя в .local могло разрешиться в публичный адрес — такие не берём.
            let lan: Vec<SocketAddr> = found.into_iter().filter(|a| is_lan_ip(a.ip())).collect();
            if lan.is_empty() {
                return Err(format!("address_not_allowed: {name}"));
            }
            Ok(lan)
        }
    }
}

impl TcpLink {
    pub async fn open(
        host: &str,
        port: u16,
        sink: EventSink,
        on_gone: Box<dyn FnOnce() + Send>,
    ) -> Result<Self, String> {
        let addrs = resolve(host, port).await?;
        let mut last_err = String::from("connect_failed");
        for addr in addrs {
            match tokio::time::timeout(CONNECT_TIMEOUT, TcpStream::connect(addr)).await {
                Ok(Ok(stream)) => return Ok(Self::from_stream(stream, sink, on_gone)),
                Ok(Err(e)) => last_err = format!("connect_failed: {e}"),
                Err(_) => last_err = format!("connect_failed: timeout {addr}"),
            }
        }
        Err(last_err)
    }

    pub(crate) fn from_stream(
        stream: TcpStream,
        sink: EventSink,
        on_gone: Box<dyn FnOnce() + Send>,
    ) -> Self {
        let _ = stream.set_nodelay(true);
        let (mut read_half, write_half) = stream.into_split();
        let reader = tokio::spawn(async move {
            let mut buf = vec![0u8; 4096];
            let reason = loop {
                match read_half.read(&mut buf).await {
                    Ok(0) => break Some("device_lost: connection closed".to_string()),
                    Ok(n) => sink(RadioEvent::Data {
                        bytes: buf[..n].to_vec(),
                    }),
                    Err(e) => break Some(format!("device_lost: {e}")),
                }
            };
            sink(RadioEvent::Closed { reason });
            on_gone();
        });
        Self {
            writer: Arc::new(Mutex::new(write_half)),
            reader,
        }
    }

    pub async fn write(&self, data: Vec<u8>) -> Result<(), String> {
        let mut w = self.writer.lock().await;
        w.write_all(&data)
            .await
            .map_err(|e| format!("write_failed: {e}"))?;
        w.flush().await.map_err(|e| format!("write_failed: {e}"))
    }

    /// Прервать чтение без ожидания (выход из приложения): сокет закроется
    /// вместе с процессом.
    pub fn abort(&self) {
        self.reader.abort();
    }

    /// Закрыть по просьбе интерфейса: чтение прерываем, событие `closed` не шлём.
    pub async fn close(&self) {
        self.reader.abort();
        let mut w = self.writer.lock().await;
        let _ = w.shutdown().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::TcpListener;
    use tokio::sync::mpsc;

    #[tokio::test]
    async fn public_hosts_are_refused_before_connecting() {
        assert!(resolve("8.8.8.8", 4403).await.unwrap_err().starts_with("address_not_allowed"));
        assert!(resolve("example.org", 5000).await.unwrap_err().starts_with("address_not_allowed"));
        assert!(resolve("127.0.0.1", 0).await.unwrap_err().starts_with("bad_address"));
    }

    #[tokio::test]
    async fn bytes_flow_both_ways_and_close_is_reported() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let (tx, mut rx) = mpsc::unbounded_channel::<RadioEvent>();
        let sink: EventSink = Arc::new(move |ev| {
            let _ = tx.send(ev);
        });
        let (gone_tx, gone_rx) = tokio::sync::oneshot::channel::<()>();
        let open = TcpLink::open(
            "127.0.0.1",
            port,
            sink,
            Box::new(move || {
                let _ = gone_tx.send(());
            }),
        );
        let (link, accepted) = tokio::join!(open, listener.accept());
        let link = link.expect("connect");
        let (mut device, _) = accepted.unwrap();

        device.write_all(b">\x01\x00\x0a").await.unwrap();
        let mut got = Vec::new();
        while got.len() < 4 {
            match rx.recv().await.expect("event") {
                RadioEvent::Data { bytes } => got.extend(bytes),
                other => panic!("unexpected {other:?}"),
            }
        }
        assert_eq!(got, b">\x01\x00\x0a");

        link.write(b"<\x01\x00\x0a".to_vec()).await.unwrap();
        let mut from_app = [0u8; 4];
        device.read_exact(&mut from_app).await.unwrap();
        assert_eq!(&from_app, b"<\x01\x00\x0a");

        // Устройство пропало — интерфейс узнаёт об этом событием `closed`.
        drop(device);
        match rx.recv().await.expect("closed event") {
            RadioEvent::Closed { reason } => {
                assert!(reason.unwrap().starts_with("device_lost"));
            }
            other => panic!("unexpected {other:?}"),
        }
        gone_rx.await.expect("on_gone called");
    }
}
