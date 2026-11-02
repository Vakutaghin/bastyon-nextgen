//! Схема `bastyon-tor://localhost/<адрес>` (на Windows
//! `http://bastyon-tor.localhost/<адрес>`): картинки и обложки при включённом
//! Tor. Окно приложения ходит в сеть само, мимо Tor, поэтому удалённые
//! картинки ему запрещены (CSP, `tor-media-policy` во фронте). Вместо этого
//! страница просит картинку здесь, а Rust забирает её через Tor.
//!
//! Только GET, только из главного окна, только картинки и не больше 15 МБ.
//! Tor ещё не готов — 503: напрямую картинка не пойдёт (fail-closed).

use std::borrow::Cow;
use std::time::Duration;

use http::{header, Method, Request, Response, StatusCode};
use percent_encoding::percent_decode_str;
use tauri::Manager;

use super::{TorManager, TOR_NOT_READY};

pub const SCHEME: &str = "bastyon-tor";
const MAIN_WINDOW: &str = "main";
const MAX_BYTES: usize = 15 * 1024 * 1024;
const TIMEOUT: Duration = Duration::from_secs(60);

/// Адрес картинки из пути запроса: `/https%3A%2F%2F…` → `https://…`.
pub fn target_url(path: &str) -> Option<String> {
    let raw = path.trim_start_matches('/');
    let decoded = percent_decode_str(raw).decode_utf8().ok()?;
    let parsed = url::Url::parse(&decoded).ok()?;
    matches!(parsed.scheme(), "http" | "https").then(|| parsed.to_string())
}

/// Что отдаём, если ответ не картинка: сайт вместо картинки прислал страницу
/// (заглушку провайдера, ошибку) — окну её показывать незачем.
pub fn is_image(content_type: &str) -> bool {
    let mime = content_type.split(';').next().unwrap_or("").trim().to_ascii_lowercase();
    mime.starts_with("image/") || mime == "application/octet-stream" || mime.is_empty()
}

fn empty(status: StatusCode) -> Response<Cow<'static, [u8]>> {
    Response::builder()
        .status(status)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Cow::Borrowed(&[][..]))
        .unwrap_or_default()
}

async fn respond(mgr: TorManager, url: String) -> Response<Cow<'static, [u8]>> {
    match mgr.fetch_media(&url, MAX_BYTES, TIMEOUT).await {
        Ok(media) if (200..300).contains(&media.status) && is_image(&media.content_type) => {
            let mut builder = Response::builder()
                .status(StatusCode::OK)
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                // Картинки по адресу не меняются: повторно через Tor не ходим.
                .header(header::CACHE_CONTROL, "max-age=86400");
            if !media.content_type.is_empty() {
                builder = builder.header(header::CONTENT_TYPE, media.content_type);
            }
            builder.body(Cow::Owned(media.body)).unwrap_or_default()
        }
        Ok(media) if (200..300).contains(&media.status) => empty(StatusCode::UNSUPPORTED_MEDIA_TYPE),
        Ok(media) => empty(StatusCode::from_u16(media.status).unwrap_or(StatusCode::BAD_GATEWAY)),
        Err(e) if e.starts_with(TOR_NOT_READY) => empty(StatusCode::SERVICE_UNAVAILABLE),
        Err(e) => {
            log::debug!("[tor] media {}: {}", url, e);
            empty(StatusCode::BAD_GATEWAY)
        }
    }
}

pub fn handle_protocol<R: tauri::Runtime>(
    ctx: tauri::UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: tauri::UriSchemeResponder,
) {
    if ctx.webview_label() != MAIN_WINDOW {
        responder.respond(empty(StatusCode::FORBIDDEN));
        return;
    }
    if request.method() != Method::GET {
        responder.respond(empty(StatusCode::METHOD_NOT_ALLOWED));
        return;
    }
    let Some(url) = target_url(request.uri().path()) else {
        responder.respond(empty(StatusCode::BAD_REQUEST));
        return;
    };
    let Some(mgr) = ctx.app_handle().try_state::<TorManager>() else {
        responder.respond(empty(StatusCode::SERVICE_UNAVAILABLE));
        return;
    };
    let mgr = mgr.inner().clone();
    tauri::async_runtime::spawn(async move {
        responder.respond(respond(mgr, url).await);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn target_url_is_the_encoded_remote_address() {
        assert_eq!(
            target_url("/https%3A%2F%2Fpocketnet.app%3A8092%2Fi%2Fa.jpg%3Fs%3D1").as_deref(),
            Some("https://pocketnet.app:8092/i/a.jpg?s=1")
        );
        assert_eq!(target_url("/file%3A%2F%2F%2Fetc%2Fpasswd"), None);
        assert_eq!(target_url("/not%20a%20url"), None);
    }

    #[test]
    fn only_images_reach_the_window() {
        assert!(is_image("image/jpeg"));
        assert!(is_image("Image/WebP; charset=binary"));
        assert!(is_image(""));
        assert!(!is_image("text/html; charset=utf-8"));
    }
}
