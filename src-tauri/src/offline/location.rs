//! Где лежит скачанное: стандартная папка (`app_local_data_dir/offline`) или
//! своя — например, на другом диске. Выбор пишется в `offline-location.json`
//! рядом со стандартной папкой. В выбранной папке ролики лежат в подпапке
//! `Bastyon offline`: со своими файлами человека не смешиваются, и «Удалить
//! всё» трогает только её.
//!
//! Перенос осторожный: на том же диске папки ролика переименовываются, на
//! другом — копируются целиком, и только когда на новом месте всё, старые
//! копии удаляются. Сбой посередине возвращает всё как было.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub const CONFIG: &str = "offline-location.json";
pub const SUBDIR: &str = "Bastyon offline";
/// Сверх размера скачанного должно оставаться свободным на новом диске.
const SPARE: u64 = 200 * 1024 * 1024;
/// Папка ролика на время копирования: без `meta.json` в списке её не видно,
/// но имя всё равно другое, чтобы недокопированное не путалось с роликом.
const COPYING: &str = ".moving";

#[derive(Serialize, Deserialize, Default)]
struct Config {
    path: Option<PathBuf>,
}

/// Своя папка из настройки; `None` — стандартная.
pub fn read_config(base: &Path) -> Option<PathBuf> {
    let raw = fs::read(base.join(CONFIG)).ok()?;
    serde_json::from_slice::<Config>(&raw).ok()?.path
}

pub fn write_config(base: &Path, path: Option<&Path>) -> io::Result<()> {
    let config = Config {
        path: path.map(Path::to_path_buf),
    };
    let raw = serde_json::to_vec_pretty(&config).map_err(io::Error::other)?;
    fs::create_dir_all(base)?;
    let tmp = base.join(format!("{CONFIG}.tmp"));
    fs::write(&tmp, raw)?;
    fs::rename(tmp, base.join(CONFIG))
}

/// Папка при запуске и выбранная, но недоступная: своя — если она на месте
/// (диск подключён), иначе стандартная. Свою не создаём: на отключённом диске
/// это была бы папка на точке монтирования.
pub fn resolve(default: &Path, configured: Option<PathBuf>) -> (PathBuf, Option<PathBuf>) {
    match configured {
        Some(path) if path.is_dir() => (path, None),
        Some(path) => (default.to_path_buf(), Some(path)),
        None => (default.to_path_buf(), None),
    }
}

/// Можно ли переносить сюда: не внутрь нынешней папки и запись проходит.
pub fn check_target(current: &Path, target: &Path) -> Result<(), String> {
    if target.starts_with(current) {
        return Err("inside_current".into());
    }
    fs::create_dir_all(target).map_err(|_| "not_writable".to_string())?;
    let probe = target.join(".bastyon-write-test");
    fs::write(&probe, b"ok").map_err(|_| "not_writable".to_string())?;
    let _ = fs::remove_file(probe);
    Ok(())
}

/// Один ли это диск: тогда перенос — переименование, места не нужно.
#[cfg(unix)]
pub fn same_device(a: &Path, b: &Path) -> bool {
    use std::os::unix::fs::MetadataExt;
    match (fs::metadata(a), fs::metadata(b)) {
        (Ok(x), Ok(y)) => x.dev() == y.dev(),
        _ => false,
    }
}

#[cfg(windows)]
pub fn same_device(a: &Path, b: &Path) -> bool {
    let root = |p: &Path| p.components().next().map(|c| c.as_os_str().to_ascii_lowercase());
    root(a).is_some() && root(a) == root(b)
}

#[cfg(not(any(unix, windows)))]
pub fn same_device(_a: &Path, _b: &Path) -> bool {
    false
}

/// Хватит ли места на другом диске под `used` байт.
pub fn enough_space(used: u64, free: Option<u64>) -> bool {
    free.is_none_or(|f| f >= used.saturating_add(SPARE))
}

fn copy_dir(from: &Path, to: &Path) -> io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}

fn error_code(e: &io::Error) -> String {
    if super::space::is_disk_full(e) {
        "no_space".into()
    } else {
        "io".into()
    }
}

