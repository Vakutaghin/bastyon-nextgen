use crate::bridges;
use crate::pt_config::PtConfig;
use crate::state::{TorPaths, TorState};
use std::io::Write;
use std::path::Path;

/// Wrap a path in double quotes for torrc, escaping any embedded `"` or `\`.
/// macOS `app_data_dir` is `~/Library/Application Support/...` which contains
/// spaces — Tor's parser is happiest when these are quoted.
fn q(path: &Path) -> String {
    let raw = path.to_string_lossy();
    let escaped = raw.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{}\"", escaped)
}

/// Generate torrc content based on current TorState: мосты — те, что у
/// текущей попытки (`active_bridges`), транспорты — из pt_config бандла.
pub fn render_torrc(state: &TorState, paths: &TorPaths, pt: &PtConfig) -> String {
    let mut out = String::new();

    out.push_str(&format!("SocksPort 127.0.0.1:{}\n", state.socks_port));
    // CONNECT с именем хоста: имя разрешает Tor, не устройство.
    if let Some(port) = state.http_tunnel_port {
        out.push_str(&format!("HTTPTunnelPort 127.0.0.1:{port}\n"));
    }
    // Без ControlPort: приложение им не пользуется, а открытый контрол-порт без
    // аутентификации (CookieAuthentication 0) позволял любому локальному
    // процессу `AUTHENTICATE` → `SETEVENTS STREAM` (все хосты назначения) и
    // `SETCONF` (аудит V18). Нужен станет — только с CookieAuthentication 1 и
    // CookieAuthFile под 0600.
    out.push_str(&format!("DataDirectory {}\n", q(&paths.data_dir)));

    // Ensure Tor exits if our process disappears (force-quit, crash) so we
    // don't accumulate orphaned `tor` instances holding onto the SOCKS port.
    out.push_str(&format!(
        "__OwningControllerProcess {}\n",
        std::process::id()
    ));

    // Only point at GeoIP files if they actually exist on disk — Tor refuses
    // to start if the path is configured but missing.
    if paths.geoip.is_file() {
        out.push_str(&format!("GeoIPFile {}\n", q(&paths.geoip)));
    }
    if paths.geoip6.is_file() {
        out.push_str(&format!("GeoIPv6File {}\n", q(&paths.geoip6)));
    }

    out.push_str("ClientUseIPv6 1\n");
    out.push_str("AvoidDiskWrites 1\n");
    out.push_str("Log notice stdout\n");

    // Строки проверяются ещё раз здесь, у самой записи: что бы ни положили в
    // состояние, директиву в torrc мост не допишет.
    let bridges = bridges::parse_lines(&state.active_bridges);
    if !bridges.bridges.is_empty() {
        out.push_str("UseBridges 1\n");
        out.push_str(&pt.torrc_lines(paths));
        for bridge in &bridges.bridges {
            out.push_str("Bridge ");
            out.push_str(&bridge.line);
            out.push('\n');
        }
    }

    out
}

pub fn write_torrc(state: &TorState, paths: &TorPaths, pt: &PtConfig) -> std::io::Result<()> {
    let body = render_torrc(state, paths, pt);
    let mut f = std::fs::File::create(&paths.torrc)?;
    f.write_all(body.as_bytes())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn torrc_has_no_control_port_and_no_cookie_auth_off() {
        let state = TorState::default();
        let paths = TorPaths::from_root(PathBuf::from("/tmp/bastyon-tor-test"));
        let torrc = render_torrc(&state, &paths, &PtConfig::fallback());
        assert!(torrc.contains("SocksPort 127.0.0.1:9250\n"));
        assert!(!torrc.contains("ControlPort"), "{torrc}");
        assert!(!torrc.contains("CookieAuthentication 0"), "{torrc}");
        assert!(torrc.contains("__OwningControllerProcess"));
        assert!(!torrc.contains("UseBridges"), "direct attempt: {torrc}");
        assert!(!torrc.contains("HTTPTunnelPort"), "{torrc}");
    }

    #[test]
    fn http_tunnel_only_when_asked() {
        let state = TorState {
            http_tunnel_port: Some(9251),
            ..TorState::default()
        };
        let paths = TorPaths::from_root(PathBuf::from("/tmp/bastyon-tor-test"));
        let torrc = render_torrc(&state, &paths, &PtConfig::fallback());
        assert!(torrc.contains("\nHTTPTunnelPort 127.0.0.1:9251\n"), "{torrc}");
    }

    #[test]
    fn bridges_of_any_type_get_their_transport() {
        let state = TorState {
            active_bridges: vec![
                "webtunnel [2001:db8::1]:443 DF82B4001F68C2312CB01762E8AE203EB9F1FF54 url=https://wt.example ver=0.0.5".into(),
                "snowflake 192.0.2.3:80 2B280B23E1107BB62ABFC40DDCC8824814F80A72 url=https://x.example fronts=a.example".into(),
            ],
            ..TorState::default()
        };
        let paths = TorPaths::from_root(PathBuf::from(
            "/Users/a b/Library/Application Support/x/tor",
        ));
        let torrc = render_torrc(&state, &paths, &PtConfig::fallback());
        assert!(torrc.contains("UseBridges 1\n"));
        assert!(
            torrc.contains(",webtunnel exec pluggable_transports"),
            "{torrc}"
        );
        assert!(
            torrc.contains("ClientTransportPlugin snowflake exec pluggable_transports"),
            "{torrc}"
        );
        assert!(
            torrc.contains("\nBridge webtunnel [2001:db8::1]:443 "),
            "{torrc}"
        );
        assert!(
            torrc.contains("\nBridge snowflake 192.0.2.3:80 "),
            "{torrc}"
        );
        // Пробел в пути — только у DataDirectory, и тот в кавычках.
        for line in torrc
            .lines()
            .filter(|l| l.starts_with("ClientTransportPlugin"))
        {
            assert!(
                !line.contains("Application Support") && !line.contains('"'),
                "{line}"
            );
        }
    }

    #[test]
    fn injected_directives_never_reach_the_torrc() {
        let state = TorState {
            active_bridges: vec!["obfs4 1.2.3.4:443 cert=x\nControlPort 9999".into()],
            ..TorState::default()
        };
        let paths = TorPaths::from_root(PathBuf::from("/tmp/bastyon-tor-test"));
        let torrc = render_torrc(&state, &paths, &PtConfig::fallback());
        assert!(!torrc.contains("ControlPort"), "{torrc}");
        assert!(
            torrc.contains("\nBridge obfs4 1.2.3.4:443 cert=x\n"),
            "{torrc}"
        );
    }
}
