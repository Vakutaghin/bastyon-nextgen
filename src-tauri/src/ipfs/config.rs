//! Конфигурация встроенной ноды Kubo под чтение произвольных CID: локальный
//! gateway/API, минимальный сетевой след, без раздачи чужого контента.
//!
//! Порты НЕ фиксируем и НЕ выбираем сами (это была бы TOCTOU-гонка: нашли
//! свободный → отпустили → kubo занял, а его мог перехватить кто-то ещё). Ставим
//! `/tcp/0` и читаем реальные порты из файлов `$IPFS_PATH/api` и `.../gateway`,
//! которые Kubo пишет, когда слушатели уже подняты.

/// Максимальный размер локального datastore (кэш скачанного).
pub const STORAGE_MAX: &str = "2GB";

/// Сколько секунд ждём готовности демона после запуска.
pub const DAEMON_READY_TIMEOUT_SECS: u64 = 60;

/// Файл с адресом API — multiaddr, напр. `/ip4/127.0.0.1/tcp/5001`.
pub const IPFS_API_FILE: &str = "api";
/// Файл с адресом gateway — HTTP-URL, напр. `http://127.0.0.1:8080`.
pub const IPFS_GATEWAY_FILE: &str = "gateway";

/// Имя удалённого pinning-сервиса в конфиге Kubo (Ф5c, durability).
pub const REMOTE_PIN_SERVICE: &str = "bastyon-pin";

/// Имя записи в `API.Authorizations` (Kubo ≥0.25). Секрет — bearer из файла
/// `IpfsPaths.api_secret`; все наши RPC-вызовы (CLI `--api-auth`, probe-запросы)
/// его предъявляют, gateway не затронут.
pub const API_AUTH_NAME: &str = "bastyon";

/// Публичный шлюз (Tier 0) — единственный не-loopback источник, к которому Rust
/// ходит за шифртекстом. Дублирует TS-константу IPFS_GATEWAY: фронт передаёт
/// не URL, а `source: "local" | "public"`, URL собирается здесь.
pub const PUBLIC_GATEWAY: &str = "https://dweb.link";

/// Потолок размера файла для приватного шаринга/сохранения: и шифрование, и
/// расшифровка держат весь файл в памяти (2× при add). Больше — отказ, а не OOM.
pub const MAX_ENCRYPTED_BYTES: u64 = 512 * 1024 * 1024;

/// Таймаут probe-запросов к RPC (try_attach/wait_ready/shutdown). Без него
/// протухший `api`-файл, указывающий на молчащий порт, вешал бы ensure навсегда.
pub const PROBE_TIMEOUT_SECS: u64 = 2;

/// Что анонсировать в DHT. `pinned` = только явно запиненное (`ipfs add --pin`,
/// т.е. свои опубликованные файлы), НЕ кэш просмотрщика (чужой контент остаётся
/// без анонса — правовая цель сохраняется). `+entities` = корни файлов/каталогов
/// вместо каждого чанка: на порядок меньше provider-записей, файлы находимы.
/// Без Provide опубликованный CID в сети не найдёт никто (файлообмен Ф5 мёртв).
pub const PROVIDE_STRATEGY: &str = "pinned+entities";

/// Профиль инициализации репозитория. `lowpower` (v0.43.0): connmgr basic
/// (LowWater 20 / HighWater 40), AutoNAT/relay-сервис выключены,
/// `Routing.Type=autoclient` — участвуем в DHT как клиент, но не как сервер.
pub const INIT_PROFILE: &str = "lowpower";

