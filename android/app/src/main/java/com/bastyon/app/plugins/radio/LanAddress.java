package com.bastyon.app.plugins.radio;

import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;

/**
 * Радио по Wi-Fi — только в локальной сети, как на десктопе
 * (src-tauri/src/radio/addr.rs): иначе приложение стало бы прокси во внешний
 * интернет, в том числе в режиме Tor.
 */
final class LanAddress {
    private LanAddress() {}

    static boolean isLan(InetAddress a) {
        if (a.isLoopbackAddress() || a.isSiteLocalAddress() || a.isLinkLocalAddress()) return true;
        byte[] b = a.getAddress();
        if (a instanceof Inet4Address) {
            int x = b[0] & 0xff;
            int y = b[1] & 0xff;
            return x == 100 && y >= 64 && y <= 127; // CGNAT 100.64/10
        }
        if (a instanceof Inet6Address) {
            return (b[0] & 0xfe) == 0xfc; // ULA fc00::/7
        }
        return false;
    }
}
