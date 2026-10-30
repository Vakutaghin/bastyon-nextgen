package com.bastyon.app.plugins;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.bastyon.app.plugins.tor.TorNetwork;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Обновление изнутри приложения на Android (src/helpers/updates/android-update.ts).
 *
 *   download({ url, sha256, size }) — скачивает APK релиза в кэш, по ходу шлёт
 *       события `progress` { received, total }. Файл принимается, только если
 *       совпали размер и SHA-256 (их отдаёт GitHub у файла релиза), это наш
 *       пакет, его версия новее установленной и он подписан тем же ключом.
 *       Android и сам не поставит чужую подпись поверх, но тогда человек увидел
 *       бы невнятный отказ установщика, а не наше объяснение.
 *   install({ path }) — отдаёт файл системному установщику. Без разрешения
 *       «Установка неизвестных приложений» сначала открывает его экран в
 *       настройках и продолжает, когда человек вернулся. Тихо обновить себя
 *       приложение не может: подтверждает человек. Установщик завершает старый
 *       процесс, и вызов не возвращается; если же он вернулся — обновление не
 *       поставили (отмена или ошибка), и в JS остаётся «Обновить» ещё раз.
 *
 * Установка — интентом ACTION_INSTALL_PACKAGE, а не сессией PackageInstaller:
 * после обновления системный установщик показывает «Открыть», и новая версия
 * запускается одним нажатием, а сессия оставила бы человека на рабочем столе.
 *
 * Коды ошибок: busy, network, size, hash, package, not_newer, signature,
 * storage, permission, no_installer.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private static final String DIR = "updates";
    private static final int CONNECT_TIMEOUT_MS = 20_000;
    private static final int READ_TIMEOUT_MS = 30_000;
    private static final long PROGRESS_INTERVAL_MS = 250;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean downloading = new AtomicBoolean(false);

    @Override
    public void load() {
        super.load();
        // Скачанный при прошлом запуске APK больше не нужен: либо он уже стоит,
        // либо человек отказался, и при следующей попытке скачаем заново.
        executor.execute(() -> deleteDir(updatesDir()));
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    // ─── Скачивание ───────────────────────────────────────────────────────

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        String sha256 = call.getString("sha256");
        // getLong отдаёт значение по умолчанию, если число пришло из JS как
        // Integer (любой APK меньше 2 ГБ), — проверка размера молча выключалась.
        long size = call.getData().optLong("size", 0L);
        if (url == null || !url.startsWith("https://")) {
            call.reject("network: bad url", "network");
            return;
        }
        if (sha256 == null || !sha256.matches("[0-9a-f]{64}")) {
            call.reject("hash: no sha256", "hash");
            return;
        }
        if (!downloading.compareAndSet(false, true)) {
            call.reject("busy: download in progress", "busy");
            return;
        }
        executor.execute(() -> {
            try {
                File apk = fetch(url, size, sha256);
                verifyApk(apk);
                JSObject ret = new JSObject();
                ret.put("path", apk.getAbsolutePath());
                call.resolve(ret);
            } catch (UpdateException e) {
                call.reject(e.getMessage(), e.code);
            } catch (Exception e) {
                call.reject("storage: " + e.getMessage(), "storage");
            } finally {
                downloading.set(false);
            }
        });
    }

    private File fetch(String url, long expectedSize, String expectedSha256) throws Exception {
        File dir = updatesDir();
        deleteDir(dir);
        if (!dir.mkdirs() && !dir.isDirectory()) throw new UpdateException("storage", "storage: no cache dir");
        File part = new File(dir, "update.apk.part");
        File apk = new File(dir, "update.apk");

        HttpURLConnection conn;
        try {
            // github.com отвечает переадресацией на хранилище файлов — тоже https.
            conn = (HttpURLConnection) new URL(url).openConnection(TorNetwork.proxy());
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            conn.setRequestProperty("Accept", "application/octet-stream");
            int status = conn.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) {
                conn.disconnect();
                throw new UpdateException("network", "network: HTTP " + status);
            }
        } catch (IOException e) {
            throw new UpdateException("network", "network: " + e.getMessage());
        }

        long total = expectedSize > 0 ? expectedSize : conn.getContentLengthLong();
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long received = 0;
        long lastEvent = 0;
        try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(part)) {
            byte[] buffer = new byte[64 * 1024];
            int n;
            while ((n = in.read(buffer)) != -1) {
                if (Thread.currentThread().isInterrupted()) throw new UpdateException("network", "network: interrupted");
                out.write(buffer, 0, n);
                digest.update(buffer, 0, n);
                received += n;
                long now = System.currentTimeMillis();
                if (now - lastEvent >= PROGRESS_INTERVAL_MS) {
                    lastEvent = now;
                    emitProgress(received, total);
                }
            }
        } catch (UpdateException e) {
            throw e;
        } catch (IOException e) {
            // Обрыв сети и нехватка места выглядят одинаково — IOException;
            // место проверяем отдельно, чтобы сказать понятнее.
            String code = dir.getUsableSpace() < Math.max(total, 1) ? "storage" : "network";
            throw new UpdateException(code, code + ": " + e.getMessage());
        } finally {
            conn.disconnect();
        }
        emitProgress(received, total);

        if (expectedSize > 0 && received != expectedSize) {
            throw new UpdateException("size", "size: got " + received + ", expected " + expectedSize);
        }
        String actual = hex(digest.digest());
        if (!actual.equals(expectedSha256)) {
            throw new UpdateException("hash", "hash: got " + actual);
        }
        if (!part.renameTo(apk)) throw new UpdateException("storage", "storage: rename failed");
        return apk;
    }

    private void emitProgress(long received, long total) {
        JSObject ev = new JSObject();
        ev.put("received", received);
        ev.put("total", Math.max(total, 0));
        notifyListeners("progress", ev);
    }

    // ─── Проверка скачанного ──────────────────────────────────────────────

    @SuppressWarnings("deprecation")
    private void verifyApk(File apk) throws Exception {
        Context ctx = getContext();
        PackageManager pm = ctx.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? PackageManager.GET_SIGNING_CERTIFICATES
                : PackageManager.GET_SIGNATURES;
        PackageInfo archive = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        if (archive == null) throw new UpdateException("package", "package: not an apk");
        if (!ctx.getPackageName().equals(archive.packageName)) {
            throw new UpdateException("package", "package: " + archive.packageName);
        }
        PackageInfo installed = pm.getPackageInfo(ctx.getPackageName(), flags);
        if (versionCode(archive) <= versionCode(installed)) {
            throw new UpdateException("not_newer", "not_newer: " + archive.versionName);
        }
        Set<String> theirs = signers(archive);
        if (theirs.isEmpty() || !theirs.equals(signers(installed))) {
            throw new UpdateException("signature", "signature: signed by another key");
        }
    }

    @SuppressWarnings("deprecation")
    private static long versionCode(PackageInfo info) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
    }

    /** SHA-256 сертификатов, которыми подписан пакет сейчас. */
    @SuppressWarnings("deprecation")
    private static Set<String> signers(PackageInfo info) throws Exception {
        Signature[] sigs;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            sigs = info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners();
        } else {
            sigs = info.signatures;
        }
        Set<String> out = new HashSet<>();
        if (sigs == null) return out;
        for (Signature s : sigs) {
            out.add(hex(MessageDigest.getInstance("SHA-256").digest(s.toByteArray())));
        }
        return out;
    }

    // ─── Установка ────────────────────────────────────────────────────────

    @PluginMethod
    public void install(PluginCall call) {
        File apk = apkFrom(call);
        if (apk == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            try {
                startActivityForResult(call, settings, "afterInstallPermission");
            } catch (Exception e) {
                call.reject("permission: " + e.getMessage(), "permission");
            }
            return;
        }
        launchInstaller(call, apk);
    }

    @ActivityCallback
    private void afterInstallPermission(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            call.reject("permission: install unknown apps is off", "permission");
            return;
        }
        File apk = apkFrom(call);
        if (apk != null) launchInstaller(call, apk);
    }

    @SuppressWarnings("deprecation")
    private void launchInstaller(PluginCall call, File apk) {
        Context ctx = getContext();
        Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
        // ACTION_INSTALL_PACKAGE открывает только системный установщик, а не
        // любой файловый менеджер, который тоже умеет «открыть .apk». Запуск
        // «для результата» сообщает установщику, кто просит: разрешение на
        // установку он сверяет именно у вызвавшего приложения.
        Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE)
                .setData(uri)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            startActivityForResult(call, intent, "afterInstaller");
        } catch (Exception e) {
            call.reject("no_installer: " + e.getMessage(), "no_installer");
        }
    }

    /** Установщик закрылся, а мы живы — значит, новую версию не поставили. */
    @ActivityCallback
    private void afterInstaller(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject ret = new JSObject();
        ret.put("status", "not_installed");
        call.resolve(ret);
    }

    private File apkFrom(PluginCall call) {
        String path = call.getString("path");
        File dir = updatesDir();
        File apk = path == null ? null : new File(path);
        // Только то, что скачали мы сами: путь из JS не должен указывать куда угодно.
        if (apk == null || !apk.isFile() || !dir.equals(apk.getParentFile())) {
            call.reject("package: no downloaded update", "package");
            return null;
        }
        return apk;
    }

    // ─── Мелочи ───────────────────────────────────────────────────────────

    private File updatesDir() {
        return new File(getContext().getCacheDir(), DIR);
    }

    private static void deleteDir(File dir) {
        File[] files = dir.listFiles();
        if (files != null) {
            for (File f : files) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
        }
        //noinspection ResultOfMethodCallIgnored
        dir.delete();
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format(Locale.ROOT, "%02x", b));
        return sb.toString();
    }

    private static final class UpdateException extends Exception {
        final String code;

        UpdateException(String code, String message) {
            super(message);
            this.code = code;
        }
    }
}
