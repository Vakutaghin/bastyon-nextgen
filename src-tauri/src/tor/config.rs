use crate::tor::state::{BridgeKind, TorPaths, TorState};
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

/// Generate torrc content based on current TorState.
pub fn render_torrc(state: &TorState, paths: &TorPaths) -> String {
    let mut out = String::new();

    out.push_str(&format!("SocksPort 127.0.0.1:{}\n", state.socks_port));
    out.push_str(&format!("ControlPort 127.0.0.1:{}\n", state.control_port));
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
    out.push_str("CookieAuthentication 0\n");

    if state.use_bridges {
        out.push_str("UseBridges 1\n");

        match state.bridge_kind {
            BridgeKind::Snowflake => {
                let snowflake = paths.pt_dir.join(if cfg!(windows) {
                    "snowflake-client.exe"
                } else {
                    "snowflake-client"
                });
                out.push_str(&format!(
                    "ClientTransportPlugin snowflake exec {} \
                     -url https://1098762253.rsc.cdn77.org/ \
                     -front www.cdn77.com \
                     -ice stun:stun.l.google.com:19302,stun:stun.antisip.com:3478 \
                     -log snowflake.log\n",
                    q(&snowflake)
                ));
                out.push_str(
                    "Bridge snowflake 192.0.2.3:80 2B280B23E1107BB62ABFC40DDCC8824814F80A72\n",
                );
            }
            BridgeKind::Obfs4 => {
                let lyrebird = paths.pt_dir.join(if cfg!(windows) {
                    "lyrebird.exe"
                } else {
                    "lyrebird"
                });
                out.push_str(&format!(
                    "ClientTransportPlugin obfs4 exec {}\n",
                    q(&lyrebird)
                ));
                for line in DEFAULT_OBFS4_BRIDGES {
                    out.push_str("Bridge ");
                    out.push_str(line);
                    out.push('\n');
                }
            }
            BridgeKind::Custom => {
                let lyrebird = paths.pt_dir.join(if cfg!(windows) {
                    "lyrebird.exe"
                } else {
                    "lyrebird"
                });
                out.push_str(&format!(
                    "ClientTransportPlugin obfs4 exec {}\n",
                    q(&lyrebird)
                ));
                for bridge in &state.custom_bridges {
                    let trimmed = bridge.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    out.push_str("Bridge ");
                    out.push_str(trimmed);
                    out.push('\n');
                }
            }
            BridgeKind::None => {}
        }
    }

    out
}

pub fn write_torrc(state: &TorState, paths: &TorPaths) -> std::io::Result<()> {
    let body = render_torrc(state, paths);
    let mut f = std::fs::File::create(&paths.torrc)?;
    f.write_all(body.as_bytes())?;
    Ok(())
}

/// Built-in obfs4 bridges as published by Tor Project (rotated periodically).
/// User can supply custom ones via the UI; these are a sensible default.
const DEFAULT_OBFS4_BRIDGES: &[&str] = &[
    "obfs4 192.95.36.142:443 CDF2E852BF539B82BD10E27E9115A31734E378C2 cert=qUVQ0srL1JI/vO6V6m/24anYXiJD3QP2HgzUKQtQ7GRqqUvs7P+tG43RtAqdhLOALP7DJQ iat-mode=1",
    "obfs4 38.229.33.83:80 0BAC39417268B96B9F514E7F63FA6FBA1A788955 cert=VwEFpk9F/UN9JED7XpG1XOjm/O8ZCXK80oPecgWnNDZDv5pdkhq1OpbAH0wNqOT6H6BmRQ iat-mode=1",
    "obfs4 37.218.245.14:38224 D9A82D2F9C2F65A18407B1D2B764F130847F8B5D cert=bjRaMrr1BRiAW8IE9U5z27fQaYgOhX1UCmOpg2pFpoMvo6ZgQMzLsaTzzQNTlm7hNcb+Sg iat-mode=0",
];
