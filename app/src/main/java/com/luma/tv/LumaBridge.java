package com.luma.tv;

import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;

/** What the web interface may ask the app to do. Exposed to the page as {@code LumaNative}. */
final class LumaBridge {
    private final MainActivity activity;

    LumaBridge(MainActivity activity) {
        this.activity = activity;
    }

    /** {id, title, url, live, position, ua, index, list:[{id,title,url}]} */
    @JavascriptInterface
    public void play(String json) {
        activity.runOnUiThread(() -> activity.startPlayer(json));
    }

    /** Muted live picture on a card; position and size in device pixels. */
    @JavascriptInterface
    public void preview(String url, String ua, int x, int y, int w, int h, int radius) {
        activity.previewStart(url, ua, x, y, w, h, radius);
    }

    /** One still picture of a live channel; the answer arrives through window.lumaSnap. */
    @JavascriptInterface
    public void snap(String id, String url, String ua) {
        activity.snapStart(id, url, ua);
    }

    @JavascriptInterface
    public void previewStop() {
        activity.previewStop();
    }

    /** {line, start, end}: what is on now, for the launcher. */
    @JavascriptInterface
    public void setNow(String json) {
        NowProvider.publish(activity, json);
    }

    @JavascriptInterface
    public void clearNow() {
        NowProvider.publish(activity, null);
    }

    /** Forgets the downloaded playlists and guide data. */
    @JavascriptInterface
    public void clearCache() {
        FetchProxy.clear(activity.getCacheDir());
    }

    @JavascriptInterface
    public String version() {
        try {
            return activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "0";
        }
    }

    /** Version name of another installed app, or an empty string when it is not installed. */
    @JavascriptInterface
    public String packageVersion(String pkg) {
        try {
            String v = activity.getPackageManager().getPackageInfo(pkg, 0).versionName;
            return v == null ? "" : v;
        } catch (Exception e) {
            return "";
        }
    }

    /** Downloads the APK at this https address and opens Android's installer. */
    @JavascriptInterface
    public void installUpdate(String apkUrl) {
        Updater.start(activity, apkUrl);
    }

    /** Starts the phone entry page on the home network; returns its address, or an empty string. */
    @JavascriptInterface
    public String startRemote() {
        try {
            return RemoteSetup.start(activity::remoteSource);
        } catch (Exception e) {
            return "";
        }
    }

    @JavascriptInterface
    public void stopRemote() {
        RemoteSetup.stop();
    }

    /** Sets the problem report that a phone can open next to the setup page. */
    @JavascriptInterface
    public void setReport(String text) {
        RemoteSetup.report = text == null ? "" : text;
    }

    /** A QR code for this text, as an SVG picture. */
    @JavascriptInterface
    public String qr(String text) {
        try {
            return QrSvg.of(text);
        } catch (Exception e) {
            return "";
        }
    }

    /** Checks [{id,url}] streams; results arrive as window.lumaProbe(id, ok) and finally window.lumaProbeDone(). */
    @JavascriptInterface
    public void probe(String json, String ua) {
        new Thread(() -> Prober.run(json, ua, new Prober.Sink() {
            @Override
            public void result(String id, boolean ok) {
                activity.js("window.lumaProbe && window.lumaProbe(" + JSONObject.quote(id) + "," + ok + ")");
            }

            @Override
            public void done() {
                activity.js("window.lumaProbeDone && window.lumaProbeDone()");
            }
        })).start();
    }

    @JavascriptInterface
    public void stopProbe() {
        Prober.cancel();
    }

    /** Starts recording this stream; returns the file path, or an empty string when one is already running. */
    @JavascriptInterface
    public String record(String url, String title, int minutes, String ua) {
        return Recorder.REC.start(activity, url, title, ua, minutes);
    }

    @JavascriptInterface
    public void stopRecord() {
        Recorder.REC.stop();
    }

    /** Name of what is being recorded now, or an empty string. */
    @JavascriptInterface
    public String recording() {
        return Recorder.REC.name();
    }

