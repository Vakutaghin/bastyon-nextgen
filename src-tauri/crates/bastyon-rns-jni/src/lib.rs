//! JNI для узла Reticulum на Android: класс
//! `com.bastyon.app.plugins.radio.RnsNative`. Настройки и ответы — JSON в тех
//! же camelCase, что у команд `rns_*` десктопа; события узла — JSON в
//! `RnsNative.Events.onEvent` из потоков узла. Ошибка — RuntimeException с
//! сообщением «код: подробности», как у десктопа.
//!
//! Узел один на процесс. Долгие вызовы (start, stop, page) Java делает не из
//! главного потока.

use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};

use bastyon_rns::node::{self, Handle, Runtime};
use bastyon_rns::types::{parse_hash, Attachment, Download, Method, RnsEvent, StartOptions};
use jni::objects::{GlobalRef, JClass, JObject, JString, JValue};
use jni::sys::jstring;
use jni::{JNIEnv, JavaVM};

static NODE: Mutex<Option<Runtime>> = Mutex::new(None);

fn node_slot() -> MutexGuard<'static, Option<Runtime>> {
    NODE.lock().unwrap_or_else(|p| p.into_inner())
}

fn with_node<T>(run: impl FnOnce(&Runtime) -> Result<T, String>) -> Result<T, String> {
    match node_slot().as_ref() {
        Some(node) => run(node),
        None => Err("rns_not_running".into()),
    }
}

fn text(env: &mut JNIEnv, s: &JString) -> Result<String, String> {
    if s.is_null() {
        return Ok(String::new());
    }
    env.get_string(s)
        .map(Into::into)
        .map_err(|e| format!("rns_error: {e}"))
}

fn json<T: serde::Serialize>(value: &T) -> Result<String, String> {
    serde_json::to_string(value).map_err(|e| format!("rns_error: {e}"))
}

/// Ответ в Java: строка или исключение (тогда возвращается null).
fn respond(env: &mut JNIEnv, result: Result<String, String>) -> jstring {
    match result.and_then(|s| env.new_string(s).map_err(|e| format!("rns_error: {e}"))) {
        Ok(s) => s.into_raw(),
        Err(e) => {
            let _ = env.throw_new("java/lang/RuntimeException", e);
            std::ptr::null_mut()
        }
    }
}

/// Событие узла — в `Events.onEvent(String)`. Потоки узла подключаются к
/// JVM один раз и навсегда (daemon), чтобы не цеплять их на каждое событие.
fn deliver(vm: &JavaVM, sink: &GlobalRef, ev: &RnsEvent) {
    let Ok(payload) = serde_json::to_string(ev) else { return };
    let Ok(mut env) = vm.attach_current_thread_as_daemon() else { return };
    let Ok(s) = env.new_string(payload) else { return };
    let _ = env.call_method(sink.as_obj(), "onEvent", "(Ljava/lang/String;)V", &[JValue::Object(&s)]);
    if env.exception_check().unwrap_or(false) {
        let _ = env.exception_clear();
    }
    let _ = env.delete_local_ref(s);
}

fn init_logging() {
    #[cfg(target_os = "android")]
    android_logger::init_once(
        android_logger::Config::default()
            .with_max_level(log::LevelFilter::Info)
            .with_tag("bastyon-rns"),
    );
}

#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_radio_RnsNative_start<'l>(
    mut env: JNIEnv<'l>,
    _class: JClass<'l>,
    options: JString<'l>,
    base_dir: JString<'l>,
    events: JObject<'l>,
) -> jstring {
    init_logging();
    let result = (|| {
        let options: StartOptions = serde_json::from_str(&text(&mut env, &options)?)
            .map_err(|e| format!("rns_error: {e}"))?;
        let base = PathBuf::from(text(&mut env, &base_dir)?);
        let vm = env.get_java_vm().map_err(|e| format!("rns_error: {e}"))?;
        let sink = env
            .new_global_ref(events)
            .map_err(|e| format!("rns_error: {e}"))?;
        // Прежний узел (другой аккаунт, новые настройки) — остановить до
        // нового: те же порты LAN и тот же RNode.
        let old = node_slot().take();
        if let Some(old) = old {
            old.stop();
        }
        let dir = base.join(node::identity_hash(&options.identity)?);
        let runtime = Runtime::start(options, dir, move |ev| deliver(&vm, &sink, &ev))?;
        let started = json(&runtime.started())?;
        *node_slot() = Some(runtime);
        Ok(started)
    })();
    respond(&mut env, result)
}

#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_radio_RnsNative_stop<'l>(
    _env: JNIEnv<'l>,
    _class: JClass<'l>,
) {
    let node = node_slot().take();
    if let Some(node) = node {
        node.stop();
    }
}

#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_radio_RnsNative_status<'l>(
    mut env: JNIEnv<'l>,
    _class: JClass<'l>,
) -> jstring {
    let result = match node_slot().as_ref() {
        Some(node) => json(&node.status()),
        None => Ok(r#"{"running":false,"interfaces":[],"paths":0,"propagationNode":null}"#.into()),
    };
    respond(&mut env, result)
}

#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_radio_RnsNative_announce<'l>(
    mut env: JNIEnv<'l>,
    _class: JClass<'l>,
) -> jstring {
    let result = with_node(|n| n.announce()).map(|()| String::new());
    respond(&mut env, result)
}