/// Перенести папки роликов `ids` из `from` в `to`. `progress(готово, всего)`
/// после каждой. Ошибка — всё возвращается как было и код: `target_busy`
/// (в новой папке уже есть такой ролик), `no_space`, `io`.
pub fn move_items(
    from: &Path,
    to: &Path,
    ids: &[String],
    mut progress: impl FnMut(usize, usize),
) -> Result<(), String> {
    fs::create_dir_all(to).map_err(|e| error_code(&e))?;
    let mut renamed: Vec<&str> = Vec::new();
    let mut copied: Vec<&str> = Vec::new();
    let rollback = |renamed: &[&str], copied: &[&str]| {
        for id in renamed {
            let _ = fs::rename(to.join(id), from.join(id));
        }
        for id in copied {
            let _ = fs::remove_dir_all(to.join(id));
        }
    };
    for (i, id) in ids.iter().enumerate() {
        let src = from.join(id);
        let dst = to.join(id);
        if dst.exists() {
            rollback(&renamed, &copied);
            return Err("target_busy".into());
        }
        if fs::rename(&src, &dst).is_ok() {
            renamed.push(id);
        } else {
            let tmp = to.join(format!("{id}{COPYING}"));
            let _ = fs::remove_dir_all(&tmp);
            if let Err(e) = copy_dir(&src, &tmp).and_then(|()| fs::rename(&tmp, &dst)) {
                let _ = fs::remove_dir_all(&tmp);
                rollback(&renamed, &copied);
                return Err(error_code(&e));
            }
            copied.push(id);
        }
        progress(i + 1, ids.len());
    }
    // Всё на новом месте — старые копии больше не нужны.
    for id in copied {
        let _ = fs::remove_dir_all(from.join(id));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("bastyon-offline-loc-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn video(root: &Path, id: &str) {
        let dir = root.join(id);
        fs::create_dir_all(dir.join("captions")).unwrap();
        fs::write(dir.join("video.mp4"), id.as_bytes()).unwrap();
        fs::write(dir.join("captions/ru.vtt"), b"WEBVTT").unwrap();
        fs::write(dir.join("meta.json"), b"{}").unwrap();
    }

    #[test]
    fn config_round_trip_and_unplugged_disk_falls_back() {
        let base = temp("config");
        assert_eq!(read_config(&base), None);
        let custom = base.join("custom");
        write_config(&base, Some(&custom)).unwrap();
        assert_eq!(read_config(&base), Some(custom.clone()));

        let default = base.join("offline");
        // Диск не подключён — стандартная, выбранная помечена недоступной.
        assert_eq!(resolve(&default, Some(custom.clone())), (default.clone(), Some(custom.clone())));
        fs::create_dir_all(&custom).unwrap();
        assert_eq!(resolve(&default, Some(custom.clone())), (custom, None));
        write_config(&base, None).unwrap();
        assert_eq!(resolve(&default, read_config(&base)), (default, None));
        let _ = fs::remove_dir_all(base);
    }

    #[test]
    fn moves_every_file_and_leaves_nothing_behind() {
        let base = temp("move");
        let (from, to) = (base.join("a"), base.join("b"));
        video(&from, "v1-360");
        video(&from, "v2-144");
        let mut steps = Vec::new();
        let ids = vec!["v1-360".to_string(), "v2-144".to_string()];
        move_items(&from, &to, &ids, |done, total| steps.push((done, total))).unwrap();
        assert_eq!(steps, vec![(1, 2), (2, 2)]);
        assert_eq!(fs::read(to.join("v1-360/video.mp4")).unwrap(), b"v1-360");
        assert_eq!(fs::read(to.join("v2-144/captions/ru.vtt")).unwrap(), b"WEBVTT");
        assert!(!from.join("v1-360").exists() && !from.join("v2-144").exists());
        let _ = fs::remove_dir_all(base);
    }

    #[test]
    fn collision_rolls_everything_back() {
        let base = temp("rollback");
        let (from, to) = (base.join("a"), base.join("b"));
        video(&from, "v1-360");
        video(&from, "v2-144");
        // Во второй папке уже лежит такой же ролик — переносить нельзя.
        video(&to, "v2-144");
        let ids = vec!["v1-360".to_string(), "v2-144".to_string()];
        assert_eq!(move_items(&from, &to, &ids, |_, _| {}), Err("target_busy".to_string()));
        assert_eq!(fs::read(from.join("v1-360/video.mp4")).unwrap(), b"v1-360");
        assert!(!to.join("v1-360").exists());
        assert!(from.join("v2-144/meta.json").is_file());
        let _ = fs::remove_dir_all(base);
    }

    #[test]
    fn copy_fallback_copies_nested_dirs() {
        let base = temp("copy");
        video(&base.join("a"), "v1-360");
        copy_dir(&base.join("a/v1-360"), &base.join("b/v1-360")).unwrap();
        assert_eq!(fs::read(base.join("b/v1-360/captions/ru.vtt")).unwrap(), b"WEBVTT");
        let _ = fs::remove_dir_all(base);
    }

    #[test]
    fn target_checks() {
        let base = temp("target");
        let current = base.join("offline");
        fs::create_dir_all(&current).unwrap();
        assert_eq!(check_target(&current, &current.join("inner")), Err("inside_current".to_string()));
        assert_eq!(check_target(&current, &base.join("other")), Ok(()));
        assert!(!base.join("other/.bastyon-write-test").exists());
        assert!(same_device(&current, &base.join("other")));
        assert!(enough_space(10, None));
        assert!(enough_space(10, Some(10 + SPARE)));
        assert!(!enough_space(10, Some(10 + SPARE - 1)));
        let _ = fs::remove_dir_all(base);
    }
}
