//! Строки мостов: разбор, проверка и приведение к виду `Bridge <строка>`.
//!
//! Строки приходят от человека (вставил из бота или письма), из Moat и из
//! кэша автоподбора и попадают в torrc. Перевод строки в одной из них дописал
//! бы в torrc любую директиву, поэтому строка собирается заново из токенов
//! через одиночные пробелы и пропускается, только если похожа на мост.

use std::net::SocketAddr;

/// Транспорты, которые умеет бандл (lyrebird и conjure-client). `meek`
/// встречается в старых строках и в Moat — это `meek_lite`.
pub const KNOWN_TRANSPORTS: &[&str] = &[
    "obfs4",
    "webtunnel",
    "snowflake",
    "meek_lite",
    "conjure",
    "obfs3",
    "obfs2",
    "scramblesuit",
];

/// Мост без транспорта: `IP:порт [отпечаток]`.
pub const VANILLA: &str = "vanilla";

const MAX_LINE_LEN: usize = 2048;
/// Больше мостов Tor всё равно не перебирает с пользой, а torrc не раздувается.
pub const MAX_BRIDGES: usize = 64;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BridgeLine {
    /// Транспорт (`obfs4`, `webtunnel`…) или `vanilla`.
    pub transport: String,
    /// Строка без префикса `Bridge`, токены через один пробел.
    pub line: String,
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct ParsedBridges {
    pub bridges: Vec<BridgeLine>,
    /// Строки, которые на мост не похожи, — как их ввели (обрезаны до 200 символов).
    pub rejected: Vec<String>,
}

impl ParsedBridges {
    pub fn lines(&self) -> Vec<String> {
        self.bridges.iter().map(|b| b.line.clone()).collect()
    }
}

/// Разбирает список строк; в одном элементе может быть несколько строк.
/// Пустые и `#`-комментарии пропускаются, повторы схлопываются.
pub fn parse_lines<S: AsRef<str>>(input: &[S]) -> ParsedBridges {
    let mut out = ParsedBridges::default();
    for chunk in input {
        for raw in chunk.as_ref().lines() {
            match parse_line(raw) {
                Ok(None) => {}
                Ok(Some(bridge)) => {
                    let duplicate = out.bridges.iter().any(|b| b.line == bridge.line);
                    if !duplicate && out.bridges.len() < MAX_BRIDGES {
                        out.bridges.push(bridge);
                    }
                }
                Err(()) => out.rejected.push(raw.trim().chars().take(200).collect()),
            }
        }
    }
    out
}

/// `Ok(None)` — пустая строка или комментарий, `Err` — не мост.
pub fn parse_line(raw: &str) -> Result<Option<BridgeLine>, ()> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return Ok(None);
    }
    if trimmed.len() > MAX_LINE_LEN {
        return Err(());
    }

    // `split_whitespace` режет и по неразрывному пробелу из Telegram, и по
    // табуляции, и по переводу строки — в собранной строке их уже не будет.
    let mut tokens: Vec<&str> = trimmed.split_whitespace().collect();
    if tokens
        .first()
        .is_some_and(|t| t.eq_ignore_ascii_case("bridge"))
    {
        tokens.remove(0);
    }
    if tokens.is_empty()
        || tokens
            .iter()
            .any(|t| !t.chars().all(|c| c.is_ascii_graphic()) || t.contains('#'))
    {
        return Err(());
    }

    if is_addr_port(tokens[0]) {
        // Обычный мост: адрес и, по желанию, отпечаток.
        let ok = match tokens.len() {
            1 => true,
            2 => is_fingerprint(tokens[1]),
            _ => false,
        };
        return if ok {
            Ok(Some(BridgeLine {
                transport: VANILLA.into(),
                line: tokens.join(" "),
            }))
        } else {
            Err(())
        };
    }

    let transport = match tokens[0].to_ascii_lowercase().as_str() {
        "meek" => "meek_lite".to_string(),
        t if KNOWN_TRANSPORTS.contains(&t) => t.to_string(),
        _ => return Err(()),
    };
    if tokens.len() < 2 || !is_addr_port(tokens[1]) {
        return Err(());
    }
    for (i, token) in tokens.iter().enumerate().skip(2) {
        let fingerprint = i == 2 && is_fingerprint(token);
        let arg = token.split_once('=').is_some_and(|(k, _)| {
            !k.is_empty()
                && k.chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        });
        if !fingerprint && !arg {
            return Err(());
        }
    }

    let mut parts = vec![transport.as_str()];
    parts.extend(&tokens[1..]);
    Ok(Some(BridgeLine {
        line: parts.join(" "),
        transport,
    }))
}

/// Как назвать набор мостов в меню: один транспорт — им, разные — `custom`.
pub fn label_for(bridges: &[BridgeLine]) -> String {
    match bridges.first() {
        Some(first) if bridges.iter().all(|b| b.transport == first.transport) => {
            match first.transport.as_str() {
                "meek_lite" => "meek".into(),
                other => other.into(),
            }
        }
        _ => "custom".into(),
    }
}

/// `1.2.3.4:443` или `[2001:db8::1]:443`; имена хостов Tor в мостах не принимает.
fn is_addr_port(token: &str) -> bool {
    token.parse::<SocketAddr>().is_ok_and(|a| a.port() != 0)
}

