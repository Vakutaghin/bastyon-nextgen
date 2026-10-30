//! JNI для Tor на Android: класс `com.bastyon.app.plugins.tor.TorNative`.
//! Команды — те же `tor_*`, что у компьютера, с теми же JSON аргументов и
//! ответов: интерфейс у них общий (src/stores/tor-store.ts). Ответ приходит
//! в `TorNative.Reply.onReply(result, error)` из потока Tor, события
//! (`tor:state`, `tor:ws:<id>:*`) — в `TorNative.Events.onEvent(name, json)`.
//!
//! Tor один на процесс: `init` создаёт его при первой загрузке плагина.

use bastyon_tor::state::TorPaths;
use bastyon_tor::{BundleError, Emitter, Host, TorManager};
use futures_util::future::BoxFuture;
use jni::objects::{GlobalRef, JClass, JObject, JString, JValue};
use jni::sys::jboolean;
use jni::{JNIEnv, JavaVM};
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, OnceLock};

struct Tor {
    runtime: tokio::runtime::Runtime,
    mgr: TorManager,
}

static TOR: OnceLock<Tor> = OnceLock::new();

/// tor и lyrebird входят в APK — скачивать нечего. WebView и Java ходят
/// через HTTP-туннель Tor.
struct AndroidHost;

impl Host for AndroidHost {
    fn http_tunnel(&self) -> bool {
        true
    }

    fn ensure_bundle<'a>(
        &'a self,
        paths: &'a TorPaths,
        _cancel: &'a AtomicBool,
    ) -> BoxFuture<'a, Result<(), BundleError>> {
        Box::pin(async move {
            if paths.binary.is_file() {
                Ok(())
            } else {
                Err(BundleError::Failed(format!(
                    "tor_missing: {} is not in the APK",
                    paths.binary.display()
                )))
            }
        })
    }
}

fn text(env: &mut JNIEnv, s: &JString) -> Option<String> {
    if s.is_null() {
        return None;
    }
    env.get_string(s).ok().map(Into::into)
}

fn init_logging() {
    #[cfg(target_os = "android")]
    android_logger::init_once(
        android_logger::Config::default()
            .with_max_level(log::LevelFilter::Info)
            .with_tag("bastyon-tor"),
    );
}

/// Вызов Java из любого потока: потоки Tor подключаются к JVM один раз и
/// навсегда (daemon), чтобы не цеплять их на каждое событие.
fn call_java(vm: &JavaVM, target: &GlobalRef, method: &str, args: [Option<&str>; 2]) {
    let Ok(mut env) = vm.attach_current_thread_as_daemon() else { return };
    let mut strings = Vec::with_capacity(2);
    for arg in args {
        let obj = match arg {
            Some(s) => match env.new_string(s) {
                Ok(js) => JObject::from(js),
                Err(_) => return,
            },
            None => JObject::null(),
        };
        strings.push(obj);
    }
    let _ = env.call_method(
        target.as_obj(),
        method,
        "(Ljava/lang/String;Ljava/lang/String;)V",
        &[JValue::Object(&strings[0]), JValue::Object(&strings[1])],
    );
    if env.exception_check().unwrap_or(false) {
        let _ = env.exception_clear();
    }
    for obj in strings {
        let _ = env.delete_local_ref(obj);
    }
}

fn arg<T: DeserializeOwned>(args: &Value, name: &str) -> Result<T, String> {
    serde_json::from_value(args.get(name).cloned().unwrap_or(Value::Null))
        .map_err(|e| format!("bad argument {name}: {e}"))
}

fn to_json<T: serde::Serialize>(value: T) -> Result<Value, String> {
    serde_json::to_value(value).map_err(|e| e.to_string())
}

