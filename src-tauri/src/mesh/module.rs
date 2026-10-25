//! Файл модуля mesh-сетей: скачать, проверить, распаковать, удалить.
//!
//! Модуль собирается в релизе вместе с приложением (джоба `desktop` в
//! release.yml) и лежит в том же релизе: `_bastyon-mesh-<платформа>.gz`
//! (до 0.13.4 — без `_`; служебные файлы релиза с `_` уходят в конец списка).
//! Размер и SHA-256 архива сборка приложения получает из той же джобы
//! (`BASTYON_MESH_MODULE_SHA256`, `BASTYON_MESH_MODULE_SIZE`) и вшивает в
//! себя: скачанная программа — канал исполнения чужого кода, и подменённый
//! файл не пройдёт, откуда бы ни пришёл. Под Tor — только через Tor.
//!
//! Модуль своей версии приложения: после обновления приложения прежний
//! работает, пока в фоне не скачается новый (`stage`), а встаёт новый
//! при следующем запуске модуля. Сборка без закреплённого хэша (своя,
//! отладочная) модуль не скачивает: она берёт программу из
//! `BASTYON_MESH_MODULE` или, в debug, собранную рядом
//! (`cargo build -p bastyon-mesh`).

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tokio::sync::watch;

use crate::fetch::{fetch_pinned, FetchError, Pinned};

const REPO: &str = "Vakutaghin/bastyon-nextgen";

/// Закреплённый архив модуля этой сборки: размер и SHA-256 `.gz`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Pin {
    pub sha256: &'static str,
    pub size: u64,
}

fn parse_pin(sha256: Option<&'static str>, size: Option<&'static str>) -> Option<Pin> {
    let sha256 = sha256?.trim();
    let size = size?.trim().parse::<u64>().ok()?;
    let valid = sha256.len() == 64 && sha256.chars().all(|c| c.is_ascii_hexdigit());
    (valid && size > 0).then_some(Pin { sha256, size })
}

pub fn pin() -> Option<Pin> {
    parse_pin(
        option_env!("BASTYON_MESH_MODULE_SHA256"),
        option_env!("BASTYON_MESH_MODULE_SIZE"),
    )
}

/// Платформа в имени архива — те же ключи, что у обновлений (latest.json).
pub fn platform_key(os: &str, arch: &str) -> Option<&'static str> {
    match (os, arch) {
        ("macos", "aarch64") => Some("darwin-aarch64"),
        ("macos", "x86_64") => Some("darwin-x86_64"),
        ("linux", "x86_64") => Some("linux-x86_64"),
        ("linux", "aarch64") => Some("linux-aarch64"),
        ("windows", "x86_64") => Some("windows-x86_64"),
        _ => None,
    }
}

fn current_key() -> Option<&'static str> {
    platform_key(std::env::consts::OS, std::env::consts::ARCH)
}

pub fn archive_name(key: &str) -> String {
    format!("_bastyon-mesh-{key}.gz")
}

/// Архив лежит в релизе той версии приложения, которой он собран.
pub fn archive_url(version: &str, key: &str) -> String {
    format!(
        "https://github.com/{REPO}/releases/download/v{version}/{}",
        archive_name(key)
    )
}

/// Что установлено: версия приложения, с которой пришёл модуль, и хэш архива.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Marker {
    pub version: String,
    pub sha256: String,
}

#[derive(Clone)]
pub struct ModulePaths {
    dir: PathBuf,
}

