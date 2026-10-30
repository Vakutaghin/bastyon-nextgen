//! Транспорты и встроенные мосты из `pt_config.json` бандла — того же файла,
//! по которому их настраивает Tor Browser. С новым бандлом сами обновляются
//! и мосты, и способ запуска транспортов: в 15.x Snowflake переехал в
//! lyrebird, и прописанный в коде `snowflake-client` перестал существовать.
//! Нет файла или он битый — копия из 15.0.25 (`pt_config.fallback.json`, в 16.0 тот же).

use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::Path;

const FALLBACK_JSON: &str = include_str!("pt_config.fallback.json");

/// Каталог транспортов относительно рабочего каталога tor (`<root>/tor`, см.
/// `process::spawn`). В torrc путь только относительный: Tor режет значение
/// `ClientTransportPlugin` по пробелам и кавычек не понимает, а на macOS
/// данные приложения лежат в `Application Support` — с пробелом. Абсолютный
/// путь в кавычках там не запускался, и мосты на Mac не работали вовсе.
pub const PT_DIR_REL: &str = if cfg!(windows) {
    "pluggable_transports\\"
} else {
    "pluggable_transports/"
};

#[derive(Deserialize)]
struct RawPtConfig {
    #[serde(rename = "pluggableTransports")]
    pluggable_transports: BTreeMap<String, String>,
    #[serde(default)]
    bridges: BTreeMap<String, Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TransportPlugin {
    /// Транспорты одного бинарника: `meek_lite,obfs4,webtunnel…`.
    pub transports: Vec<String>,
    /// Имя файла в `pluggable_transports/` (на Windows — с `.exe`).
    pub program: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct PtConfig {
    pub plugins: Vec<TransportPlugin>,
    /// Встроенные мосты по типам Tor Browser: `snowflake`, `obfs4`, `meek`.
    pub bridges: BTreeMap<String, Vec<String>>,
}

impl PtConfig {
    pub fn load(pt_dir: &Path) -> Self {
        std::fs::read_to_string(pt_dir.join("pt_config.json"))
            .ok()
            .and_then(|json| Self::parse(&json))
            .unwrap_or_else(Self::fallback)
    }

    pub fn fallback() -> Self {
        Self::parse(FALLBACK_JSON).expect("pt_config.fallback.json is valid")
    }

    pub fn parse(json: &str) -> Option<Self> {
        let raw: RawPtConfig = serde_json::from_str(json).ok()?;
        let plugins: Vec<TransportPlugin> = raw
            .pluggable_transports
            .values()
            .filter_map(|line| parse_plugin_line(line))
            .collect();
        if plugins.is_empty() {
            return None;
        }
        Some(Self {
            plugins,
            bridges: raw.bridges,
        })
    }

    /// Встроенные мосты типа; нет такого — пусто.
    pub fn builtin(&self, kind: &str) -> Vec<String> {
        self.bridges.get(kind).cloned().unwrap_or_default()
    }

    pub fn plugin_for(&self, transport: &str) -> Option<&TransportPlugin> {
        self.plugins
            .iter()
            .find(|p| p.transports.iter().any(|t| t == transport))
    }

    /// Все `ClientTransportPlugin` бандла. Tor запускает транспорт, только
    /// когда он нужен мосту, поэтому лишние строки ничего не стоят, а мост
    /// любого типа из «Своих» находит свой транспорт.
    pub fn torrc_lines(&self) -> String {
        let mut out = String::new();
        for plugin in &self.plugins {
            out.push_str("ClientTransportPlugin ");
            out.push_str(&plugin.transports.join(","));
            out.push_str(" exec ");
            out.push_str(PT_DIR_REL);
            out.push_str(&plugin.program);
            for arg in &plugin.args {
                out.push(' ');
                out.push_str(arg);
            }
            out.push('\n');
        }
        out
    }
}

/// `ClientTransportPlugin meek_lite,obfs4 exec ${pt_path}lyrebird [аргументы]`.
fn parse_plugin_line(line: &str) -> Option<TransportPlugin> {
    let mut it = line.split_whitespace();
    if it.next()? != "ClientTransportPlugin" {
        return None;
    }
    let transports: Vec<String> = it
        .next()?
        .split(',')
        .filter(|t| !t.is_empty() && t.chars().all(|c| c.is_ascii_alphanumeric() || c == '_'))
        .map(String::from)
        .collect();
    if transports.is_empty() || it.next()? != "exec" {
        return None;
    }
    let program = it.next()?.strip_prefix("${pt_path}")?;
    let plain_name = !program.is_empty()
        && !program.starts_with('.')
        && program
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
    if !plain_name {
        return None;
    }
    let mut program = program.to_string();
    if cfg!(windows) && !program.to_ascii_lowercase().ends_with(".exe") {
        program.push_str(".exe");
    }
    let args: Vec<String> = it.map(String::from).collect();
    if args
        .iter()
        .any(|a| !a.chars().all(|c| c.is_ascii_graphic()))
    {
        return None;
    }
    Some(TransportPlugin {
        transports,
        program,
        args,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn exe(name: &str) -> String {
        if cfg!(windows) {
            format!("{name}.exe")
        } else {
            name.to_string()
        }
    }

    #[test]
    fn bundle_config_gives_lyrebird_for_snowflake_and_webtunnel() {
        let pt = PtConfig::fallback();
        let lyrebird = pt.plugin_for("webtunnel").expect("webtunnel");
        assert_eq!(lyrebird.program, exe("lyrebird"));
        assert!(lyrebird.transports.contains(&"obfs4".to_string()));
        assert!(lyrebird.transports.contains(&"meek_lite".to_string()));
        assert_eq!(
            pt.plugin_for("snowflake").expect("snowflake").program,
            exe("lyrebird")
        );
        let conjure = pt.plugin_for("conjure").expect("conjure");
        assert_eq!(
            conjure.args,
            vec![
                "-registerURL",
                "https://registration.refraction.network/api"
            ]
        );
        assert!(pt.plugin_for("nope").is_none());
    }

    #[test]
    fn torrc_lines_use_a_relative_path_without_quotes() {
        let lines = PtConfig::fallback().torrc_lines();
        assert!(lines.contains(&format!(
            "ClientTransportPlugin meek_lite,obfs2,obfs3,obfs4,scramblesuit,webtunnel exec {PT_DIR_REL}{}\n",
            exe("lyrebird")
        )));
        assert!(lines.contains(&format!(
            "ClientTransportPlugin snowflake exec {PT_DIR_REL}{}\n",
            exe("lyrebird")
        )));
        assert!(!lines.contains('"'), "{lines}");
        assert!(!lines.contains("${pt_path}"), "{lines}");
    }

    #[test]
    fn builtin_bridges_come_from_the_bundle() {
        let pt = PtConfig::fallback();
        let snowflake = pt.builtin("snowflake");
        assert_eq!(snowflake.len(), 2);
        assert!(snowflake
            .iter()
            .all(|l| l.starts_with("snowflake ") && l.contains("utls-imitate=")));
        assert!(pt.builtin("obfs4").iter().all(|l| l.starts_with("obfs4 ")));
        assert!(pt.builtin("meek")[0].starts_with("meek_lite "));
        assert!(pt.builtin("webtunnel").is_empty());
    }

    #[test]
    fn unsafe_or_broken_plugin_lines_are_skipped() {
        for bad in [
            "ClientTransportPlugin obfs4 exec /usr/bin/lyrebird",
            "ClientTransportPlugin obfs4 exec ${pt_path}../../evil",
            "ClientTransportPlugin obfs4 exec ${pt_path}sub/lyrebird",
            "ClientTransportPlugin obfs4 run ${pt_path}lyrebird",
            "Bridge obfs4 exec ${pt_path}lyrebird",
        ] {
            assert!(parse_plugin_line(bad).is_none(), "{bad}");
        }
        let json = r#"{"pluggableTransports":{"x":"ClientTransportPlugin obfs4 exec /abs/lyrebird"},"bridges":{}}"#;
        assert!(PtConfig::parse(json).is_none());
        assert!(PtConfig::parse("not json").is_none());
    }

    #[test]
    fn missing_file_falls_back_to_the_embedded_copy() {
        let pt = PtConfig::load(Path::new("/nonexistent/bastyon/pt"));
        assert!(pt.plugin_for("snowflake").is_some());
        assert!(!pt.builtin("obfs4").is_empty());
    }
}