/// Команда по имени — как `invoke(name, args)` на компьютере.
async fn dispatch(mgr: &TorManager, command: &str, args: Value) -> Result<Value, String> {
    match command {
        "tor_status" => to_json(mgr.status().await),
        "tor_installed" => Ok(Value::Bool(mgr.paths.binary.is_file())),
        // Встроенный: удалять из APK нечего.
        "tor_uninstall" => Err("tor_builtin".into()),
        "tor_set_bridges" => to_json(mgr.set_bridges(arg(&args, "payload")?).await),
        "tor_request_bridges" => to_json(mgr.request_bridges().await?),
        "tor_start" => to_json(mgr.start().await?),
        "tor_stop" => {
            let restart: Option<bool> = arg(&args, "restart")?;
            to_json(mgr.stop(restart == Some(true)).await)
        }
        "tor_fetch" => to_json(mgr.fetch(arg(&args, "req")?).await?),
        "tor_ws_connect" => {
            mgr.ws_connect(arg(&args, "id")?, arg(&args, "url")?).await?;
            Ok(Value::Null)
        }
        "tor_ws_send" => {
            let id: String = arg(&args, "id")?;
            mgr.ws_send(&id, arg(&args, "payload")?).await?;
            Ok(Value::Null)
        }
        "tor_ws_close" => {
            let id: String = arg(&args, "id")?;
            mgr.ws_close(&id).await?;
            Ok(Value::Null)
        }
        other => Err(format!("unknown command {other}")),
    }
}

/// `root` — каталог Tor в данных приложения, `libDir` — каталог библиотек
/// APK (`ApplicationInfo.nativeLibraryDir`), `ptConfig` — `pt_config.json`
/// бандла из assets (транспорты и встроенные мосты).
#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_tor_TorNative_init<'l>(
    mut env: JNIEnv<'l>,
    _class: JClass<'l>,
    root: JString<'l>,
    lib_dir: JString<'l>,
    pt_config: JString<'l>,
    events: JObject<'l>,
) {
    init_logging();
    if TOR.get().is_some() {
        return;
    }
    let (Some(root), Some(lib_dir)) = (text(&mut env, &root), text(&mut env, &lib_dir)) else {
        return;
    };
    let pt_config = text(&mut env, &pt_config);
    let (Ok(vm), Ok(sink)) = (env.get_java_vm(), env.new_global_ref(events)) else {
        return;
    };
    let runtime = match tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .thread_name("bastyon-tor")
        .enable_all()
        .build()
    {
        Ok(rt) => rt,
        Err(e) => {
            log::error!("[tor] no runtime: {e}");
            return;
        }
    };
    let paths = TorPaths::android(PathBuf::from(root), PathBuf::from(lib_dir));
    if let Err(e) = std::fs::create_dir_all(&paths.root) {
        log::error!("[tor] {}: {e}", paths.root.display());
    }
    if let Some(json) = pt_config {
        let file = paths.pt_dir.join("pt_config.json");
        if std::fs::read_to_string(&file).ok().as_deref() != Some(json.as_str()) {
            if let Err(e) = std::fs::write(&file, json) {
                log::warn!("[tor] {}: {e}", file.display());
            }
        }
    }
    let emit: Emitter = Arc::new(move |event: &str, payload: Value| {
        call_java(&vm, &sink, "onEvent", [Some(event), Some(&payload.to_string())]);
    });
    let mgr = TorManager::new(paths, emit, Arc::new(AndroidHost));
    let _ = TOR.set(Tor { runtime, mgr });
}

/// Команда `tor_*`: ответ — JSON в `reply.onReply(result, null)`, ошибка —
/// `reply.onReply(null, текст)` (те же тексты, что у компьютера).
#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_tor_TorNative_call<'l>(
    mut env: JNIEnv<'l>,
    _class: JClass<'l>,
    command: JString<'l>,
    args: JString<'l>,
    reply: JObject<'l>,
) {
    let (Ok(vm), Ok(reply)) = (env.get_java_vm(), env.new_global_ref(reply)) else {
        return;
    };
    let command = text(&mut env, &command).unwrap_or_default();
    let args: Value = text(&mut env, &args)
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(Value::Null);
    let Some(tor) = TOR.get() else {
        call_java(&vm, &reply, "onReply", [None, Some("tor_unavailable")]);
        return;
    };
    let mgr = tor.mgr.clone();
    tor.runtime.spawn(async move {
        match dispatch(&mgr, &command, args).await {
            Ok(value) => call_java(&vm, &reply, "onReply", [Some(&value.to_string()), None]),
            Err(e) => call_java(&vm, &reply, "onReply", [None, Some(&e)]),
        }
    });
}

