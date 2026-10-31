//! Схема `bastyon-offline://localhost/<id>/<файл>` (на Windows
//! `http://bastyon-offline.localhost/…`): плеер и картинки берут скачанное
//! по id, путей к файлам странице не видно, и область asset-протокола не
//! расширяется. Отвечает только главному окну: окна просмотра IPFS показывают
//! чужие сайты, им незачем знать, что скачано.
//!
//! Ролик отдаётся кусками по `Range` (не больше 1 МиБ за ответ, как у
//! asset-протокола Tauri): перемотка работает, а в память файл целиком не
//! читается.

use std::borrow::Cow;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

use http::{header, Request, Response, StatusCode};

use super::store;

pub const SCHEME: &str = "bastyon-offline";
/// Больше за один ответ не отдаём.
const MAX_LEN: u64 = 1024 * 1024;
/// Без `Range` целиком — только небольшие файлы (субтитры, обложка).
const WHOLE_MAX: u64 = 8 * 1024 * 1024;

fn mime(name: &str) -> &'static str {
    if name.ends_with(".mp4") {
        "video/mp4"
    } else if name.ends_with(".jpg") {
        "image/jpeg"
    } else if name.ends_with(".vtt") {
        "text/vtt; charset=utf-8"
    } else {
        "application/octet-stream"
    }
}

fn empty(status: StatusCode) -> Response<Cow<'static, [u8]>> {
    Response::builder()
        .status(status)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Cow::Borrowed(&[][..]))
        .unwrap_or_default()
}

/// `bytes=a-b`, `bytes=a-`, `bytes=-n` → (начало, конец включительно).
/// Несколько диапазонов — берём первый.
pub fn parse_range(value: &str, len: u64) -> Option<(u64, u64)> {
    if len == 0 {
        return None;
    }
    let spec = value.trim().strip_prefix("bytes=")?.split(',').next()?.trim();
    let (a, b) = spec.split_once('-')?;
    let (start, end) = if a.is_empty() {
        let suffix: u64 = b.trim().parse().ok()?;
        if suffix == 0 {
            return None;
        }
        (len.saturating_sub(suffix), len - 1)
    } else {
        let start: u64 = a.trim().parse().ok()?;
        let end = if b.trim().is_empty() {
            len - 1
        } else {
            b.trim().parse::<u64>().ok()?.min(len - 1)
        };
        (start, end)
    };
    (start <= end && start < len).then_some((start, end))
}

/// `/<id>/<имя>` из пути запроса (`convertFileSrc` кодирует `/` как `%2F`).
fn split_path(path: &str) -> Option<(String, String)> {
    let decoded = percent_encoding::percent_decode_str(path.trim_start_matches('/'))
        .decode_utf8()
        .ok()?
        .to_string();
    let (id, name) = decoded.split_once('/')?;
    let servable = name == store::VIDEO || store::valid_extra_name(name);
    (store::valid_id(id) && servable).then(|| (id.to_string(), name.to_string()))
}

