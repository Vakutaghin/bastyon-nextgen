//! Куда радио-слою можно подключаться по TCP.
//!
//! Радио по Wi-Fi (MeshCore на ESP32, `meshtasticd` на Raspberry Pi) живёт в
//! локальной сети. Публичные адреса запрещены: иначе команда подключения стала
//! бы прямым TCP мимо Tor — в режиме Tor приложение не должно ходить в интернет
//! напрямую ни при каких условиях. Имя узла — только `localhost` и mDNS
//! (`*.local`), и после разрешения каждый адрес снова проверяется: имя в
//! `.local` не должно увести на публичный адрес.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

/// Адрес в пределах этого компьютера или локальной сети.
pub fn is_lan_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_lan_v4(v4),
        IpAddr::V6(v6) => {
            // IPv4, упакованный в IPv6 (::ffff:a.b.c.d), проверяется как IPv4.
            if let Some(v4) = v6.to_ipv4_mapped() {
                return is_lan_v4(v4);
            }
            is_lan_v6(v6)
        }
    }
}

fn is_lan_v4(ip: Ipv4Addr) -> bool {
    let [a, b, ..] = ip.octets();
    ip.is_loopback()
        || ip.is_private()
        || ip.is_link_local()
        // 100.64.0.0/10 — общее пространство провайдеров и оверлейных сетей
        // (Tailscale): в интернет напрямую не маршрутизируется.
        || (a == 100 && (64..=127).contains(&b))
}

fn is_lan_v6(ip: Ipv6Addr) -> bool {
    let first = ip.segments()[0];
    ip.is_loopback()
        // fc00::/7 — уникальные локальные адреса.
        || (first & 0xfe00) == 0xfc00
        // fe80::/10 — адреса канала.
        || (first & 0xffc0) == 0xfe80
}

/// Что стоит в поле «адрес»: IP-адрес или имя, которое ещё надо разрешить.
#[derive(Debug, PartialEq, Eq)]
pub enum TcpTarget {
    Ip(IpAddr),
    Name(String),
}

/// Разбирает адрес из интерфейса. `Err` — адрес вне локальной сети или не адрес.
pub fn parse_target(host: &str) -> Result<TcpTarget, String> {
    let host = host.trim();
    // IPv6 в квадратных скобках — как его пишут в URL.
    let bare = host
        .strip_prefix('[')
        .and_then(|h| h.strip_suffix(']'))
        .unwrap_or(host);
    if let Ok(ip) = bare.parse::<IpAddr>() {
        return if is_lan_ip(ip) {
            Ok(TcpTarget::Ip(ip))
        } else {
            Err(format!("address_not_allowed: {bare}"))
        };
    }
    let name = bare.trim_end_matches('.').to_ascii_lowercase();
    let valid = !name.is_empty()
        && name.len() <= 253
        && name
            .split('.')
            .all(|label| {
                !label.is_empty()
                    && label.len() <= 63
                    && label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
                    && !label.starts_with('-')
                    && !label.ends_with('-')
            });
    if !valid {
        return Err(format!("bad_address: {host}"));
    }
    if name == "localhost" || name.ends_with(".local") {
        Ok(TcpTarget::Name(name))
    } else {
        Err(format!("address_not_allowed: {name}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ip(s: &str) -> IpAddr {
        s.parse().unwrap()
    }

    #[test]
    fn lan_addresses_are_allowed() {
        for s in [
            "127.0.0.1",
            "10.1.2.3",
            "172.16.0.9",
            "172.31.255.1",
            "192.168.4.1",
            "169.254.10.20",
            "100.64.0.1",
            "100.127.255.254",
            "::1",
            "fd12:3456::1",
            "fe80::1",
            "::ffff:192.168.1.5",
        ] {
            assert!(is_lan_ip(ip(s)), "{s}");
        }
    }

    #[test]
    fn public_addresses_are_refused() {
        for s in [
            "8.8.8.8",
            "172.32.0.1",
            "100.128.0.1",
            "1.1.1.1",
            "2001:4860:4860::8888",
            "::ffff:8.8.8.8",
            "0.0.0.0",
        ] {
            assert!(!is_lan_ip(ip(s)), "{s}");
        }
    }

    #[test]
    fn targets_are_parsed_and_checked() {
        assert_eq!(parse_target("192.168.1.7"), Ok(TcpTarget::Ip(ip("192.168.1.7"))));
        assert_eq!(parse_target(" [fe80::2] "), Ok(TcpTarget::Ip(ip("fe80::2"))));
        assert_eq!(
            parse_target("MeshCore-1.local."),
            Ok(TcpTarget::Name("meshcore-1.local".into()))
        );
        assert_eq!(parse_target("localhost"), Ok(TcpTarget::Name("localhost".into())));
        assert!(parse_target("8.8.4.4").unwrap_err().starts_with("address_not_allowed"));
        assert!(parse_target("example.com").unwrap_err().starts_with("address_not_allowed"));
        assert!(parse_target("").unwrap_err().starts_with("bad_address"));
        assert!(parse_target("bad host.local").unwrap_err().starts_with("bad_address"));
        assert!(parse_target("-x.local").unwrap_err().starts_with("bad_address"));
    }
}
