//! Подключение: что пробовать, в каком порядке, и надзор за бутстрапом.
//!
//! Ручной режим — одна попытка. Застряла — в меню подсказка, а Tor
//! продолжает пробовать сам. «Автоматически» повторяет Connection Assist из
//! Tor Browser: сначала то, что сработало в прошлый раз, потом мосты, которые
//! Moat советует для страны, потом встроенные. Застрявшая попытка уступает
//! место следующей, сработавшая запоминается.

use crate::bridges;
use crate::moat::{self, BridgeSource, MoatSettings};
use crate::pt_config::PtConfig;
use crate::state::{BridgeKind, TorErrorCode, TorStatus};
use crate::{config, process, TorManager};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};

/// Сколько бутстрап может не двигаться, пока попытка считается живой. Через
/// Snowflake и WebTunnel Tor молчит до минуты на загрузке дескрипторов
/// (замер 17.10.2026), поэтому меньше нельзя.
pub const STALL_TIMEOUT: Duration = Duration::from_secs(90);
const POLL: Duration = Duration::from_millis(500);
/// Транспорт упал столько раз — не запускается вовсе, ждать нечего.
const PT_FAILURE_LIMIT: u32 = 3;
const CACHE_FILE: &str = "connect-cache.json";

/// meek тянет дескрипторы через CDN медленно: в замере 17.10.2026 он стоял
/// на 50% больше двух минут и подключился на шестой.
const MEEK_STALL_TIMEOUT: Duration = Duration::from_secs(240);

