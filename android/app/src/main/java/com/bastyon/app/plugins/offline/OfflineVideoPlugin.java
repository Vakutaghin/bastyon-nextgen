package com.bastyon.app.plugins.offline;

import androidx.annotation.Nullable;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Скачанные ролики для страницы (src/services/offline-video/android-backend.ts):
 * те же команды и события, что у компьютера ({@code offline_*},
 * {@code offline://*}), вид — {@code OfflineBackend} в types.ts.
 *
 * <pre>
 *   list()                      → { items: [{ id, meta, state }] }
 *   enqueue({ job, meta })      → item (уже есть — как есть)
 *   pause / resume / remove({ id })
 *   patchMeta({ id, patch })    → item
 *   usage()                     → { used, free } (free: null — не узнать)
 *   clear()
 *   nativePath({ id })          → { path? } — для ExoPlayer: playlist.m3u8, если
 *                                 он есть и годен, иначе video.mp4
 *   setWifiOnly({ on })
 * </pre>
 * События: {@code progress} {@code {id, received, total}} не чаще 4 раз в
 * секунду, {@code changed} {@code {id, item}} ({@code item: null} — удалён).
 * Ошибки — код в сообщении и в {@code code}: {@code invalid_id},
 * {@code not_found}, {@code invalid_sources}, {@code invalid_extras},
 * {@code invalid_meta}, {@code invalid_patch}, {@code invalid_job}, {@code io}.
 *
 * Файлы странице отдаёт OfflineWebViewClient: {@code /_offline_/<id>/<файл>}.
 * Разрешение на уведомления (alias {@code notifications}) объявлено, как у
 * BackgroundMedia, но само не запрашивается.
 */
@CapacitorPlugin(
        name = "OfflineVideo",
        permissions = {
                @Permission(strings = {"android.permission.POST_NOTIFICATIONS"}, alias = "notifications")
        }
)
public class OfflineVideoPlugin extends Plugin {
    /** Диск — не в потоке плагинов Capacitor: «Удалить всё» на гигабайтах не держит остальных. */
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private OfflineManager manager;

    private final OfflineManager.Listener listener = new OfflineManager.Listener() {
        @Override
        public void onProgress(String id, long received, long total) {
            JSObject ev = new JSObject();
            ev.put("id", id);
            ev.put("received", received);
            ev.put("total", total);
            notifyListeners("progress", ev);
        }

        @Override
        public void onChanged(String id, @Nullable JSONObject item) {
            JSObject ev = new JSObject();
            ev.put("id", id);
            ev.put("item", item != null ? item : JSONObject.NULL);
            notifyListeners("changed", ev);
        }
    };

    @Override
    public void load() {
        super.load();
        manager = OfflineManager.get(getContext());
        manager.addListener(listener);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        io.execute(() -> manager.onForeground());
    }

    @Override
    protected void handleOnDestroy() {
        if (manager != null) manager.removeListener(listener);
        io.shutdown();
        super.handleOnDestroy();
    }

    private interface Work {
        void run(PluginCall call) throws Exception;
    }

    private void work(PluginCall call, Work w) {
        io.execute(() -> {
            try {
                w.run(call);
            } catch (OfflineStore.OfflineException e) {
                call.reject(e.code, e.code);
            } catch (Exception e) {
                call.reject("io", "io", e);
            }
        });
    }

    private static JSObject obj(JSONObject o) throws JSONException {
        return JSObject.fromJSONObject(o);
    }

    private static String id(PluginCall call) throws OfflineStore.OfflineException {
        String id = call.getString("id");
        if (!OfflineStore.validId(id)) throw new OfflineStore.OfflineException("invalid_id");
        return id;
    }

    @PluginMethod
    public void list(PluginCall call) {
        work(call, c -> {
            JSArray items = new JSArray();
            for (JSONObject item : manager.list()) items.put(item);
            JSObject ret = new JSObject();
            ret.put("items", items);
            c.resolve(ret);
        });
    }

    @PluginMethod
    public void enqueue(PluginCall call) {
        work(call, c -> {
            JSONObject data = c.getData();
            OfflineStore.Job job = OfflineStore.parseJob(data.optJSONObject("job"));
            if (job == null) throw new OfflineStore.OfflineException("invalid_job");
            JSONObject meta = data.optJSONObject("meta");
            if (meta == null) throw new OfflineStore.OfflineException("invalid_meta");
            c.resolve(obj(manager.enqueue(job, meta)));
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        work(call, c -> {
            manager.pause(id(c));
            c.resolve();
        });
    }

    @PluginMethod
    public void resume(PluginCall call) {
        work(call, c -> {
            manager.resume(id(c));
            c.resolve();
        });
    }

    @PluginMethod
    public void remove(PluginCall call) {
        work(call, c -> {
            manager.remove(id(c));
            c.resolve();
        });
    }

    @PluginMethod
    public void patchMeta(PluginCall call) {
        work(call, c -> {
            String id = id(c);
            JSONObject patch = c.getData().optJSONObject("patch");
            if (patch == null) throw new OfflineStore.OfflineException("invalid_patch");
            c.resolve(obj(manager.patchMeta(id, patch)));
        });
    }

    @PluginMethod
    public void usage(PluginCall call) {
        work(call, c -> {
            JSObject ret = new JSObject();
            ret.put("used", manager.used());
            long free = manager.free();
            ret.put("free", free >= 0 ? (Object) free : JSONObject.NULL);
            c.resolve(ret);
        });
    }

    @PluginMethod
    public void clear(PluginCall call) {
        work(call, c -> {
            manager.clear();
            c.resolve();
        });
    }

    @PluginMethod
    public void nativePath(PluginCall call) {
        work(call, c -> {
            String path = manager.nativePath(id(c));
            JSObject ret = new JSObject();
            if (path != null) ret.put("path", path);
            c.resolve(ret);
        });
    }

    @PluginMethod
    public void setWifiOnly(PluginCall call) {
        work(call, c -> {
            Boolean on = c.getBoolean("on", true);
            manager.setWifiOnly(on == null || on);
            c.resolve();
        });
    }
}