impl ModulePaths {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir }
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    pub fn binary(&self) -> PathBuf {
        self.dir.join(if cfg!(windows) {
            "bastyon-mesh.exe"
        } else {
            "bastyon-mesh"
        })
    }

    fn marker(&self) -> PathBuf {
        self.dir.join("install.json")
    }

    /// Скачанное обновление: архив и его хэш ждут следующего запуска модуля.
    fn staged(&self) -> PathBuf {
        self.dir.join("update.gz")
    }

    fn staged_marker(&self) -> PathBuf {
        self.dir.join("update.json")
    }

    fn read_marker(path: &Path) -> Option<Marker> {
        let raw = std::fs::read_to_string(path).ok()?;
        serde_json::from_str(&raw).ok()
    }

    /// Программа на месте и маркер. Маркер пишется последним: программа,
    /// распакованная наполовину перед падением, без него готовой не считается.
    pub fn installed(&self) -> Option<Marker> {
        let marker = Self::read_marker(&self.marker())?;
        self.binary().is_file().then_some(marker)
    }

    /// Обновление скачано и ждёт: его хэш совпадает с закреплённым.
    pub fn staged_for(&self, pin: &Pin) -> bool {
        Self::read_marker(&self.staged_marker()).is_some_and(|m| m.sha256 == pin.sha256)
            && self.staged().is_file()
    }

    /// Распаковать архив в программу и записать маркер. Пишется во временный
    /// файл рядом и переименовывается: недописанная программа не займёт место
    /// настоящей. На Windows запущенный .exe не перезаписать, но переименовать
    /// можно — прежний уходит в `.old` и удаляется при следующем запуске.
    pub fn unpack(&self, gz: &Path, marker: &Marker) -> std::io::Result<()> {
        let dest = self.binary();
        let part = dest.with_extension("unpack");
        let result = (|| {
            let mut decoder = flate2::read::GzDecoder::new(std::fs::File::open(gz)?);
            let mut out = std::fs::File::create(&part)?;
            let mut buf = vec![0u8; 1 << 20];
            loop {
                let n = decoder.read(&mut buf)?;
                if n == 0 {
                    break;
                }
                out.write_all(&buf[..n])?;
            }
            out.flush()?;
            drop(out);
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&part, std::fs::Permissions::from_mode(0o755))?;
            }
            if cfg!(windows) && dest.exists() {
                let old = dest.with_extension("old");
                let _ = std::fs::remove_file(&old);
                std::fs::rename(&dest, &old)?;
            }
            std::fs::rename(&part, &dest)
        })();
        if result.is_err() {
            let _ = std::fs::remove_file(&part);
        }
        result?;
        std::fs::write(self.marker(), serde_json::to_string(marker)?)
    }

    /// Перед запуском: встало ли скачанное обновление — распаковать его.
    /// Хэш архива сверяется ещё раз: файл мог смениться, пока лежал.
    pub fn apply_staged(&self, pin: &Pin) -> std::io::Result<bool> {
        let _ = std::fs::remove_file(self.binary().with_extension("old"));
        if !self.staged_for(pin) {
            return Ok(false);
        }
        let staged = self.staged();
        let ok = sha256_file(&staged)? == pin.sha256;
        if ok {
            let marker = Self::read_marker(&self.staged_marker()).expect("checked above");
            self.unpack(&staged, &marker)?;
        }
        let _ = std::fs::remove_file(&staged);
        let _ = std::fs::remove_file(self.staged_marker());
        Ok(ok)
    }

    /// Убрать модуль: сначала маркер — без него остаток не считается модулем.
    pub fn remove(&self) -> std::io::Result<()> {
        for path in [self.marker(), self.staged_marker(), self.staged()] {
            if path.exists() {
                std::fs::remove_file(path)?;
            }
        }
        let binary = self.binary();
        if binary.exists() {
            std::fs::remove_file(&binary)?;
        }
        let _ = std::fs::remove_file(binary.with_extension("old"));
        Ok(())
    }

    /// Недокачанное и недораспакованное с прошлого запуска.
    pub fn clean_leftovers(&self) {
        let Ok(entries) = std::fs::read_dir(&self.dir) else {
            return;
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".part")
                || name.ends_with(".unpack")
                || name.starts_with("bastyon-mesh-")
            {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
}

fn sha256_file(path: &Path) -> std::io::Result<String> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

/// Модуль этой сборки: что качать и куда. None — сборка без закреплённого
/// модуля или платформа, для которой его нет.
pub fn downloadable() -> Option<(Pin, &'static str)> {
    Some((pin()?, current_key()?))
}

/// Скачать архив модуля в `dest` с проверкой размера и хэша.
pub async fn download(
    client: &reqwest::Client,
    dest: &Path,
    cancel: &mut watch::Receiver<bool>,
    on_progress: impl FnMut(u64, u64),
) -> Result<Marker, String> {
    let (pin, key) = downloadable().ok_or_else(|| "unsupported_platform".to_string())?;
    let name = archive_name(key);
    let version = env!("CARGO_PKG_VERSION");
    let pinned = Pinned {
        name: &name,
        sha256: pin.sha256,
        size: pin.size,
    };
    match fetch_pinned(
        client,
        &archive_url(version, key),
        &pinned,
        dest,
        cancel,
        on_progress,
    )
    .await
    {
        Ok(()) => Ok(Marker {
            version: version.to_string(),
            sha256: pin.sha256.to_string(),
        }),
        Err(FetchError::Cancelled) => Err(FetchError::Cancelled.to_string()),
        Err(e) => Err(e.to_string()),
    }
}

/// Скачать архив модуля этой сборки про запас (`update.gz`). Ставит его
/// `apply_staged`: при установке — сразу, при обновлении в фоне — при
/// следующем запуске модуля, не прерывая работающий.
pub async fn stage(
    client: &reqwest::Client,
    paths: &ModulePaths,
    cancel: &mut watch::Receiver<bool>,
    on_progress: impl FnMut(u64, u64),
) -> Result<(), String> {
    let (pin, _) = downloadable().ok_or_else(|| "unsupported_platform".to_string())?;
    if paths.staged_for(&pin) {
        return Ok(());
    }
    std::fs::create_dir_all(paths.dir()).map_err(|e| format!("install_failed: {e}"))?;
    let marker = download(client, &paths.staged(), cancel, on_progress).await?;
    let body = serde_json::to_string(&marker).map_err(|e| format!("install_failed: {e}"))?;
    std::fs::write(paths.staged_marker(), body).map_err(|e| format!("install_failed: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("mesh-module-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn gz(dir: &Path, name: &str, body: &[u8]) -> PathBuf {
        let path = dir.join(name);
        let mut enc = flate2::write::GzEncoder::new(
            std::fs::File::create(&path).unwrap(),
            flate2::Compression::fast(),
        );
        enc.write_all(body).unwrap();
        enc.finish().unwrap();
        path
    }

    #[test]
    fn pin_needs_a_hash_and_a_size() {
        let sha = "ab".repeat(32);
        let sha: &'static str = Box::leak(sha.into_boxed_str());
        assert_eq!(
            parse_pin(Some(sha), Some("5242880")),
            Some(Pin {
                sha256: sha,
                size: 5_242_880
            })
        );
        assert_eq!(parse_pin(None, Some("1")), None, "сборка без модуля");
        assert_eq!(parse_pin(Some(sha), None), None);
        assert_eq!(parse_pin(Some("abc"), Some("1")), None, "не хэш");
        assert_eq!(parse_pin(Some(sha), Some("0")), None);
        assert_eq!(parse_pin(Some(sha), Some("много")), None);
    }

    #[test]
    fn archive_is_in_the_release_of_this_version() {
        assert_eq!(
            archive_url("0.13.5", "darwin-aarch64"),
            "https://github.com/Vakutaghin/bastyon-nextgen/releases/download/v0.13.5/_bastyon-mesh-darwin-aarch64.gz"
        );
        assert_eq!(platform_key("windows", "x86_64"), Some("windows-x86_64"));
        assert_eq!(platform_key("windows", "aarch64"), None);
        assert_eq!(platform_key("freebsd", "x86_64"), None);
    }

    #[test]
    fn installed_needs_the_binary_and_the_marker() {
        let dir = temp_dir("installed");
        let paths = ModulePaths::new(dir.clone());
        let marker = Marker {
            version: "0.12.0".into(),
            sha256: "ab".repeat(32),
        };
        assert_eq!(paths.installed(), None);

        let archive = gz(&dir, "m.gz", b"#!/bin/sh\necho mesh\n");
        paths.unpack(&archive, &marker).unwrap();
        assert_eq!(paths.installed(), Some(marker.clone()));
        assert_eq!(
            std::fs::read(paths.binary()).unwrap(),
            b"#!/bin/sh\necho mesh\n"
        );
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(paths.binary())
                .unwrap()
                .permissions()
                .mode();
            assert_eq!(mode & 0o111, 0o111);
        }

        std::fs::remove_file(paths.binary()).unwrap();
        assert_eq!(paths.installed(), None, "без программы");

        paths.unpack(&archive, &marker).unwrap();
        paths.remove().unwrap();
        assert_eq!(paths.installed(), None);
        assert!(!paths.binary().exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn broken_archive_leaves_the_old_module_in_place() {
        let dir = temp_dir("broken");
        let paths = ModulePaths::new(dir.clone());
        let marker = Marker {
            version: "0.11.3".into(),
            sha256: "cd".repeat(32),
        };
        paths.unpack(&gz(&dir, "ok.gz", b"old"), &marker).unwrap();
        let broken = dir.join("broken.gz");
        std::fs::write(&broken, b"not a gzip").unwrap();
        let next = Marker {
            version: "0.12.0".into(),
            sha256: "ef".repeat(32),
        };
        assert!(paths.unpack(&broken, &next).is_err());
        assert_eq!(paths.installed(), Some(marker));
        assert_eq!(std::fs::read(paths.binary()).unwrap(), b"old");
        assert!(!paths.binary().with_extension("unpack").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn staged_update_is_applied_only_when_its_hash_matches() {
        let dir = temp_dir("staged");
        let paths = ModulePaths::new(dir.clone());
        let old = Marker {
            version: "0.11.3".into(),
            sha256: "00".repeat(32),
        };
        paths.unpack(&gz(&dir, "old.gz", b"old"), &old).unwrap();

        let update = gz(&dir, "update.gz", b"new");
        let sha = sha256_file(&update).unwrap();
        let sha: &'static str = Box::leak(sha.into_boxed_str());
        let pin = Pin {
            sha256: sha,
            size: 1,
        };
        let next = Marker {
            version: "0.12.0".into(),
            sha256: sha.to_string(),
        };
        std::fs::write(paths.staged_marker(), serde_json::to_string(&next).unwrap()).unwrap();

        // Ждёт обновление другой сборки — не наше, не ставим.
        let other = Pin {
            sha256: Box::leak("11".repeat(32).into_boxed_str()),
            size: 1,
        };
        assert!(!paths.apply_staged(&other).unwrap());
        assert_eq!(std::fs::read(paths.binary()).unwrap(), b"old");

        assert!(paths.apply_staged(&pin).unwrap());
        assert_eq!(std::fs::read(paths.binary()).unwrap(), b"new");
        assert_eq!(paths.installed(), Some(next));
        assert!(!paths.staged().exists() && !paths.staged_marker().exists());

        // Архив подменили, пока лежал: не ставим и убираем.
        let update = gz(&dir, "update.gz", b"evil");
        assert!(update == paths.staged());
        std::fs::write(
            paths.staged_marker(),
            serde_json::to_string(&Marker {
                version: "0.12.1".into(),
                sha256: sha.to_string(),
            })
            .unwrap(),
        )
        .unwrap();
        assert!(!paths.apply_staged(&pin).unwrap());
        assert_eq!(std::fs::read(paths.binary()).unwrap(), b"new");
        assert!(!paths.staged().exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn leftovers_are_cleaned_but_the_module_stays() {
        let dir = temp_dir("leftovers");
        let paths = ModulePaths::new(dir.clone());
        let marker = Marker {
            version: "0.12.0".into(),
            sha256: "ab".repeat(32),
        };
        let archive = gz(&dir, "m.gz", b"mesh");
        paths.unpack(&archive, &marker).unwrap();
        std::fs::remove_file(archive).unwrap();
        for name in [
            "bastyon-mesh-linux-x86_64.gz",
            "bastyon-mesh-linux-x86_64.part",
            "x.unpack",
        ] {
            std::fs::write(dir.join(name), b"junk").unwrap();
        }
        paths.clean_leftovers();
        let mut left: Vec<String> = std::fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();
        left.sort();
        let binary = paths
            .binary()
            .file_name()
            .unwrap()
            .to_string_lossy()
            .to_string();
        assert_eq!(left, vec![binary, "install.json".to_string()]);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
