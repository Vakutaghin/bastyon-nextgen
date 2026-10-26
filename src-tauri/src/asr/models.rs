//! Модели голосового ввода: распознавание (whisper.cpp, формат ggml) и
//! детектор речи Silero. Скачиваются по требованию в данные приложения.
//!
//! Файлы берутся с Hugging Face по ЗАКРЕПЛЁННОЙ ревизии, а SHA-256 и размер
//! запинены здесь: подменённый или обрезанный файл не будет принят (`fetch`).

use std::path::{Path, PathBuf};
use tokio::sync::watch;

use crate::fetch::{fetch_pinned, FetchError, Pinned};

pub struct ModelSpec {
    /// Идентификатор, которым пользуется интерфейс.
    pub id: &'static str,
    pub file: &'static str,
    pub sha256: &'static str,
    pub size: u64,
    base_url: &'static str,
}

impl ModelSpec {
    pub fn url(&self) -> String {
        format!("{}/{}", self.base_url, self.file)
    }
}

const WHISPER_REPO: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1";
const VAD_REPO: &str =
    "https://huggingface.co/ggml-org/whisper-vad/resolve/9ffd54a1e1ee413ddf265af9913beaf518d1639b";

/// Модели распознавания: многоязычные, квантованные. «small» — по умолчанию:
/// на естественной русской речи сам расставляет точки и запятые, а на
/// процессоре распознаёт быстрее, чем человек говорит.
pub const MODELS: &[ModelSpec] = &[
    ModelSpec {
        id: "base",
        file: "ggml-base-q5_1.bin",
        sha256: "422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898",
        size: 59_707_625,
        base_url: WHISPER_REPO,
    },
    ModelSpec {
        id: "small",
        file: "ggml-small-q5_1.bin",
        sha256: "ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb",
        size: 190_085_487,
        base_url: WHISPER_REPO,
    },
    ModelSpec {
        id: "turbo",
        file: "ggml-large-v3-turbo-q5_0.bin",
        sha256: "394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2",
        size: 574_041_195,
        base_url: WHISPER_REPO,
    },
];

/// Детектор речи Silero: режет запись на фразы по паузам и не пускает в
/// распознавание тишину и шум — на них whisper сочиняет «Редактор субтитров…».
pub const VAD_MODEL: ModelSpec = ModelSpec {
    id: "vad",
    file: "ggml-silero-v6.2.0.bin",
    sha256: "2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987",
    size: 885_098,
    base_url: VAD_REPO,
};

pub fn model_spec(id: &str) -> Option<&'static ModelSpec> {
    MODELS.iter().find(|m| m.id == id)
}

#[derive(Clone)]
pub struct AsrPaths {
    pub dir: PathBuf,
}

