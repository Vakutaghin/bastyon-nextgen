//! «Мои файлы»: что опубликовано с этого компьютера. Нода Kubo на устройстве
//! одна и раздаёт всё запиненное, а список, ссылки и ключи приватных файлов у
//! каждого аккаунта свои: ключи одного аккаунта не должны быть видны другому.
//!
//! Реестр аккаунта — `app_data_dir/ipfs/shares/<адрес>.json` с правами 0600
//! (там ключи приватных файлов). Ключ открывает только файл, который владелец
//! сам опубликовал и у которого есть оригинал, поэтому хранится как есть.

use super::config::REMOTE_PIN_SERVICE;
use super::state::IpfsStatus;
use super::{err_string, run_ipfs, write_private, IpfsManager};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::State;

/// Одна публикация. Ссылку собирает фронт (ipfs-viewer.ts): у публичного файла
/// `ipfs://<cid>/<имя>`, у приватного `ipfs://<cid>#key=…&name=…`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShareEntry {
    /// Корень ссылки: каталог-обёртка у публичного файла, шифртекст у приватного.
    pub cid: String,
    /// Имя файла; у публичного — ещё и путь внутри каталога-обёртки.
    pub name: String,
    /// Размер исходного файла.
    pub size: u64,
    /// Когда опубликован, мс от эпохи.
    pub added_at: u64,
    /// Ключ приватного файла (base64). У публичного нет.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
    /// Чужой файл, который аккаунт раздаёт дальше («Раздавать дальше» в чате).
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub received: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct Registry {
    version: u32,
    files: Vec<ShareEntry>,
}

const REGISTRY_VERSION: u32 = 1;

/// Адрес аккаунта Bastyon (base58) — он же имя файла реестра, поэтому
/// проверяется строго: без него путь из webview мог бы выйти из каталога.
pub fn check_account(account: &str) -> Result<(), String> {
    let base58 = |c: char| c.is_ascii_alphanumeric() && !matches!(c, '0' | 'O' | 'I' | 'l');
    if (20..=64).contains(&account.len()) && account.chars().all(base58) {
        Ok(())
    } else {
        Err("invalid account address".into())
    }
}

fn registry_path(dir: &Path, account: &str) -> Result<PathBuf, String> {
    check_account(account)?;
    Ok(dir.join(format!("{account}.json")))
}

/// Реестр аккаунта. Нечитаемый файл откладывается в сторону (`.bad`), а не
/// перезаписывается: иначе следующая публикация стёрла бы ключи всех прежних.
fn load(path: &Path) -> Vec<ShareEntry> {
    let bytes = match std::fs::read(path) {
        Ok(bytes) => bytes,
        Err(_) => return Vec::new(),
    };
    match serde_json::from_slice::<Registry>(&bytes) {
        Ok(registry) => registry.files,
        Err(e) => {
            log::warn!("[ipfs] unreadable share registry {}: {e}", path.display());
            let _ = std::fs::rename(path, path.with_extension("json.bad"));
            Vec::new()
        }
    }
}

/// Запись через временный файл и rename: оборванная запись не портит реестр.
fn save(path: &Path, files: Vec<ShareEntry>) -> Result<(), String> {
    let dir = path.parent().ok_or("registry has no directory")?;
    std::fs::create_dir_all(dir).map_err(err_string)?;
    let json = serde_json::to_vec_pretty(&Registry {
        version: REGISTRY_VERSION,
        files,
    })
    .map_err(err_string)?;
    let tmp = path.with_extension("json.tmp");
    write_private(&tmp, &json).map_err(err_string)?;
    std::fs::rename(&tmp, path).map_err(err_string)
}

/// Новые — сверху. Повторная публикация того же файла (тот же CID) заменяет запись.
pub fn record(dir: &Path, account: &str, entry: ShareEntry) -> Result<(), String> {
    let path = registry_path(dir, account)?;
    let mut files = load(&path);
    files.retain(|f| f.cid != entry.cid);
    files.insert(0, entry);
    save(&path, files)
}

pub fn list(dir: &Path, account: &str) -> Result<Vec<ShareEntry>, String> {
    Ok(load(&registry_path(dir, account)?))
}

