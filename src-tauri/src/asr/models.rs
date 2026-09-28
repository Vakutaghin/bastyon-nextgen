//! Модели голосового ввода: распознавание (whisper.cpp, формат ggml) и
//! детектор речи Silero. Скачиваются по требованию в данные приложения.
//!
//! Файлы берутся с Hugging Face по ЗАКРЕПЛЁННОЙ ревизии, а SHA-256 и размер
//! запинены здесь: подменённый или обрезанный файл не будет принят. Скачивание
//! идёт в `<файл>.part` и переименовывается только после проверки — модели,
//! которую нельзя загрузить, на диске не остаётся.

use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::sync::watch;

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
}

#[derive(Debug, thiserror::Error)]
pub enum DownloadError {
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

/// Скачать файл модели с проверкой размера и SHA-256. `on_progress` получает
/// (скачано, всего) по мере прихода данных.
pub async fn download(
    client: &reqwest::Client,
    spec: &ModelSpec,
    dest: &Path,
    cancel: &mut watch::Receiver<bool>,
    mut on_progress: impl FnMut(u64, u64),
) -> Result<(), DownloadError> {
    if let Some(dir) = dest.parent() {
        tokio::fs::create_dir_all(dir).await?;
    }
    let part = dest.with_extension("part");
    let result = download_to(client, spec, &part, cancel, &mut on_progress).await;
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

async fn download_to(
    client: &reqwest::Client,
    spec: &ModelSpec,
    part: &Path,
    cancel: &mut watch::Receiver<bool>,
    on_progress: &mut impl FnMut(u64, u64),
) -> Result<(), DownloadError> {
    let response = client
        .get(spec.url())
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| DownloadError::Http(e.to_string()))?;
    let mut file = tokio::fs::File::create(part).await?;
    let mut hasher = Sha256::new();
    let mut received: u64 = 0;
    let mut stream = response.bytes_stream();
    on_progress(0, spec.size);
    loop {
        let next = tokio::select! {
            _ = cancel.changed() => {
                if *cancel.borrow() { return Err(DownloadError::Cancelled) }
                continue;
            }
            chunk = tokio::time::timeout(STALL_TIMEOUT, stream.next()) => chunk,
        };
        let chunk = match next {
            Err(_) => return Err(DownloadError::Http("stalled".into())),
            Ok(None) => break,
            Ok(Some(Err(e))) => return Err(DownloadError::Http(e.to_string())),
            Ok(Some(Ok(chunk))) => chunk,
        };
        received += chunk.len() as u64;
        if received > spec.size {
            return Err(DownloadError::SizeMismatch(spec.file.into()));
        }
        hasher.update(&chunk);
        file.write_all(&chunk).await?;
        on_progress(received, spec.size);
    }
    file.flush().await?;
    drop(file);
    if received != spec.size {
        return Err(DownloadError::SizeMismatch(spec.file.into()));
    }
    let actual = hex::encode(hasher.finalize());
    if actual != spec.sha256 {
        return Err(DownloadError::HashMismatch(spec.file.into()));
    }
    Ok(())
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
}