impl AsrPaths {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir }
    }

    pub fn file(&self, spec: &ModelSpec) -> PathBuf {
        self.dir.join(spec.file)
    }

    /// Файл лежит и совпадает по размеру: хэш проверен при скачивании, а
    /// размер ловит файл, обрезанный уже на диске.
    pub fn is_installed(&self, spec: &ModelSpec) -> bool {
        std::fs::metadata(self.file(spec))
            .map(|m| m.is_file() && m.len() == spec.size)
            .unwrap_or(false)
    }

    /// Установленные модели распознавания (без детектора речи — он идёт
    /// вместе с любой из них).
    pub fn installed_models(&self) -> Vec<&'static str> {
        if !self.is_installed(&VAD_MODEL) {
            return Vec::new();
        }
        MODELS
            .iter()
            .filter(|m| self.is_installed(m))
            .map(|m| m.id)
            .collect()
    }

    /// Какие модели человек скачал. Приложение может закрепить другой файл
    /// модели (новая ревизия, формат для нового whisper.cpp) — тогда по этому
    /// списку она скачается снова сама.
    fn wanted_file(&self) -> PathBuf {
        self.dir.join("models.json")
    }

    pub fn wanted(&self) -> Vec<String> {
        std::fs::read_to_string(self.wanted_file())
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default()
    }

    fn write_wanted(&self, ids: &[String]) -> std::io::Result<()> {
        std::fs::write(self.wanted_file(), serde_json::to_string(ids)?)
    }

    pub fn remember(&self, id: &str) -> std::io::Result<()> {
        let mut ids = self.wanted();
        if ids.iter().any(|w| w == id) {
            return Ok(());
        }
        ids.push(id.to_string());
        self.write_wanted(&ids)
    }

    pub fn forget(&self, id: &str) -> std::io::Result<()> {
        let mut ids = self.wanted();
        ids.retain(|w| w != id);
        self.write_wanted(&ids)
    }

    /// Списка ещё нет — модели скачаны до него: это те, что стоят сейчас.
    pub fn init_wanted(&self) -> std::io::Result<()> {
        if self.wanted_file().exists() {
            return Ok(());
        }
        let ids: Vec<String> = self.installed_models().iter().map(|id| id.to_string()).collect();
        if ids.is_empty() {
            return Ok(());
        }
        self.write_wanted(&ids)
    }

    /// Скачанные человеком модели, которых сейчас нет: сменился закреплённый
    /// файл модели или детектора речи.
    pub fn outdated(&self) -> Vec<&'static str> {
        let installed = self.installed_models();
        self.wanted()
            .iter()
            .filter_map(|id| model_spec(id))
            .map(|m| m.id)
            .filter(|id| !installed.contains(id))
            .collect()
    }

    /// Файлы моделей, которых нет среди закреплённых, — прежние версии: ими
    /// приложение больше не пользуется.
    pub fn remove_orphans(&self) {
        let Ok(entries) = std::fs::read_dir(&self.dir) else {
            return;
        };
        let known: Vec<&str> = MODELS.iter().chain([&VAD_MODEL]).map(|m| m.file).collect();
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("ggml-") && name.ends_with(".bin") && !known.contains(&name.as_str()) {
                log::info!("[asr] removing {name}: no longer pinned");
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
}

/// Скачать файл модели с проверкой размера и SHA-256. `on_progress` получает
/// (скачано, всего) по мере прихода данных.
pub async fn download(
    client: &reqwest::Client,
    spec: &ModelSpec,
    dest: &Path,
    cancel: &mut watch::Receiver<bool>,
    on_progress: impl FnMut(u64, u64),
) -> Result<(), FetchError> {
    let pin = Pinned { name: spec.file, sha256: spec.sha256, size: spec.size };
    fetch_pinned(client, &spec.url(), &pin, dest, cancel, on_progress).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_table_is_consistent() {
        let mut ids: Vec<_> = MODELS.iter().map(|m| m.id).collect();
        ids.dedup();
        assert_eq!(ids.len(), MODELS.len());
        for m in MODELS.iter().chain(std::iter::once(&VAD_MODEL)) {
            assert_eq!(m.sha256.len(), 64, "{}", m.id);
            assert!(m.sha256.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()));
            assert!(m.url().starts_with("https://huggingface.co/"));
            assert!(m.url().ends_with(m.file));
            // Ссылка — на закреплённую ревизию, не на ветку main.
            assert!(!m.url().contains("/resolve/main/"));
        }
        assert!(model_spec("small").is_some());
        assert!(model_spec("vad").is_none());
    }

    #[test]
    fn installed_needs_matching_size_and_the_vad() {
        let dir = std::env::temp_dir().join(format!("asr-models-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let paths = AsrPaths::new(dir.clone());
        let base = model_spec("base").unwrap();
        std::fs::write(paths.file(base), b"short").unwrap();
        assert!(!paths.is_installed(base));
        // Без детектора речи модель распознавания не считается установленной.
        let f = std::fs::File::create(paths.file(base)).unwrap();
        f.set_len(base.size).unwrap();
        assert!(paths.installed_models().is_empty());
        let v = std::fs::File::create(paths.file(&VAD_MODEL)).unwrap();
        v.set_len(VAD_MODEL.size).unwrap();
        assert_eq!(paths.installed_models(), vec!["base"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_wanted_model_whose_file_changed_is_outdated() {
        let dir = std::env::temp_dir().join(format!("asr-wanted-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let paths = AsrPaths::new(dir.clone());
        let base = model_spec("base").unwrap();
        for spec in [base, &VAD_MODEL] {
            std::fs::File::create(paths.file(spec)).unwrap().set_len(spec.size).unwrap();
        }

        // Скачано до списка: список — то, что стоит.
        paths.init_wanted().unwrap();
        assert_eq!(paths.wanted(), vec!["base"]);
        assert!(paths.outdated().is_empty());

        // Закреплён другой файл: прежний не той длины — модель надо скачать.
        std::fs::File::create(paths.file(base)).unwrap().set_len(base.size - 1).unwrap();
        assert_eq!(paths.outdated(), vec!["base"]);

        // Сменился детектор речи — тоже.
        std::fs::File::create(paths.file(base)).unwrap().set_len(base.size).unwrap();
        std::fs::remove_file(paths.file(&VAD_MODEL)).unwrap();
        assert_eq!(paths.outdated(), vec!["base"]);

        // Удалённую человеком модель обратно не качаем.
        paths.forget("base").unwrap();
        assert!(paths.outdated().is_empty());
        paths.init_wanted().unwrap();
        assert!(paths.wanted().is_empty(), "список уже есть — не пересобирается");
        paths.remember("small").unwrap();
        paths.remember("small").unwrap();
        assert_eq!(paths.wanted(), vec!["small"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn files_of_models_no_longer_pinned_are_removed() {
        let dir = std::env::temp_dir().join(format!("asr-orphans-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let paths = AsrPaths::new(dir.clone());
        let base = model_spec("base").unwrap();
        for name in [base.file, VAD_MODEL.file, "ggml-small-q5_0.bin", "models.json", "notes.bin"] {
            std::fs::write(dir.join(name), b"x").unwrap();
        }
        paths.remove_orphans();
        assert!(!dir.join("ggml-small-q5_0.bin").exists());
        for kept in [base.file, VAD_MODEL.file, "models.json", "notes.bin"] {
            assert!(dir.join(kept).exists(), "{kept}");
        }
        let _ = std::fs::remove_dir_all(&dir);
    }
}