/// Убирает запись; None — такой не было.
pub fn remove(dir: &Path, account: &str, cid: &str) -> Result<Option<ShareEntry>, String> {
    let path = registry_path(dir, account)?;
    let mut files = load(&path);
    let Some(index) = files.iter().position(|f| f.cid == cid) else {
        return Ok(None);
    };
    let entry = files.remove(index);
    save(&path, files)?;
    Ok(Some(entry))
}

/// Тот же CID раздаёт ещё какой-то аккаунт этого устройства — тогда pin
/// снимать нельзя: он у ноды общий.
pub fn shared_by_others(dir: &Path, account: &str, cid: &str) -> bool {
    let Ok(read) = std::fs::read_dir(dir) else {
        return false;
    };
    read.flatten().any(|item| {
        let path = item.path();
        let other = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or_default();
        path.extension().is_some_and(|e| e == "json")
            && other != account
            && load(&path).iter().any(|f| f.cid == cid)
    })
}

/// Реестр аккаунта целиком (аккаунт удалён с устройства).
pub fn take_all(dir: &Path, account: &str) -> Result<Vec<ShareEntry>, String> {
    let path = registry_path(dir, account)?;
    let files = load(&path);
    let _ = std::fs::remove_file(&path);
    Ok(files)
}

/// Статусы удалённого pin из `ipfs pin remote ls --enc=json`: по объекту на
/// строку, `{"Status":"pinned","Cid":"…","Name":"…"}`.
pub fn parse_remote_ls(out: &str) -> HashMap<String, String> {
    #[derive(Deserialize)]
    struct Line {
        #[serde(rename = "Status")]
        status: String,
        #[serde(rename = "Cid")]
        cid: String,
    }
    out.lines()
        .filter_map(|line| serde_json::from_str::<Line>(line.trim()).ok())
        .map(|line| (line.cid, line.status))
        .collect()
}

/// Перестать раздавать: снять pin у себя и на сервисе, если CID не раздаёт
/// другой аккаунт, и отдать блоки сборщику мусора. Ошибки Kubo не мешают
/// убрать запись: не запиненный уже CID снимать нечего.
async fn stop_serving(mgr: &IpfsManager, account: &str, cids: &[String]) {
    let remote = service_configured(mgr).await;
    let service = format!("--service={REMOTE_PIN_SERVICE}");
    let mut unpinned = false;
    for cid in cids {
        if shared_by_others(&mgr.paths.shares_dir, account, cid) {
            continue;
        }
        if let Err(e) = run_ipfs(&mgr.paths, &["pin", "rm", "--", cid]).await {
            log::warn!("[ipfs] pin rm {cid}: {e}");
        }
        if remote {
            // По умолчанию Kubo снимает только готовые копии — а сервис мог ещё
            // не дотянуть файл.
            let target = format!("--cid={cid}");
            let status = "--status=queued,pinning,pinned,failed";
            let args = ["pin", "remote", "rm", &service, &target, status, "--force"];
            if let Err(e) = run_ipfs(&mgr.paths, &args).await {
                log::warn!("[ipfs] pin remote rm {cid}: {e}");
            }
        }
        unpinned = true;
    }
    if !unpinned {
        return;
    }
    // Без GC снятые блоки лежали бы в repo и отдавались по запросу, пока не
    // наберётся порог StorageMax. С демоном GC идёт через RPC в фоне. Без
    // него команда держит repo.lock — тогда сразу и под start_lock, чтобы
    // запуск ноды подождал, а не упал на занятом repo.
    if mgr.state.read().await.status == IpfsStatus::Running {
        let paths = mgr.paths.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = run_ipfs(&paths, &["repo", "gc", "--quiet"]).await {
                log::warn!("[ipfs] repo gc: {e}");
            }
        });
    } else {
        let _start = mgr.start_lock.lock().await;
        if let Err(e) = run_ipfs(&mgr.paths, &["repo", "gc", "--quiet"]).await {
            log::warn!("[ipfs] repo gc: {e}");
        }
    }
}

async fn service_configured(mgr: &IpfsManager) -> bool {
    run_ipfs(&mgr.paths, &["pin", "remote", "service", "ls"])
        .await
        .is_ok_and(|out| out.contains(REMOTE_PIN_SERVICE))
}

/// Список «Мои файлы» аккаунта, новые сверху.
#[tauri::command]
pub async fn ipfs_shares(
    account: String,
    mgr: State<'_, IpfsManager>,
) -> Result<Vec<ShareEntry>, String> {
    let _guard = mgr.shares_lock.lock().await;
    list(&mgr.paths.shares_dir, &account)
}

