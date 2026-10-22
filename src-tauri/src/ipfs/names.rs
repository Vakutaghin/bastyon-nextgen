//! Постоянные ссылки — свои имена IPNS. Запись имени подписывает фронт
//! (ipns-names.ts) ключом, выведенным из ключа аккаунта, и сам отправляет её в
//! delegated routing. С модулем запись кладёт в DHT ещё и свой Kubo:
//! `ipfs routing put`. Ключ имени в Kubo не импортируется — на диске его нет.

use super::state::IpfsStatus;
use super::{err_string, run_ipfs, IpfsManager};
use base64::Engine;
use std::sync::atomic::{AtomicU32, Ordering};
use tauri::State;

/// Как MAX_RECORD_SIZE в @helia/ipns: больше запись IPNS не бывает.
const MAX_RECORD_BYTES: usize = 10 * 1024;

/// Имя IPNS в base36 (`k51…`). Из него собирается аргумент Kubo — проверка строгая.
pub fn check_name(name: &str) -> Result<(), String> {
    let base36 = |c: char| c.is_ascii_digit() || c.is_ascii_lowercase();
    if name.starts_with('k') && (50..=70).contains(&name.len()) && name.chars().all(base36) {
        Ok(())
    } else {
        Err("invalid IPNS name".into())
    }
}

/// Подписанная запись (base64) → байты; пустая или больше предела — ошибка.
pub fn decode_record(record: &str) -> Result<Vec<u8>, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(record.as_bytes())
        .map_err(err_string)?;
    if bytes.is_empty() || bytes.len() > MAX_RECORD_BYTES {
        return Err("invalid IPNS record size".into());
    }
    Ok(bytes)
}

/// Положить запись имени в DHT своим Kubo. Подпись проверяет сам Kubo: чужую
/// запись он не примет. Нода не запущена — ошибка, фронт этим не ждёт.
#[tauri::command]
pub async fn ipfs_name_put(
    name: String,
    record: String,
    mgr: State<'_, IpfsManager>,
) -> Result<(), String> {
    check_name(&name)?;
    let bytes = decode_record(&record)?;
    if mgr.state.read().await.status != IpfsStatus::Running {
        return Err("ipfs is not running".into());
    }
    // Kubo читает значение только из файла. Запись публичная — тайны в ней нет.
    static COUNTER: AtomicU32 = AtomicU32::new(0);
    let file = std::env::temp_dir().join(format!(
        "bastyon-ipns-{}-{}.bin",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    std::fs::write(&file, &bytes).map_err(err_string)?;
    let key = format!("/ipns/{name}");
    let path = file.to_string_lossy().to_string();
    let result = run_ipfs(&mgr.paths, &["routing", "put", "--", &key, &path]).await;
    let _ = std::fs::remove_file(&file);
    result.map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_base36_names_reach_kubo() {
        assert!(
            check_name("k51qzi5uqu5dkxmzvkhc42poz8bqi5t742v6qda52xv7c4ff115356d77amfwc").is_ok()
        );
        for bad in [
            "",
            "k51",
            "K51QZI5UQU5DKXMZVKHC42POZ8BQI5T742V6QDA52XV7C4FF115356D77AMFWC",
            "k51qzi5uqu5dkxmzvkhc42poz8bqi5t742v6qda52xv7c4ff115356d77am/../x",
            "--offline-k51qzi5uqu5dkxmzvkhc42poz8bqi5t742v6qda52xv7c4ff1153",
            "12D3KooWT3Jt9fDTyDbKhoBkT2mKWpfXcAePjGGYRb1TutjwfN3Z",
        ] {
            assert!(check_name(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn record_size_is_bounded() {
        let b64 = |n: usize| base64::engine::general_purpose::STANDARD.encode(vec![1u8; n]);
        assert_eq!(decode_record(&b64(397)).unwrap().len(), 397);
        assert!(decode_record("").is_err());
        assert!(decode_record(&b64(MAX_RECORD_BYTES + 1)).is_err());
        assert!(decode_record("not base64!").is_err());
    }
}
