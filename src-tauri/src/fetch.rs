//! Скачивание файла, размер и SHA-256 которого закреплены в приложении:
//! модели голосового ввода, модуль сжатия видео. Качается в `<файл>.part` и
//! переименовывается только после проверки — подменённого или обрезанного
//! файла на диске не остаётся.

use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::path::Path;
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::sync::watch;

use crate::tor::state::TorStatus;
use crate::tor::TorManager;

/// Что ждём от файла.
pub struct Pinned<'a> {
    /// Имя — для сообщений об ошибке.
    pub name: &'a str,
    pub sha256: &'a str,
    pub size: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum FetchError {
    #[error("cancelled")]
    Cancelled,
    #[error("download_failed: {0}")]
    Http(String),
    #[error("download_failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("hash_mismatch: {0}")]
    HashMismatch(String),
    #[error("size_mismatch: {0}")]
    SizeMismatch(String),
}

/// Пауза без единого байта, после которой скачивание считается оборванным.
const STALL_TIMEOUT: Duration = Duration::from_secs(60);

/// Клиент для скачивания: под Tor — только через Tor (fail-closed, как у
/// остальных запросов приложения), без Tor — напрямую.
pub async fn download_client(tor: &TorManager) -> Result<reqwest::Client, String> {
    let st = tor.state.read().await;
    let builder = reqwest::Client::builder()
        .user_agent("Bastyon/1.0")
        .connect_timeout(Duration::from_secs(30));
    let builder = match st.status {
        // `Off` при включённом Tor — перезапуск с новыми мостами, а не «без Tor».
        TorStatus::Off if tor.wanted.load(std::sync::atomic::Ordering::SeqCst) => {
            return Err(format!("{}: status=Off", crate::tor::TOR_NOT_READY))
        }
        TorStatus::Off => builder,
        TorStatus::Ready => builder.proxy(
            reqwest::Proxy::all(format!("socks5h://127.0.0.1:{}", st.socks_port))
                .map_err(|e| format!("download_failed: {e}"))?,
        ),
        other => return Err(format!("{}: status={other:?}", crate::tor::TOR_NOT_READY)),
    };
    builder.build().map_err(|e| format!("download_failed: {e}"))
}

/// Скачать `url` в `dest` с проверкой размера и SHA-256. `on_progress`
/// получает (скачано, всего) по мере прихода данных.
pub async fn fetch_pinned(
    client: &reqwest::Client,
    url: &str,
    pin: &Pinned<'_>,
    dest: &Path,
    cancel: &mut watch::Receiver<bool>,
    mut on_progress: impl FnMut(u64, u64),
) -> Result<(), FetchError> {
    if let Some(dir) = dest.parent() {
        tokio::fs::create_dir_all(dir).await?;
    }
    let part = dest.with_extension("part");
    let result = fetch_to(client, url, pin, &part, cancel, &mut on_progress).await;
    match result {
        Ok(()) => {
            tokio::fs::rename(&part, dest).await?;
            Ok(())
        }
        Err(e) => {
            let _ = tokio::fs::remove_file(&part).await;
            Err(e)
        }
    }
}

async fn fetch_to(
    client: &reqwest::Client,
    url: &str,
    pin: &Pinned<'_>,
    part: &Path,
    cancel: &mut watch::Receiver<bool>,
    on_progress: &mut impl FnMut(u64, u64),
) -> Result<(), FetchError> {
    let response = client
        .get(url)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| FetchError::Http(e.to_string()))?;
    let mut file = tokio::fs::File::create(part).await?;
    let mut hasher = Sha256::new();
    let mut received: u64 = 0;
    let mut stream = response.bytes_stream();
    on_progress(0, pin.size);
    loop {
        let next = tokio::select! {
            _ = cancel.changed() => {
                if *cancel.borrow() { return Err(FetchError::Cancelled) }
                continue;
            }
            chunk = tokio::time::timeout(STALL_TIMEOUT, stream.next()) => chunk,
        };
        let chunk = match next {
            Err(_) => return Err(FetchError::Http("stalled".into())),
            Ok(None) => break,
            Ok(Some(Err(e))) => return Err(FetchError::Http(e.to_string())),
            Ok(Some(Ok(chunk))) => chunk,
        };
        received += chunk.len() as u64;
        if received > pin.size {
            return Err(FetchError::SizeMismatch(pin.name.into()));
        }
        hasher.update(&chunk);
        file.write_all(&chunk).await?;
        on_progress(received, pin.size);
    }
    file.flush().await?;
    drop(file);
    if received != pin.size {
        return Err(FetchError::SizeMismatch(pin.name.into()));
    }
    let actual = hex::encode(hasher.finalize());
    if actual != pin.sha256 {
        return Err(FetchError::HashMismatch(pin.name.into()));
    }
    Ok(())
}