/// Перестать раздавать файл. Повторный вызов — не ошибка.
#[tauri::command]
pub async fn ipfs_unshare(
    account: String,
    cid: String,
    mgr: State<'_, IpfsManager>,
) -> Result<(), String> {
    let _guard = mgr.shares_lock.lock().await;
    if remove(&mgr.paths.shares_dir, &account, &cid)?.is_some() {
        stop_serving(&mgr, &account, &[cid]).await;
    }
    Ok(())
}

/// Аккаунт удалён с устройства: его файлы больше не раздаются.
#[tauri::command]
pub async fn ipfs_forget_account(
    account: String,
    mgr: State<'_, IpfsManager>,
) -> Result<(), String> {
    let _guard = mgr.shares_lock.lock().await;
    let cids: Vec<String> = take_all(&mgr.paths.shares_dir, &account)?
        .into_iter()
        .map(|f| f.cid)
        .collect();
    stop_serving(&mgr, &account, &cids).await;
    Ok(())
}

/// Где сейчас копии на удалённом сервисе: CID → queued | pinning | pinned |
/// failed. Без настроенного сервиса — пусто. Фильтр по CID — пачками по 10:
/// больше Pinning Service API за раз не принимает.
#[tauri::command]
pub async fn ipfs_share_status(
    account: String,
    mgr: State<'_, IpfsManager>,
) -> Result<HashMap<String, String>, String> {
    let cids: Vec<String> = {
        let _guard = mgr.shares_lock.lock().await;
        list(&mgr.paths.shares_dir, &account)?
            .into_iter()
            .map(|f| f.cid)
            .collect()
    };
    let mut statuses = HashMap::new();
    if cids.is_empty() || !service_configured(&mgr).await {
        return Ok(statuses);
    }
    let service = format!("--service={REMOTE_PIN_SERVICE}");
    for batch in cids.chunks(10) {
        let filter = format!("--cid={}", batch.join(","));
        let out = run_ipfs(
            &mgr.paths,
            &[
                "pin",
                "remote",
                "ls",
                &service,
                &filter,
                "--status=queued,pinning,pinned,failed",
                "--enc=json",
            ],
        )
        .await?;
        statuses.extend(parse_remote_ls(&out));
    }
    Ok(statuses)
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALICE: &str = "PQ8AiCHJaTZAThr2TnpkQYDEYTqULsMhCT";
    const BOB: &str = "PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82";

    fn temp_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("bastyon-shares-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    fn entry(cid: &str, key: Option<&str>) -> ShareEntry {
        ShareEntry {
            cid: cid.into(),
            name: "Отчёт за май.pdf".into(),
            size: 12,
            added_at: 1,
            key: key.map(Into::into),
            received: false,
        }
    }

    #[test]
    fn account_must_look_like_an_address() {
        assert!(check_account(ALICE).is_ok());
        for bad in [
            "",
            "../../etc/passwd",
            "a/b",
            "short",
            "P0000000000000000000000",
            "Pl1111111111111111111111",
        ] {
            assert!(check_account(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn records_newest_first_and_replaces_the_same_cid() {
        let dir = temp_dir("record");
        record(&dir, ALICE, entry("bafyone", None)).unwrap();
        record(&dir, ALICE, entry("bafytwo", Some("a2V5"))).unwrap();
        record(&dir, ALICE, entry("bafyone", None)).unwrap();
        let cids: Vec<String> = list(&dir, ALICE)
            .unwrap()
            .into_iter()
            .map(|f| f.cid)
            .collect();
        assert_eq!(cids, ["bafyone", "bafytwo"]);
        // Ключ приватного файла переживает перезапись реестра.
        assert_eq!(list(&dir, ALICE).unwrap()[1].key.as_deref(), Some("a2V5"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn accounts_do_not_see_each_other() {
        let dir = temp_dir("accounts");
        record(&dir, ALICE, entry("bafyalice", Some("secret"))).unwrap();
        assert!(list(&dir, BOB).unwrap().is_empty());
        assert!(shared_by_others(&dir, BOB, "bafyalice"));
        assert!(!shared_by_others(&dir, ALICE, "bafyalice"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn remove_and_take_all() {
        let dir = temp_dir("remove");
        record(&dir, ALICE, entry("bafyone", None)).unwrap();
        record(&dir, ALICE, entry("bafytwo", None)).unwrap();
        assert!(remove(&dir, ALICE, "bafyone").unwrap().is_some());
        assert!(remove(&dir, ALICE, "bafyone").unwrap().is_none());
        assert_eq!(take_all(&dir, ALICE).unwrap().len(), 1);
        assert!(list(&dir, ALICE).unwrap().is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_broken_registry_is_set_aside_not_overwritten() {
        let dir = temp_dir("broken");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join(format!("{ALICE}.json")), b"{not json").unwrap();
        record(&dir, ALICE, entry("bafynew", None)).unwrap();
        assert_eq!(list(&dir, ALICE).unwrap().len(), 1);
        assert_eq!(
            std::fs::read(dir.join(format!("{ALICE}.json.bad"))).unwrap(),
            b"{not json"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn the_registry_is_private_to_the_user() {
        use std::os::unix::fs::PermissionsExt;
        let dir = temp_dir("mode");
        record(&dir, ALICE, entry("bafyone", Some("key"))).unwrap();
        let mode = std::fs::metadata(dir.join(format!("{ALICE}.json")))
            .unwrap()
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o600);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn remote_statuses_are_read_from_json_lines() {
        let out = concat!(
            "{\"Status\":\"pinned\",\"Cid\":\"bafyone\",\"Name\":\"\"}\n",
            "{\"Status\":\"pinning\",\"Cid\":\"bafytwo\",\"Name\":\"x\"}\n",
            "garbage\n"
        );
        let statuses = parse_remote_ls(out);
        assert_eq!(statuses.get("bafyone").map(String::as_str), Some("pinned"));
        assert_eq!(statuses.get("bafytwo").map(String::as_str), Some("pinning"));
        assert_eq!(statuses.len(), 2);
    }

    /// С настоящим Kubo (в PATH или Homebrew), во временном repo без демона:
    /// `cargo test --lib ipfs::shares::tests::with_kubo -- --ignored`.
    #[tokio::test]
    #[ignore]
    async fn with_kubo_unsharing_unpins_unless_another_account_shares_the_file() {
        use crate::ipfs::state::IpfsPaths;
        let kubo = ["/opt/homebrew/bin/ipfs", "/usr/local/bin/ipfs"]
            .into_iter()
            .map(PathBuf::from)
            .find(|p| p.exists())
            .expect("Kubo is not installed");
        let root = temp_dir("kubo");
        let mut paths = IpfsPaths::new(root.join("cache"), root.join("data").join("repo"));
        paths.binary = kubo;
        std::fs::create_dir_all(&paths.repo).unwrap();
        run_ipfs(&paths, &["init", "--profile=test"]).await.unwrap();

        let file = root.join("Отчёт за май.pdf");
        std::fs::write(&file, b"report body").unwrap();
        let file_s = file.to_string_lossy().to_string();
        let args = [
            "add",
            "-Q",
            "-w",
            "--cid-version=1",
            "--pin=true",
            "--",
            &file_s,
        ];
        let dir_cid = run_ipfs(&paths, &args).await.unwrap();
        // Имя файла — внутри каталога-обёртки: по нему строится ссылка.
        let listing = run_ipfs(&paths, &["ls", &dir_cid]).await.unwrap();
        assert!(listing.ends_with("Отчёт за май.pdf"), "{listing}");

        let shares_dir = paths.shares_dir.clone();
        record(&shares_dir, ALICE, entry(&dir_cid, None)).unwrap();
        record(&shares_dir, BOB, entry(&dir_cid, None)).unwrap();
        let mgr = IpfsManager::new(paths.clone());
        let pinned = || async {
            run_ipfs(&paths, &["pin", "ls", "--type=recursive", "-q"])
                .await
                .unwrap()
                .lines()
                .any(|l| l == dir_cid)
        };

        // Алиса перестала раздавать, но тот же файл раздаёт Боб — pin остаётся.
        remove(&shares_dir, ALICE, &dir_cid).unwrap();
        stop_serving(&mgr, ALICE, std::slice::from_ref(&dir_cid)).await;
        assert!(pinned().await);

        remove(&shares_dir, BOB, &dir_cid).unwrap();
        stop_serving(&mgr, BOB, std::slice::from_ref(&dir_cid)).await;
        assert!(!pinned().await);
        let _ = std::fs::remove_dir_all(&root);
    }
}