/// Последовательность `ipfs config …` вызовов для ноды-читателя. Возвращаем
/// владеющие String, чтобы легко расширять. Порядок не важен, все идемпотентны.
///
/// ВНИМАНИЕ (Kubo v0.43.0): ключи `Reprovider.*` и `Provider.*` УДАЛЕНЫ — демон
/// на них падает. Отключение рекламы контента — только через `Provide.Enabled`.
pub fn config_commands() -> Vec<Vec<String>> {
    vec![
        // OS сама выберет свободный порт; читаем его потом из файлов api/gateway.
        vec![
            "config".into(),
            "Addresses.API".into(),
            "/ip4/127.0.0.1/tcp/0".into(),
        ],
        vec![
            "config".into(),
            "Addresses.Gateway".into(),
            "/ip4/127.0.0.1/tcp/0".into(),
        ],
        vec![
            "config".into(),
            "Datastore.StorageMax".into(),
            STORAGE_MAX.into(),
        ],
        // Резолвим/качаем любой CID как клиент, но ничего не анонсируем.
        vec!["config".into(), "Routing.Type".into(), "autoclient".into()],
        // Анонсируем ТОЛЬКО своё запиненное (см. PROVIDE_STRATEGY) — чужой кэш
        // просмотрщика не рекламируем (правовая экспозиция), свои файлы — да.
        vec![
            "config".into(),
            "--json".into(),
            "Provide.Enabled".into(),
            "true".into(),
        ],
        vec![
            "config".into(),
            "Provide.Strategy".into(),
            PROVIDE_STRATEGY.into(),
        ],
        // API строго локальный, без CORS.
        vec![
            "config".into(),
            "--json".into(),
            "API.HTTPHeaders.Access-Control-Allow-Origin".into(),
            "[]".into(),
        ],
    ]
}

/// `ipfs config --json API.Authorizations …` с нашим bearer-секретом. Отдельно от
/// config_commands(): секрет читается/создаётся во время ensure.
pub fn api_auth_command(secret: &str) -> Vec<String> {
    let json = format!(
        r#"{{"{}":{{"AuthSecret":"bearer:{}","AllowedPaths":["/api/v0"]}}}}"#,
        API_AUTH_NAME, secret
    );
    vec![
        "config".into(),
        "--json".into(),
        "API.Authorizations".into(),
        json,
    ]
}

/// Порт из multiaddr вида `/ip4/127.0.0.1/tcp/5001` → 5001.
pub fn parse_api_multiaddr(s: &str) -> Option<u16> {
    s.trim().rsplit('/').next()?.parse().ok()
}

/// Порт из HTTP-URL вида `http://127.0.0.1:8080` → 8080.
pub fn parse_gateway_url(s: &str) -> Option<u16> {
    s.trim()
        .trim_end_matches('/')
        .rsplit(':')
        .next()?
        .parse()
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_sets_local_ports_and_provides_only_pinned() {
        let cmds = config_commands();
        let flat: Vec<String> = cmds.iter().flatten().cloned().collect();
        assert!(flat.contains(&"Addresses.Gateway".to_string()));
        assert!(flat.contains(&"Addresses.API".to_string()));
        assert!(flat.contains(&"autoclient".to_string()));
        // Provide включён (иначе свои файлы не находимы) и ограничен pinned.
        let en = flat.iter().position(|s| s == "Provide.Enabled").unwrap();
        assert_eq!(flat[en + 1], "true");
        let st = flat.iter().position(|s| s == "Provide.Strategy").unwrap();
        assert_eq!(flat[st + 1], PROVIDE_STRATEGY);
        assert!(PROVIDE_STRATEGY.starts_with("pinned"));
        // Удалённые в v0.43.0 ключи не должны просочиться.
        assert!(!flat.iter().any(|s| s.starts_with("Reprovider")));
        assert!(!flat.iter().any(|s| s.starts_with("Provider.")));
    }

    #[test]
    fn api_auth_command_is_valid_json_with_bearer() {
        let cmd = api_auth_command("abc123");
        assert_eq!(cmd[2], "API.Authorizations");
        let v: serde_json::Value = serde_json::from_str(&cmd[3]).unwrap();
        assert_eq!(v[API_AUTH_NAME]["AuthSecret"], "bearer:abc123");
        assert_eq!(v[API_AUTH_NAME]["AllowedPaths"][0], "/api/v0");
    }

    #[test]
    fn parses_api_multiaddr_port() {
        assert_eq!(parse_api_multiaddr("/ip4/127.0.0.1/tcp/5001"), Some(5001));
        assert_eq!(parse_api_multiaddr("/ip4/127.0.0.1/tcp/5001\n"), Some(5001));
        assert_eq!(parse_api_multiaddr("garbage"), None);
    }

    #[test]
    fn parses_gateway_url_port() {
        assert_eq!(parse_gateway_url("http://127.0.0.1:8080"), Some(8080));
        assert_eq!(parse_gateway_url("http://127.0.0.1:8080/"), Some(8080));
        assert_eq!(parse_gateway_url("http://127.0.0.1"), None);
    }
}