#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_radio_RnsNative_send<'l>(
    mut env: JNIEnv<'l>,
    _class: JClass<'l>,
    to: JString<'l>,
    title: JString<'l>,
    content: JString<'l>,
    method: JString<'l>,
    attachments: JString<'l>,
) -> jstring {
    let result = (|| {
        let dest = parse_hash::<16>(&text(&mut env, &to)?)?;
        let title = text(&mut env, &title)?;
        let content = text(&mut env, &content)?;
        let method: Method = serde_json::from_value(serde_json::Value::String(text(&mut env, &method)?))
            .map_err(|e| format!("rns_error: {e}"))?;
        let raw = text(&mut env, &attachments)?;
        let attachments: Vec<Attachment> = if raw.is_empty() {
            Vec::new()
        } else {
            serde_json::from_str(&raw).map_err(|e| format!("rns_error: {e}"))?
        };
        with_node(|n| n.send(dest, &title, &content, &attachments, method))
    })();
    respond(&mut env, result)
}

#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_radio_RnsNative_requestPath<'l>(
    mut env: JNIEnv<'l>,
    _class: JClass<'l>,
    to: JString<'l>,
) -> jstring {
    let result = (|| {
        let dest = parse_hash::<16>(&text(&mut env, &to)?)?;
        with_node(|n| n.request_path(dest)).map(|()| String::new())
    })();
    respond(&mut env, result)
}

#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_radio_RnsNative_setPropagationNode<'l>(
    mut env: JNIEnv<'l>,
    _class: JClass<'l>,
    hash: JString<'l>,
) -> jstring {
    let result = (|| {
        let raw = text(&mut env, &hash)?;
        let node_hash = if raw.is_empty() { None } else { Some(parse_hash::<16>(&raw)?) };
        with_node(|n| n.set_propagation_node(node_hash)).map(|()| String::new())
    })();
    respond(&mut env, result)
}

#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_radio_RnsNative_sync<'l>(
    mut env: JNIEnv<'l>,
    _class: JClass<'l>,
) -> jstring {
    let result = with_node(|n| n.sync()).map(|()| String::new());
    respond(&mut env, result)
}

/// Бумажное сообщение адресату: ссылка `lxm://`.
#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_radio_RnsNative_paper<'l>(
    mut env: JNIEnv<'l>,
    _class: JClass<'l>,
    to: JString<'l>,
    content: JString<'l>,
) -> jstring {
    let result = (|| {
        let dest = parse_hash::<16>(&text(&mut env, &to)?)?;
        let content = text(&mut env, &content)?;
        with_node(|n| n.paper(dest, &content))
    })();
    respond(&mut env, result)
}

/// Открыть бумажное сообщение: придёт событием `message`.
#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_radio_RnsNative_ingest<'l>(
    mut env: JNIEnv<'l>,
    _class: JClass<'l>,
    uri: JString<'l>,
) -> jstring {
    let result = (|| {
        let uri = text(&mut env, &uri)?;
        with_node(|n| n.ingest(&uri)).map(|()| String::new())
    })();
    respond(&mut env, result)
}

/// Страница NomadNet; блокирует до ответа узла (десятки секунд по радио).
#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_radio_RnsNative_page<'l>(
    mut env: JNIEnv<'l>,
    _class: JClass<'l>,
    node_hash: JString<'l>,
    path: JString<'l>,
    data: JString<'l>,
) -> jstring {
    let result = (|| {
        let dest = parse_hash::<16>(&text(&mut env, &node_hash)?)?;
        let path = text(&mut env, &path)?;
        let raw = text(&mut env, &data)?;
        let data: std::collections::HashMap<String, String> = if raw.is_empty() {
            Default::default()
        } else {
            serde_json::from_str(&raw).map_err(|e| format!("rns_error: {e}"))?
        };
        // Не держать узел заблокированным, пока ждём страницу.
        let handle: Handle = with_node(|n| Ok(n.handle()))?;
        json(&handle.page(dest, &path, &data)?)
    })();
    respond(&mut env, result)
}

/// Файл узла NomadNet. Ответ — `{kind: "file", name, path, size}`: байты во
/// временном файле в `dir`, Java отдаёт его в выбранное пользователем место и
/// удаляет; или `{kind: "page", content, binary}`, если узел ответил страницей.
#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_radio_RnsNative_download<'l>(
    mut env: JNIEnv<'l>,
    _class: JClass<'l>,
    node_hash: JString<'l>,
    path: JString<'l>,
    dir: JString<'l>,
) -> jstring {
    let result = (|| {
        let dest = parse_hash::<16>(&text(&mut env, &node_hash)?)?;
        let path = text(&mut env, &path)?;
        let dir = PathBuf::from(text(&mut env, &dir)?);
        let handle: Handle = with_node(|n| Ok(n.handle()))?;
        match handle.download(dest, &path)? {
            Download::Page(page) => json(&serde_json::json!({
                "kind": "page",
                "content": page.content,
                "binary": page.binary,
            })),
            Download::File { name, data } => {
                std::fs::create_dir_all(&dir).map_err(|e| format!("rns_error: {e}"))?;
                // Скачивания идут по одному — временный файл один.
                let temp = dir.join("nomadnet-download");
                std::fs::write(&temp, &data).map_err(|e| format!("rns_error: {e}"))?;
                json(&serde_json::json!({
                    "kind": "file",
                    "name": name,
                    "path": temp.to_string_lossy(),
                    "size": data.len(),
                }))
            }
        }
    })();
    respond(&mut env, result)
}

/// Обзор сети: JSON-массив путей (`PathInfo`).
#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_radio_RnsNative_paths<'l>(
    mut env: JNIEnv<'l>,
    _class: JClass<'l>,
) -> jstring {
    let result = with_node(|n| json(&n.paths()));
    respond(&mut env, result)
}