/// Прямые соединения из Java (ноды, загрузки) запрещены: Tor включён
/// человеком или работает — как `refuse_direct` у компьютера.
#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_tor_TorNative_directRefused<'l>(
    _env: JNIEnv<'l>,
    _class: JClass<'l>,
) -> jboolean {
    let Some(tor) = TOR.get() else { return 0 };
    let mgr = tor.mgr.clone();
    let refused = tor.runtime.block_on(async move { mgr.refuse_direct().await.is_err() });
    refused as jboolean
}

/// Приложение закрывается: tor — следом, не дожидаясь проверки
/// `__OwningControllerProcess`.
#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_tor_TorNative_kill<'l>(
    _env: JNIEnv<'l>,
    _class: JClass<'l>,
) {
    if let Some(tor) = TOR.get() {
        tor.mgr.kill_child();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manager() -> TorManager {
        let paths = TorPaths::android(
            std::env::temp_dir().join("bastyon-tor-jni-test"),
            PathBuf::from("/nonexistent/lib"),
        );
        TorManager::new(paths, Arc::new(|_: &str, _| {}), Arc::new(AndroidHost))
    }

    /// Аргументы и ответы — как у `invoke` на компьютере.
    #[tokio::test]
    async fn commands_take_the_desktop_json() {
        let mgr = manager();
        let snap = dispatch(&mgr, "tor_status", Value::Null).await.unwrap();
        assert_eq!(snap["status"], "off");
        assert_eq!(snap["socks_port"], 9250);
        assert_eq!(snap["http_tunnel_port"], Value::Null);

        let set = dispatch(
            &mgr,
            "tor_set_bridges",
            serde_json::json!({ "payload": {
                "use_bridges": true, "kind": "custom", "custom_bridges": ["garbage"]
            }}),
        )
        .await
        .unwrap();
        assert_eq!(set["snapshot"]["bridge_kind"], "custom");
        assert_eq!(set["rejected"], serde_json::json!(["garbage"]));

        assert_eq!(
            dispatch(&mgr, "tor_installed", Value::Null).await.unwrap(),
            Value::Bool(false)
        );
        assert_eq!(
            dispatch(&mgr, "tor_uninstall", Value::Null).await.unwrap_err(),
            "tor_builtin"
        );
        let err = dispatch(
            &mgr,
            "tor_fetch",
            serde_json::json!({ "req": { "url": "https://example.org/", "method": "GET" } }),
        )
        .await
        .unwrap_err();
        assert!(err.starts_with(bastyon_tor::TOR_NOT_READY), "{err}");
        assert!(dispatch(&mgr, "tor_fetch", Value::Null).await.unwrap_err().starts_with("bad argument req"));
        let stopped = dispatch(&mgr, "tor_stop", serde_json::json!({ "restart": null }))
            .await
            .unwrap();
        assert_eq!(stopped["status"], "off");
        assert!(dispatch(&mgr, "nope", Value::Null).await.is_err());
    }

    /// Нет tor в APK — `Failed` с причиной, а не вечная установка.
    #[tokio::test]
    async fn missing_binary_fails_the_start() {
        let mgr = manager();
        let err = dispatch(&mgr, "tor_start", Value::Null).await.unwrap_err();
        assert!(err.starts_with("tor_missing"), "{err}");
        assert_eq!(mgr.status().await.status, bastyon_tor::state::TorStatus::Failed);
    }
}