fn is_fingerprint(token: &str) -> bool {
    token.len() == 40 && token.chars().all(|c| c.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;

    const OBFS4: &str = "obfs4 37.218.245.14:38224 D9A82D2F9C2F65A18407B1D2B764F130847F8B5D cert=bjRaMrr1BRiAW8IE9U5z27fQaYgOhX1UCmOpg2pFpoMvo6ZgQMzLsaTzzQNTlm7hNcb+Sg iat-mode=0";
    const WEBTUNNEL: &str = "webtunnel [2001:db8:a360:a7ae:fada:eb77:8706:c0f3]:443 DF82B4001F68C2312CB01762E8AE203EB9F1FF54 url=https://webtunnel.giacento.com ver=0.0.5";
    const MEEK: &str = "meek_lite 192.0.2.20:80 url=https://1603026938.rsc.cdn77.org front=www.phpmyadmin.net utls=HelloRandomizedALPN";

    fn one(raw: &str) -> BridgeLine {
        parse_line(raw).expect("valid").expect("not empty")
    }

    #[test]
    fn every_transport_from_bots_and_moat_is_accepted() {
        assert_eq!(one(OBFS4).transport, "obfs4");
        assert_eq!(one(WEBTUNNEL).transport, "webtunnel");
        assert_eq!(one(WEBTUNNEL).line, WEBTUNNEL);
        assert_eq!(one(MEEK).transport, "meek_lite");
        let snowflake = one("snowflake 192.0.2.3:80 2B280B23E1107BB62ABFC40DDCC8824814F80A72 fingerprint=2B280B23E1107BB62ABFC40DDCC8824814F80A72 url=https://1098762253.rsc.cdn77.org fronts=cdn.zk.mk,img.icons8.com ice=stun:stun.antisip.com:3478 utls-imitate=hellorandomizedalpn");
        assert_eq!(snowflake.transport, "snowflake");
        let vanilla = one("185.220.101.1:9001 0123456789ABCDEF0123456789ABCDEF01234567");
        assert_eq!(vanilla.transport, VANILLA);
    }

    #[test]
    fn prefix_spacing_and_old_meek_name_are_normalized() {
        let b = one("  Bridge\u{a0}obfs4\t37.218.245.14:38224   D9A82D2F9C2F65A18407B1D2B764F130847F8B5D cert=x iat-mode=0 ");
        assert_eq!(
            b.line,
            "obfs4 37.218.245.14:38224 D9A82D2F9C2F65A18407B1D2B764F130847F8B5D cert=x iat-mode=0"
        );
        assert_eq!(
            one("meek 192.0.2.20:80 url=https://a.example front=b.example").transport,
            "meek_lite"
        );
        assert_eq!(
            one("OBFS4 1.2.3.4:443 cert=x").line,
            "obfs4 1.2.3.4:443 cert=x"
        );
    }

    /// Перевод строки внутри элемента — это две строки, а не продолжение
    /// моста: дописать директиву в torrc нельзя.
    #[test]
    fn torrc_directives_cannot_be_injected() {
        let parsed = parse_lines(&[format!("{OBFS4}\nControlPort 9999\nSocksPort 0.0.0.0:9050")]);
        assert_eq!(parsed.lines(), vec![OBFS4.to_string()]);
        assert_eq!(parsed.rejected.len(), 2);
        // Одиночный `\r` строку не делит, но и мостом её не делает.
        assert!(parse_line(&format!("{OBFS4}\rControlPort 9999")).is_err());
        for bridge in &parsed.bridges {
            assert!(!bridge.line.contains('\n') && !bridge.line.contains('\r'));
        }
        assert!(parse_line("obfs4 1.2.3.4:443 cert=x\u{0}").is_err());
        assert!(parse_line("obfs4 1.2.3.4:443 cert=x # comment").is_err());
    }

    #[test]
    fn non_bridges_are_rejected() {
        for bad in [
            "hello world",
            "obfs4",
            "obfs4 example.com:443 cert=x",
            "obfs4 1.2.3.4 cert=x",
            "obfs4 1.2.3.4:0 cert=x",
            "unknownpt 1.2.3.4:443 x=y",
            "obfs4 1.2.3.4:443 notakeyvalue",
            "1.2.3.4:443 FINGERPRINT extra",
            "obfs4 1.2.3.4:443 cert=кириллица",
        ] {
            assert!(parse_line(bad).is_err(), "{bad} must be rejected");
        }
    }

    #[test]
    fn list_skips_blanks_comments_and_duplicates() {
        let parsed = parse_lines(&[
            "# from @GetBridgesBot".to_string(),
            String::new(),
            OBFS4.to_string(),
            format!("Bridge {OBFS4}"),
            WEBTUNNEL.to_string(),
            "garbage".to_string(),
        ]);
        assert_eq!(
            parsed.lines(),
            vec![OBFS4.to_string(), WEBTUNNEL.to_string()]
        );
        assert_eq!(parsed.rejected, vec!["garbage".to_string()]);
        assert_eq!(label_for(&parsed.bridges), "custom");
        assert_eq!(label_for(&parsed.bridges[..1]), "obfs4");
        assert_eq!(label_for(&[one(MEEK)]), "meek");
    }

    #[test]
    fn list_is_capped() {
        let many: Vec<String> = (1..=100)
            .map(|i| format!("obfs4 10.0.0.{i}:443 cert=x"))
            .collect();
        assert_eq!(parse_lines(&many).bridges.len(), MAX_BRIDGES);
    }
}
