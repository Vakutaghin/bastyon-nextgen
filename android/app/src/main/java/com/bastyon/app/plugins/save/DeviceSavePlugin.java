package com.bastyon.app.plugins.save;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.util.Base64;
import android.webkit.MimeTypeMap;

import androidx.activity.result.ActivityResult;

import com.bastyon.app.plugins.offline.OfflineExport;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Сохранить файл на телефон (src/helpers/common/device-save.ts). Android 10+
 * — сразу в «Загрузки», папка {@code Download/Bastyon}, через MediaStore и
 * без разрешений; Android 7–9 — системное окно «Сохранить как». Раньше файл
 * уходил в «Поделиться», а там у Android нет пункта «Сохранить» — только
 * приложения, куда отправить.
 *
 * <pre>
 *   begin({ name })            → { token } | { cancelled: true }
 *   append({ token, data })    — кусок файла в base64
 *   finish({ token })          → { name, folder } (folder: null после окна)
 *   abort({ token })           — недописанный файл удаляется
 *   saveOffline({ id, name })  → { name, folder } | { cancelled: true } —
 *                                скачанный ролик копируется с диска, мимо моста
 * </pre>
 * Ошибки — код в сообщении и в {@code code}: {@code not_found} (ролик не
 * скачан), {@code unknown_session}, {@code io}.
 */
@CapacitorPlugin(name = "DeviceSave")
public class DeviceSavePlugin extends Plugin {
    /** Своя папка в «Загрузках»: файлы приложения не смешиваются с остальными. */
    static final String FOLDER = Environment.DIRECTORY_DOWNLOADS + "/Bastyon";

    /** Диск — не в потоке плагинов Capacitor: копия большого ролика не держит остальных. */
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final SaveSessions sessions = new SaveSessions();

    @Override
    protected void handleOnDestroy() {
        io.execute(sessions::abortAll);
        io.shutdown();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void begin(PluginCall call) {
        String name = SaveSessions.cleanName(call.getString("name"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            work(call, () -> started(call, DownloadsTarget.create(resolver(), name, mimeOf(name), FOLDER)));
        } else {
            pick(call, name);
        }
    }

    @PluginMethod
    public void append(PluginCall call) {
        String token = call.getString("token");
        String data = call.getString("data", "");
        work(call, () -> {
            sessions.append(token, Base64.decode(data, Base64.DEFAULT));
            call.resolve();
        });
    }

    @PluginMethod
    public void finish(PluginCall call) {
        String token = call.getString("token");
        work(call, () -> saved(call, sessions.finish(token)));
    }

    @PluginMethod
    public void abort(PluginCall call) {
        String token = call.getString("token");
        work(call, () -> {
            sessions.abort(token);
            call.resolve();
        });
    }

    @PluginMethod
    public void saveOffline(PluginCall call) {
        File video = OfflineExport.finishedVideo(getContext(), call.getString("id"));
        if (video == null) {
            call.reject("not_found", "not_found");
            return;
        }
        String name = SaveSessions.cleanName(call.getString("name"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            work(call, () -> saved(call,
                    SaveSessions.copy(video, DownloadsTarget.create(resolver(), name, mimeOf(name), FOLDER))));
        } else {
            pick(call, name);
        }
    }

    /** Android 7–9: окно «Сохранить как»; дальше — в {@link #picked}. */
    private void pick(PluginCall call, String name) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType(mimeOf(name))
                .putExtra(Intent.EXTRA_TITLE, name);
        getActivity().runOnUiThread(() -> startActivityForResult(call, intent, "picked"));
    }

    @ActivityCallback
    private void picked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = result.getData() != null ? result.getData().getData() : null;
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
            return;
        }
        String name = SaveSessions.cleanName(call.getString("name"));
        DocumentTarget target = new DocumentTarget(resolver(), uri, name);
        if ("saveOffline".equals(call.getMethodName())) {
            File video = OfflineExport.finishedVideo(getContext(), call.getString("id"));
            if (video == null) {
                target.discard();
                call.reject("not_found", "not_found");
                return;
            }
            work(call, () -> saved(call, SaveSessions.copy(video, target)));
        } else {
            work(call, () -> started(call, target));
        }
    }

    private void started(PluginCall call, SaveSessions.Target target) throws Exception {
        JSObject res = new JSObject();
        res.put("token", sessions.start(target));
        call.resolve(res);
    }

    private static void saved(PluginCall call, SaveSessions.Saved saved) {
        JSObject res = new JSObject();
        res.put("name", saved.name);
        res.put("folder", saved.folder != null ? saved.folder : JSONObject.NULL);
        call.resolve(res);
    }

    private interface Step {
        void run() throws Exception;
    }

    private void work(PluginCall call, Step step) {
        io.execute(() -> {
            try {
                step.run();
            } catch (SaveSessions.UnknownSession e) {
                call.reject("unknown_session", "unknown_session");
            } catch (Exception e) {
                call.reject("io", "io", e);
            }
        });
    }

    private ContentResolver resolver() {
        return getContext().getContentResolver();
    }

    /** Тип по расширению: по нему MediaStore и окно «Сохранить как» держат расширение. */
    static String mimeOf(String name) {
        int dot = name.lastIndexOf('.');
        String ext = dot >= 0 ? name.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
        String mime = ext.isEmpty() ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return mime != null ? mime : "application/octet-stream";
    }
}