    /** [{name, path, size, time}] newest first. */
    @JavascriptInterface
    public String recordings() {
        JSONArray out = new JSONArray();
        try {
            File[] fs = Recorder.dir(activity).listFiles();
            if (fs != null) {
                java.util.Arrays.sort(fs, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
                for (File f : fs) {
                    JSONObject o = new JSONObject();
                    o.put("name", f.getName());
                    o.put("path", f.getAbsolutePath());
                    o.put("size", f.length());
                    o.put("time", f.lastModified());
                    out.put(o);
                }
            }
        } catch (Exception ignored) {
            // empty list
        }
        return out.toString();
    }

    @JavascriptInterface
    public boolean deleteRecording(String path) {
        try {
            File f = new File(path);
            File dir = Recorder.dir(activity);
            return f.getCanonicalPath().startsWith(dir.getCanonicalPath() + File.separator) && f.delete();
        } catch (Exception e) {
            return false;
        }
    }

    /** Copies a recording into the shared Movies/Luma folder so it shows up in the gallery. */
    @JavascriptInterface
    public boolean exportRecording(String path) {
        try {
            File f = new File(path);
            File dir = Recorder.dir(activity);
            if (!f.getCanonicalPath().startsWith(dir.getCanonicalPath() + File.separator)) return false;
            android.content.ContentValues v = new android.content.ContentValues();
            v.put(android.provider.MediaStore.Video.Media.DISPLAY_NAME, f.getName());
            v.put(android.provider.MediaStore.Video.Media.MIME_TYPE, "video/mp2t");
            v.put(android.provider.MediaStore.Video.Media.RELATIVE_PATH, "Movies/Luma");
            android.net.Uri u = activity.getContentResolver().insert(android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI, v);
            if (u == null) return false;
            try (java.io.InputStream in = new java.io.FileInputStream(f);
                 java.io.OutputStream out = activity.getContentResolver().openOutputStream(u)) {
                byte[] b = new byte[65536];
                int n;
                while ((n = in.read(b)) > 0) out.write(b, 0, n);
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public String errorLog() {
        return ErrLog.get(activity);
    }

    @JavascriptInterface
    public void clearErrorLog() {
        ErrLog.clear(activity);
    }

    /** Bytes used by recordings, the timeshift buffer and other cache. */
    @JavascriptInterface
    public String storage() {
        long rec = 0;
        File[] fs = Recorder.dir(activity).listFiles();
        if (fs != null) for (File f : fs) rec += f.length();
        long shift = new File(activity.getCacheDir(), "timeshift.ts").length();
        long cache = 0;
        File[] cs = activity.getCacheDir().listFiles();
        if (cs != null) for (File f : cs) if (f.isFile()) cache += f.length();
        return "{\"rec\":" + rec + ",\"shift\":" + shift + ",\"cache\":" + Math.max(0, cache - shift) + "}";
    }

    @JavascriptInterface
    public boolean clearTimeshift() {
        return new File(activity.getCacheDir(), "timeshift.ts").delete();
    }

    /** Keeps only the newest `keep` backup files that start with `prefix`. */
    @JavascriptInterface
    public void pruneBackups(String prefix, int keep) {
        File d = new File(appDir(), "backup");
        File[] fs = d.listFiles((dir, n) -> n.startsWith(prefix));
        if (fs == null || fs.length <= keep) return;
        java.util.Arrays.sort(fs, (a, b) -> a.getName().compareTo(b.getName()));
        for (int i = 0; i < fs.length - keep; i++) fs[i].delete();
    }

    private File appDir() {
        return activity.getExternalFilesDir(null);
    }

    /** Writes a small text file into the app's backup folder. */
    @JavascriptInterface
    public boolean saveText(String name, String text) {
        try {
            File d = new File(appDir(), "backup");
            d.mkdirs();
            try (FileOutputStream o = new FileOutputStream(new File(d, name.replaceAll("[^A-Za-z0-9._-]", "_")))) {
                o.write(text.getBytes("UTF-8"));
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public String backupPath() {
        return new File(new File(appDir(), "backup"), "luma-backup.json").getAbsolutePath();
    }

    /** The saved back-ups, newest first: [{name, path, time}]. */
    @JavascriptInterface
    public String backups() {
        JSONArray out = new JSONArray();
        try {
            File[] fs = new File(appDir(), "backup").listFiles((d, n) -> n.endsWith(".json"));
            if (fs != null) {
                java.util.Arrays.sort(fs, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
                for (File f : fs) {
                    JSONObject o = new JSONObject();
                    o.put("name", f.getName());
                    o.put("path", f.getAbsolutePath());
                    o.put("time", f.lastModified());
                    out.put(o);
                }
            }
        } catch (Exception ignored) {
            // empty list
        }
        return out.toString();
    }

    /** Reads a text file, only from inside the app's own folder. */
    @JavascriptInterface
    public String readText(String path) {
        try {
            File f = new File(path);
            if (!f.getCanonicalPath().startsWith(appDir().getCanonicalPath() + File.separator)) return "";
            try (FileInputStream in = new FileInputStream(f)) {
                ByteArrayOutputStream b = new ByteArrayOutputStream();
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
                return b.toString("UTF-8");
            }
        } catch (Exception e) {
            return "";
        }
    }

    /** [{name, path}] of the playlists in a folder of the app. */
    @JavascriptInterface
    public String listFiles(String sub) {
        JSONArray out = new JSONArray();
        try {
            File d = new File(appDir(), sub.replaceAll("[^A-Za-z0-9_-]", ""));
            d.mkdirs();
            File[] fs = d.listFiles();
            if (fs != null) for (File f : fs) {
                String n = f.getName().toLowerCase();
                if (!n.endsWith(".m3u") && !n.endsWith(".m3u8")) continue;
                JSONObject o = new JSONObject();
                o.put("name", f.getName());
                o.put("path", f.getAbsolutePath());
                out.put(o);
            }
        } catch (Exception ignored) {
            // empty list
        }
        return out.toString();
    }

    /** Free bytes where recordings are stored. */
    @JavascriptInterface
    public String freeSpace() {
        try {
            return String.valueOf(Recorder.dir(activity).getUsableSpace());
        } catch (Exception e) {
            return "0";
        }
    }

    @JavascriptInterface
    public void exit() {
        activity.runOnUiThread(activity::finish);
    }
}
