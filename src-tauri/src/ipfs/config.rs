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
        // Не рекламируем/не репровайдим чужой контент (снимает правовую экспозицию).
        vec![
            "config".into(),
            "--json".into(),
            "Provide.Enabled".into(),
            "false".into(),
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
    fn config_sets_local_ports_and_disables_provide() {
        let cmds = config_commands();
        let flat: Vec<String> = cmds.iter().flatten().cloned().collect();
        assert!(flat.contains(&"Addresses.Gateway".to_string()));
        assert!(flat.contains(&"Addresses.API".to_string()));
        assert!(flat.contains(&"Provide.Enabled".to_string()));
        assert!(flat.contains(&"autoclient".to_string()));
        // Удалённые в v0.43.0 ключи не должны просочиться.
        assert!(!flat.iter().any(|s| s.starts_with("Reprovider")));
        assert!(!flat.iter().any(|s| s.starts_with("Provider.")));
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
