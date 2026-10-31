package com.bastyon.app.plugins.offline;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

import java.io.File;
import java.util.Map;

/**
 * Клиент WebView Capacitor плюс скачанные ролики: адреса
 * {@code https://localhost/_offline_/<id>/<файл>} отвечает {@link OfflineFiles}
 * из папки ролика, с честным Range. Всё остальное — как у Capacitor.
 * Ставится в MainActivity после {@code super.onCreate}.
 */
public class OfflineWebViewClient extends BridgeWebViewClient {
    private final File root;
    private final String scheme;
    private final String host;

    public OfflineWebViewClient(Bridge bridge) {
        super(bridge);
        root = OfflineStore.root(bridge.getContext());
        scheme = bridge.getScheme();
        host = bridge.getHost();
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        String path = url != null ? url.getPath() : null;
        if (path != null && path.startsWith(OfflineFiles.PREFIX)
                && scheme.equalsIgnoreCase(url.getScheme())
                && host.equalsIgnoreCase(url.getHost())) {
            OfflineFiles.Response r = OfflineFiles.respond(root, path, request.getMethod(), header(request, "Range"));
            return new WebResourceResponse(r.mime, r.encoding, r.status, r.reason, r.headers, r.body);
        }
        return super.shouldInterceptRequest(view, request);
    }

    private static String header(WebResourceRequest request, String name) {
        Map<String, String> headers = request.getRequestHeaders();
        if (headers == null) return null;
        for (Map.Entry<String, String> e : headers.entrySet()) {
            if (name.equalsIgnoreCase(e.getKey())) return e.getValue();
        }
        return null;
    }
}