/// Порог для транспорта; в живом тесте его можно уменьшить:
/// `BASTYON_TOR_STALL_SECS`.
fn stall_timeout(transport: &str) -> Duration {
    #[cfg(test)]
    if let Some(secs) = std::env::var("BASTYON_TOR_STALL_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
    {
        return Duration::from_secs(secs);
    }
    if transport == "meek" {
        MEEK_STALL_TIMEOUT
    } else {
        STALL_TIMEOUT
    }
}

pub const DIRECT: &str = "direct";

/// Snowflake, который договаривается с брокером через AMP cache Google, а не
/// через CDN77. Moat советует его для России (ответ для `ru` от 30.10.2026),
/// но из России сам Moat недоступен: его отражатель тоже на CDN77, а CDN77 там
/// закрыт. Во встроенных мостах бандла такого Snowflake нет — без этих строк
/// автоподбор в России о нём не узнал бы.
const SNOWFLAKE_AMP: [&str; 2] = [
    "snowflake 192.0.2.5:80 2B280B23E1107BB62ABFC40DDCC8824814F80A72 fingerprint=2B280B23E1107BB62ABFC40DDCC8824814F80A72 url=https://snowflake-broker.torproject.net/ ampcache=https://cdn.ampproject.org/ front=www.google.com ice=stun:stun.antisip.com:3478,stun:stun.epygi.com:3478,stun:stun.uls.co.za:3478,stun:stun.telnyx.com:3478,stun:stun.hot-chilli.net:3478,stun:stun.fitauto.ru:3478,stun:stun.m-online.net:3478 utls-imitate=hellorandomizedalpn",
    "snowflake 192.0.2.6:80 8838024498816A039FCBBAB14E6F40A0843051FA fingerprint=8838024498816A039FCBBAB14E6F40A0843051FA url=https://snowflake-broker.torproject.net/ ampcache=https://cdn.ampproject.org/ front=www.google.com ice=stun:stun.antisip.com:3478,stun:stun.epygi.com:3478,stun:stun.uls.co.za:3478,stun:stun.telnyx.com:3478,stun:stun.hot-chilli.net:3478,stun:stun.fitauto.ru:3478,stun:stun.m-online.net:3478 utls-imitate=hellorandomizedalpn",
];

fn snowflake_amp() -> Candidate {
    Candidate {
        transport: "snowflake".into(),
        bridges: bridges::parse_lines(&SNOWFLAKE_AMP).lines(),
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Candidate {
    /// `direct`, `snowflake`, `webtunnel`, `obfs4`, `meek`, `custom`…
    pub transport: String,
    /// Пусто — без мостов.
    pub bridges: Vec<String>,
}

impl Candidate {
    pub fn direct() -> Self {
        Self {
            transport: DIRECT.into(),
            bridges: Vec::new(),
        }
    }

    /// Встроенные мосты бандла (`snowflake`, `obfs4`, `meek`).
    fn builtin(kind: &str, pt: &PtConfig) -> Option<Self> {
        let bridges = bridges::parse_lines(&pt.builtin(kind)).lines();
        (!bridges.is_empty()).then(|| Self {
            transport: kind.into(),
            bridges,
        })
    }
}

/// Кандидат ручного режима; `None` — в «Своих мостах» нет ни одного моста.
pub fn manual_candidate(kind: BridgeKind, custom: &[String], pt: &PtConfig) -> Option<Candidate> {
    match kind {
        BridgeKind::None | BridgeKind::Auto => Some(Candidate::direct()),
        BridgeKind::Snowflake => Candidate::builtin("snowflake", pt),
        BridgeKind::Obfs4 => Candidate::builtin("obfs4", pt),
        BridgeKind::Meek => Candidate::builtin("meek", pt),
        BridgeKind::Custom => {
            let parsed = bridges::parse_lines(custom);
            (!parsed.bridges.is_empty()).then(|| Candidate {
                transport: bridges::label_for(&parsed.bridges),
                bridges: parsed.lines(),
            })
        }
    }
}

/// Порядок попыток автоподбора. `moat` — ответ Moat (`None` — не дозвонились).
/// После советов Moat — встроенные, которых в них не было, и Snowflake через
/// AMP cache, если его не было среди советов; без мостов — в конце.
pub fn auto_plan(moat: Option<&MoatSettings>, pt: &PtConfig) -> Vec<Candidate> {
    let mut plan: Vec<Candidate> = Vec::new();
    match moat {
        Some(s) if !s.bridges.is_empty() => {
            for b in &s.bridges {
                let candidate = match b.source {
                    BridgeSource::BuiltIn => Candidate::builtin(&b.kind, pt),
                    BridgeSource::BridgeDb => Some(Candidate {
                        transport: b.kind.clone(),
                        bridges: b.lines.clone(),
                    }),
                };
                plan.extend(candidate);
            }
        }
        // Страна известна, а советов нет — мосты там не нужны.
        Some(_) => plan.push(Candidate::direct()),
        None => {}
    }
    for kind in ["snowflake", "obfs4", "meek"] {
        if !plan.iter().any(|c| c.transport == kind) {
            plan.extend(Candidate::builtin(kind, pt));
        }
        let has_amp = plan
            .iter()
            .any(|c| c.bridges.iter().any(|b| b.contains(" ampcache=")));
        if kind == "snowflake" && !has_amp {
            plan.push(snowflake_amp());
        }
    }
    if !plan.iter().any(|c| c.bridges.is_empty()) {
        plan.push(Candidate::direct());
    }
    let mut unique: Vec<Candidate> = Vec::new();
    for c in plan {
        if !unique.contains(&c) {
            unique.push(c);
        }
    }
    unique
}

#[derive(Serialize, Deserialize)]
struct CacheFile {
    candidate: Candidate,
    #[serde(default)]
    country: Option<String>,
}

/// То, что сработало в прошлый раз (только автоподбор). Строки проверяются
/// заново: файл лежит на диске и мог быть изменён.
fn load_cache(root: &Path) -> Option<(Candidate, Option<String>)> {
    let raw = std::fs::read_to_string(root.join(CACHE_FILE)).ok()?;
    let file: CacheFile = serde_json::from_str(&raw).ok()?;
    let parsed = bridges::parse_lines(&file.candidate.bridges);
    if !parsed.rejected.is_empty() {
        return None;
    }
    let mut candidate = file.candidate;
    candidate.bridges = parsed.lines();
    if candidate.transport.is_empty() || candidate.transport.len() > 32 {
        return None;
    }
    Some((candidate, file.country))
}

fn save_cache(root: &Path, candidate: &Candidate, country: Option<&str>) {
    let file = CacheFile {
        candidate: candidate.clone(),
        country: country.map(String::from),
    };
    if let Ok(json) = serde_json::to_string_pretty(&file) {
        if let Err(e) = std::fs::write(root.join(CACHE_FILE), json) {
            log::warn!("[tor] cannot save {}: {}", CACHE_FILE, e);
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Outcome {
    Ready,
    Failed,
    Stalled,
    /// `tor_stop` или новый `tor_start` — этот надзор больше не главный.
    Cancelled,
}

/// Запускается из `tor_start` после установки; живёт, пока поколение запуска
/// (`start_gen`) — его.
pub async fn supervise(mgr: &TorManager, gen: u64) {
    let pt = PtConfig::load(&mgr.paths.pt_dir);
    let (kind, custom) = {
        let st = mgr.state.read().await;
        (st.bridge_kind, st.custom_bridges.clone())
    };
    if kind == BridgeKind::Auto {
        run_auto(mgr, gen, &pt).await;
    } else {
        run_manual(mgr, gen, kind, &custom, &pt).await;
    }
}

fn still_ours(mgr: &TorManager, gen: u64) -> bool {
    mgr.start_gen.load(Ordering::SeqCst) == gen
}

async fn run_manual(
    mgr: &TorManager,
    gen: u64,
    kind: BridgeKind,
    custom: &[String],
    pt: &PtConfig,
) {
    let Some(candidate) = manual_candidate(kind, custom, pt) else {
        finish_failed(mgr, gen, TorErrorCode::NoValidBridges).await;
        return;
    };
    attempt(mgr, gen, pt, &candidate, 1, false).await;
}

async fn run_auto(mgr: &TorManager, gen: u64, pt: &PtConfig) {
    {
        let mut st = mgr.state.write().await;
        if !still_ours(mgr, gen) {
            return;
        }
        st.keep_going = true;
    }
    let mut tried: Vec<Candidate> = Vec::new();
    let mut n: u8 = 0;
    let mut country: Option<String> = None;

    if let Some((cached, cached_country)) = load_cache(&mgr.paths.root) {
        country = cached_country;
        set_country(mgr, gen, country.clone()).await;
        n += 1;
        match attempt(mgr, gen, pt, &cached, n, true).await {
            Outcome::Ready => return,
            Outcome::Cancelled => return,
            Outcome::Failed | Outcome::Stalled => tried.push(cached),
        }
    }

    if !set_fetching(mgr, gen, true).await {
        return;
    }
    let settings = match moat::settings_or_defaults(&mgr.paths, pt).await {
        Ok(s) => Some(s),
        Err(e) => {
            log::warn!("[tor] moat unavailable: {}", e);
            None
        }
    };
    if let Some(c) = settings.as_ref().and_then(|s| s.country.clone()) {
        country = Some(c);
    }
    set_country(mgr, gen, country.clone()).await;
    if !set_fetching(mgr, gen, false).await {
        return;
    }

    for candidate in auto_plan(settings.as_ref(), pt) {
        if tried.contains(&candidate) {
            continue;
        }
        n = n.saturating_add(1);
        match attempt(mgr, gen, pt, &candidate, n, true).await {
            Outcome::Ready => {
                save_cache(&mgr.paths.root, &candidate, country.as_deref());
                return;
            }
            Outcome::Cancelled => return,
            Outcome::Failed | Outcome::Stalled => tried.push(candidate),
        }
    }

    // Сначала `Failed` с обнулённым child_pid, потом kill: смерть последнего
    // процесса уже ничего не меняет.
    finish_failed(mgr, gen, TorErrorCode::AllMethodsFailed).await;
    if still_ours(mgr, gen) {
        mgr.kill_child();
    }
}

async fn set_country(mgr: &TorManager, gen: u64, country: Option<String>) {
    let mut st = mgr.state.write().await;
    if still_ours(mgr, gen) {
        st.country = country;
    }
}

/// `false` — запуск уже не наш.
async fn set_fetching(
    mgr: &TorManager,
    gen: u64,
    on: bool,
) -> bool {
    {
        let mut st = mgr.state.write().await;
        if !still_ours(mgr, gen) {
            return false;
        }
        st.fetching_bridges = on;
        if on {
            st.status = TorStatus::Starting;
            st.active_transport = None;
            st.bootstrap_pct = 0;
        }
    }
    mgr.emit_state().await;
    true
}

async fn finish_failed(
    mgr: &TorManager,
    gen: u64,
    code: TorErrorCode,
) {
    {
        let mut st = mgr.state.write().await;
        if !still_ours(mgr, gen) {
            return;
        }
        st.status = TorStatus::Failed;
        st.error_code = Some(code);
        st.keep_going = false;
        st.fetching_bridges = false;
        st.child_pid = None;
    }
    mgr.emit_state().await;
}

/// Одна попытка: torrc с мостами кандидата, свежий процесс tor, надзор.
async fn attempt(
    mgr: &TorManager,
    gen: u64,
    pt: &PtConfig,
    candidate: &Candidate,
    n: u8,
    move_on_stall: bool,
) -> Outcome {
    {
        let mut st = mgr.state.write().await;
        if !still_ours(mgr, gen) {
            return Outcome::Cancelled;
        }
        // child_pid — до kill: смерть прошлого процесса не провалит эту попытку.
        st.child_pid = None;
        st.status = TorStatus::Starting;
        st.bootstrap_pct = 0;
        st.message = None;
        st.stalled = false;
        st.candidate_failed = false;
        st.pt_failures = 0;
        st.error_code = None;
        st.attempt = n;
        st.active_transport = Some(candidate.transport.clone());
        st.active_bridges = candidate.bridges.clone();
        if let Err(e) = config::write_torrc(&st, &mgr.paths, pt) {
            st.message = Some(e.to_string());
            st.status = TorStatus::Failed;
            drop(st);
            mgr.emit_state().await;
            return Outcome::Failed;
        }
    }
    mgr.kill_child();
    mgr.emit_state().await;

    let mut child = match process::spawn(&mgr.paths) {
        Ok(c) => c,
        Err(e) => {
            let mut st = mgr.state.write().await;
            if still_ours(mgr, gen) {
                st.message = Some(e.to_string());
                st.status = TorStatus::Failed;
            }
            drop(st);
            mgr.emit_state().await;
            return Outcome::Failed;
        }
    };
    let pid = child.pid();
    let logs = child.take_logs();
    {
        let mut guard = mgr.child.lock().expect("tor child mutex poisoned");
        *guard = Some(child);
    }
    {
        let mut st = mgr.state.write().await;
        if !still_ours(mgr, gen) {
            drop(st);
            kill_child_if(mgr, pid);
            return Outcome::Cancelled;
        }
        st.child_pid = Some(pid);
        st.status = TorStatus::Bootstrapping;
    }
    logs.start(mgr.emitter(), mgr.state.clone());
    // Клиенты собираются заново при первом запросе после Ready.
    *mgr.torified.write().await = None;
    mgr.emit_state().await;

    watch(
        mgr,
        gen,
        stall_timeout(&candidate.transport),
        move_on_stall,
    )
    .await
}

/// Убивает процесс, только если в менеджере всё ещё он (а не процесс
/// запуска, который успел начаться после `tor_stop`).
fn kill_child_if(mgr: &TorManager, pid: u32) {
    let mut guard = mgr.child.lock().expect("tor child mutex poisoned");
    if guard.as_ref().is_some_and(|c| c.pid() == pid) {
        if let Some(mut child) = guard.take() {
            let _ = process::kill(&mut child);
        }
    }
}

async fn watch(
    mgr: &TorManager,
    gen: u64,
    stall: Duration,
    move_on_stall: bool,
) -> Outcome {
    let mut last_pct = 0u8;
    let mut last_change = Instant::now();
    let mut marked_stalled = false;
    loop {
        tokio::time::sleep(POLL).await;
        let (status, pct, failed, pt_failures) = {
            let st = mgr.state.read().await;
            (
                st.status,
                st.bootstrap_pct,
                st.candidate_failed,
                st.pt_failures,
            )
        };
        if !still_ours(mgr, gen) {
            return Outcome::Cancelled;
        }
        match status {
            TorStatus::Ready => return Outcome::Ready,
            TorStatus::Failed => return Outcome::Failed,
            TorStatus::Off => return Outcome::Cancelled,
            _ => {}
        }
        if failed {
            return Outcome::Failed;
        }
        if pct > last_pct {
            last_pct = pct;
            last_change = Instant::now();
            if marked_stalled {
                marked_stalled = false;
                set_stalled(mgr, gen, false).await;
            }
        }
        let stuck = last_change.elapsed() >= stall || pt_failures >= PT_FAILURE_LIMIT;
        if stuck {
            if move_on_stall {
                log::info!("[tor] attempt stalled at {}%, trying the next one", pct);
                return Outcome::Stalled;
            }
            if !marked_stalled {
                marked_stalled = true;
                set_stalled(mgr, gen, true).await;
            }
        }
    }
}

async fn set_stalled(mgr: &TorManager, gen: u64, stalled: bool) {
    {
        let mut st = mgr.state.write().await;
        if !still_ours(mgr, gen) {
            return;
        }
        st.stalled = stalled;
    }
    mgr.emit_state().await;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::moat::MoatBridges;

    const WEBTUNNEL: &str = "webtunnel [2001:db8::1]:443 DF82B4001F68C2312CB01762E8AE203EB9F1FF54 url=https://wt.example ver=0.0.5";
    const OBFS4: &str =
        "obfs4 207.136.101.198:1778 E00DE29F04E89959B9D3612AD1BF5C40E4FF1719 cert=QxPx iat-mode=0";

    fn transports(plan: &[Candidate]) -> Vec<&str> {
        plan.iter().map(|c| c.transport.as_str()).collect()
    }

    #[test]
    fn censored_country_follows_moat_then_builtins_then_direct() {
        let pt = PtConfig::fallback();
        let moat = MoatSettings {
            country: Some("ru".into()),
            bridges: vec![
                MoatBridges {
                    kind: "webtunnel".into(),
                    source: BridgeSource::BridgeDb,
                    lines: vec![WEBTUNNEL.into()],
                },
                MoatBridges {
                    kind: "obfs4".into(),
                    source: BridgeSource::BridgeDb,
                    lines: vec![OBFS4.into()],
                },
                MoatBridges {
                    kind: "snowflake".into(),
                    source: BridgeSource::BuiltIn,
                    lines: vec![],
                },
            ],
        };
        let plan = auto_plan(Some(&moat), &pt);
        assert_eq!(
            transports(&plan),
            [
                "webtunnel",
                "obfs4",
                "snowflake",
                "snowflake",
                "meek",
                DIRECT
            ]
        );
        assert_eq!(plan[3], snowflake_amp(), "AMP cache after the CDN77 one");
        assert_eq!(plan[0].bridges, vec![WEBTUNNEL.to_string()]);
        assert_eq!(
            plan[2].bridges,
            pt.builtin("snowflake"),
            "builtin = lines of the bundle"
        );
    }

    #[test]
    fn uncensored_country_goes_direct_first() {
        let pt = PtConfig::fallback();
        let moat = MoatSettings {
            country: Some("ge".into()),
            bridges: vec![],
        };
        let plan = auto_plan(Some(&moat), &pt);
        assert_eq!(
            transports(&plan),
            [DIRECT, "snowflake", "snowflake", "obfs4", "meek"]
        );
    }

    #[test]
    fn without_moat_builtins_come_before_direct() {
        let plan = auto_plan(None, &PtConfig::fallback());
        assert_eq!(
            transports(&plan),
            ["snowflake", "snowflake", "obfs4", "meek", DIRECT]
        );
        assert!(plan[..4].iter().all(|c| !c.bridges.is_empty()));
        assert_eq!(
            plan[1].bridges.len(),
            2,
            "both AMP lines pass the bridge check"
        );
    }

    /// Moat прислал Snowflake с AMP cache сам — второй такой же не нужен.
    #[test]
    fn amp_snowflake_from_moat_is_not_doubled() {
        let pt = PtConfig::fallback();
        let moat = MoatSettings {
            country: Some("ru".into()),
            bridges: vec![MoatBridges {
                kind: "snowflake".into(),
                source: BridgeSource::BridgeDb,
                lines: vec![SNOWFLAKE_AMP[0].into()],
            }],
        };
        let plan = auto_plan(Some(&moat), &pt);
        assert_eq!(transports(&plan), ["snowflake", "obfs4", "meek", DIRECT]);
    }

    #[test]
    fn manual_modes() {
        let pt = PtConfig::fallback();
        assert_eq!(
            manual_candidate(BridgeKind::None, &[], &pt),
            Some(Candidate::direct())
        );
        let meek = manual_candidate(BridgeKind::Meek, &[], &pt).unwrap();
        assert!(meek.bridges[0].starts_with("meek_lite "));
        let custom = manual_candidate(BridgeKind::Custom, &[WEBTUNNEL.into()], &pt).unwrap();
        assert_eq!(custom.transport, "webtunnel");
        assert_eq!(
            manual_candidate(BridgeKind::Custom, &["garbage".into()], &pt),
            None
        );
        assert_eq!(manual_candidate(BridgeKind::Custom, &[], &pt), None);
    }

    #[test]
    fn cache_round_trip_and_tampered_cache_is_ignored() {
        let dir =
            std::env::temp_dir().join(format!("bastyon-connect-cache-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let candidate = Candidate {
            transport: "webtunnel".into(),
            bridges: vec![WEBTUNNEL.into()],
        };
        save_cache(&dir, &candidate, Some("ru"));
        assert_eq!(load_cache(&dir), Some((candidate, Some("ru".into()))));

        let tampered = r#"{"candidate":{"transport":"obfs4","bridges":["obfs4 1.2.3.4:443 cert=x\nControlPort 1"]}}"#;
        std::fs::write(dir.join(CACHE_FILE), tampered).unwrap();
        assert_eq!(load_cache(&dir), None);
        std::fs::write(dir.join(CACHE_FILE), "not json").unwrap();
        assert_eq!(load_cache(&dir), None);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Живое подключение. Нужна копия бандла (каталог с `tor/` и `data/`),
    /// кэш автоподбора пишется в неё же:
    /// `BASTYON_TOR_ROOT=… [BASTYON_TOR_KIND=auto|snowflake|obfs4|meek|none]
    /// [BASTYON_TOR_FAKE_CACHE=1] [BASTYON_TOR_STALL_SECS=30]
    /// cargo test -p bastyon-tor live_connect -- --ignored --nocapture`.
    /// `FAKE_CACHE` кладёт в кэш мёртвый мост — проверка перехода дальше.
    #[tokio::test(flavor = "multi_thread")]
    #[ignore]
    async fn live_connect() {
        let root =
            std::path::PathBuf::from(std::env::var("BASTYON_TOR_ROOT").expect("BASTYON_TOR_ROOT"));
        let kind_name = std::env::var("BASTYON_TOR_KIND").unwrap_or_else(|_| "auto".into());
        let kind: BridgeKind = serde_json::from_value(serde_json::json!(kind_name)).expect("kind");
        let _ = std::fs::remove_file(root.join(CACHE_FILE));
        if std::env::var("BASTYON_TOR_FAKE_CACHE").is_ok() {
            let dead = Candidate {
                transport: "obfs4".into(),
                bridges: vec!["obfs4 192.0.2.1:443 0123456789ABCDEF0123456789ABCDEF01234567 cert=AAAA iat-mode=0".into()],
            };
            save_cache(&root, &dead, Some("zz"));
        }

        let mgr = crate::testing::manager(crate::state::TorPaths::from_root(root));
        {
            let mut st = mgr.state.write().await;
            st.bridge_kind = kind;
            if let Some((socks, control)) = crate::pick_free_port_pair() {
                st.socks_port = socks;
                st.control_port = control;
            }
        }
        let gen = mgr.start_gen.fetch_add(1, Ordering::SeqCst) + 1;
        let task = {
            let mgr = mgr.clone();
            tokio::spawn(async move { supervise(&mgr, gen).await })
        };
        let started = Instant::now();
        let mut last = String::new();
        let status = loop {
            tokio::time::sleep(Duration::from_millis(500)).await;
            let st = mgr.state.read().await;
            let line = format!(
                "{:?} {}% via {:?} #{} stalled={} fetching={} error={:?} country={:?}",
                st.status, st.bootstrap_pct, st.active_transport, st.attempt,
                st.stalled, st.fetching_bridges, st.error_code, st.country
            );
            if line != last {
                println!("{:>6.1}s {}", started.elapsed().as_secs_f32(), line);
                last = line;
            }
            if matches!(st.status, TorStatus::Ready | TorStatus::Failed) && !st.fetching_bridges {
                break st.status;
            }
            assert!(started.elapsed() < Duration::from_secs(900), "timed out");
        };
        mgr.start_gen.fetch_add(1, Ordering::SeqCst);
        mgr.kill_child();
        let _ = task.await;
        assert_eq!(status, TorStatus::Ready);
    }
}