/// Ответ на запрос к схеме по папке скачанного `root`.
pub fn respond(root: &Path, request: &Request<Vec<u8>>) -> Response<Cow<'static, [u8]>> {
    let Some((id, name)) = split_path(request.uri().path()) else {
        return empty(StatusCode::NOT_FOUND);
    };
    let path = store::item_dir(root, &id).join(&name);
    let Ok(mut file) = std::fs::File::open(&path) else {
        return empty(StatusCode::NOT_FOUND);
    };
    let Ok(len) = file.metadata().map(|m| m.len()) else {
        return empty(StatusCode::NOT_FOUND);
    };
    let range = request
        .headers()
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .map(|v| parse_range(v, len));
    let builder = Response::builder()
        .header(header::CONTENT_TYPE, mime(&name))
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_EXPOSE_HEADERS, "content-range, content-length")
        .header(header::CACHE_CONTROL, "no-store");
    let (start, end, partial) = match range {
        Some(None) => {
            return Response::builder()
                .status(StatusCode::RANGE_NOT_SATISFIABLE)
                .header(header::CONTENT_RANGE, format!("bytes */{len}"))
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(Cow::Borrowed(&[][..]))
                .unwrap_or_default();
        }
        Some(Some((start, end))) => (start, end, true),
        // Без Range большой файл всё равно отдаём кусками: целиком в памяти
        // ролик не держим.
        None if len > WHOLE_MAX => (0, len - 1, true),
        None => (0, len.saturating_sub(1), false),
    };
    let end = if partial { end.min(start + MAX_LEN - 1) } else { end };
    let count = if len == 0 { 0 } else { end + 1 - start };
    let mut body = Vec::with_capacity(count as usize);
    if file.seek(SeekFrom::Start(start)).is_err()
        || file.take(count).read_to_end(&mut body).is_err()
    {
        return empty(StatusCode::INTERNAL_SERVER_ERROR);
    }
    let builder = builder.header(header::CONTENT_LENGTH, body.len());
    let builder = if partial {
        builder
            .status(StatusCode::PARTIAL_CONTENT)
            .header(header::CONTENT_RANGE, format!("bytes {start}-{end}/{len}"))
    } else {
        builder.status(StatusCode::OK)
    };
    builder.body(Cow::Owned(body)).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(path: &str, range: Option<&str>) -> Request<Vec<u8>> {
        let mut b = Request::builder().uri(format!("bastyon-offline://localhost{path}"));
        if let Some(r) = range {
            b = b.header("Range", r);
        }
        b.body(Vec::new()).unwrap()
    }

    #[test]
    fn ranges() {
        assert_eq!(parse_range("bytes=0-1", 10), Some((0, 1)));
        assert_eq!(parse_range("bytes=5-", 10), Some((5, 9)));
        assert_eq!(parse_range("bytes=-3", 10), Some((7, 9)));
        assert_eq!(parse_range("bytes=8-100", 10), Some((8, 9)));
        assert_eq!(parse_range("bytes=10-", 10), None);
        assert_eq!(parse_range("bytes=3-2", 10), None);
        assert_eq!(parse_range("items=0-1", 10), None);
        assert_eq!(parse_range("bytes=0-1,4-5", 10), Some((0, 1)));
    }

    #[test]
    fn serves_ranges_and_only_known_files() {
        let root = std::env::temp_dir().join(format!("bastyon-offline-proto-{}", std::process::id()));
        let dir = root.join("abc-360");
        std::fs::create_dir_all(dir.join("captions")).unwrap();
        let video: Vec<u8> = (0..(WHOLE_MAX + MAX_LEN) as usize).map(|i| i as u8).collect();
        std::fs::write(dir.join("video.mp4"), &video).unwrap();
        std::fs::write(dir.join("captions/ru.vtt"), "WEBVTT").unwrap();
        std::fs::write(dir.join("meta.json"), "{}").unwrap();
        std::fs::write(dir.join("video.mp4.part"), "x").unwrap();

        let r = respond(&root, &request("/abc-360%2Fvideo.mp4", Some("bytes=10-19")));
        assert_eq!(r.status(), 206);
        assert_eq!(r.headers()["content-range"], format!("bytes 10-19/{}", video.len()));
        assert_eq!(&r.body()[..], &video[10..20]);

        // Открытый диапазон — не больше 1 МиБ.
        let r = respond(&root, &request("/abc-360/video.mp4", Some("bytes=0-")));
        assert_eq!(r.status(), 206);
        assert_eq!(r.body().len() as u64, MAX_LEN);

        // Без Range большой ролик — тоже кусок.
        let r = respond(&root, &request("/abc-360/video.mp4", None));
        assert_eq!(r.status(), 206);

        let r = respond(&root, &request("/abc-360/video.mp4", Some("bytes=999999999-")));
        assert_eq!(r.status(), 416);

        let r = respond(&root, &request("/abc-360%2Fcaptions%2Fru.vtt", None));
        assert_eq!(r.status(), 200);
        assert_eq!(&r.body()[..], b"WEBVTT");

        for path in [
            "/abc-360/meta.json",
            "/abc-360/video.mp4.part",
            "/abc-360/..%2F..%2Fetc%2Fpasswd",
            "/..%2Fabc-360/video.mp4",
            "/abc-360",
            "/other/video.mp4",
        ] {
            assert_eq!(respond(&root, &request(path, None)).status(), 404, "{path}");
        }
        std::fs::remove_dir_all(&root).unwrap();
    }
}
