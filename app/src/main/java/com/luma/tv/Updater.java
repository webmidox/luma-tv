package com.luma.tv;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Downloads a new APK from the owner's own release address and hands it to Android's installer. */
final class Updater {
    private static volatile boolean busy;

    private Updater() {}

    static void start(MainActivity a, String apkUrl) {
        if (busy) return;
        if (apkUrl == null || !apkUrl.startsWith("https://")) {
            a.status("Ongeldige update-link");
            return;
        }
        if (!a.getPackageManager().canRequestPackageInstalls()) {
            a.status("Sta eerst installeren uit deze app toe, kom dan terug en probeer opnieuw");
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.getPackageName()));
            a.startActivity(i);
            return;
        }
        busy = true;
        new Thread(() -> {
            try {
                File dir = new File(a.getCacheDir(), "updates");
                dir.mkdirs();
                File out = new File(dir, "luma-update.apk");
                a.status("Downloaden…");
                HttpURLConnection c = (HttpURLConnection) new URL(apkUrl).openConnection();
                c.setConnectTimeout(15000);
                c.setReadTimeout(30000);
                if (c.getResponseCode() != 200) throw new Exception("Server antwoordde " + c.getResponseCode());
                long total = c.getContentLengthLong();
                long done = 0;
                int lastPct = -1;
                try (InputStream in = c.getInputStream(); FileOutputStream os = new FileOutputStream(out)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        os.write(buf, 0, n);
                        done += n;
                        if (total > 0) {
                            int pct = (int) (done * 100 / total);
                            if (pct / 10 != lastPct / 10) {
                                lastPct = pct;
                                a.status("Downloaden… " + pct + "%");
                            }
                        }
                    }
                }
                if (out.length() < 100000) throw new Exception("Bestand is te klein om een app te zijn");
                Uri uri = FileProvider.getUriForFile(a, "com.luma.tv.files", out);
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, "application/vnd.android.package-archive");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                a.status("Installeren…");
                a.startActivity(i);
            } catch (Exception e) {
                a.status("Update mislukt: " + e.getMessage());
            } finally {
                busy = false;
            }
        }, "luma-update").start();
    }
}
