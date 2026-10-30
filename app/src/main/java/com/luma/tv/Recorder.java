package com.luma.tv;

import android.content.Context;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Records a live stream to a file in the app's own storage. One recording at a time. */
final class Recorder {
    /** The user's recording, and the timeshift buffer: two independent jobs. */
    static final Recorder REC = new Recorder();
    static final Recorder SHIFT = new Recorder();

    private volatile Thread thread;
    private volatile boolean stop;
    private volatile long startedAt;
    private volatile String name = "";

    private Recorder() {
    }

    static File dir(Context ctx) {
        File d = new File(ctx.getExternalFilesDir(null), "rec");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    /** Starts recording; returns the file path, or an empty string when a recording is already running. */
    synchronized String start(Context ctx, String url, String title, String ua, int minutes) {
        if (active()) return "";
        String safe = (title == null ? "" : title).replaceAll("[^A-Za-z0-9 _-]", "").trim();
        if (safe.isEmpty()) safe = "opname";
        final File out = new File(dir(ctx), safe + "_" + new SimpleDateFormat("yyyyMMdd_HHmm", Locale.US).format(new Date()) + ".ts");
        return begin(out, url, title, ua, minutes);
    }

    /** Starts writing to exactly this file (used for the timeshift buffer). */
    synchronized String begin(File out, String url, String title, String ua, int minutes) {
        if (active()) return "";
        final long until = System.currentTimeMillis() + Math.max(1, minutes) * 60000L;
        final String agent = (ua == null || ua.trim().isEmpty()) ? "LumaTV/0.1" : ua;
        stop = false;
        startedAt = System.currentTimeMillis();
        name = title == null ? "" : title;
        thread = new Thread(() -> run(url, agent, out, until), "luma-rec");
        thread.start();
        return out.getAbsolutePath();
    }

    void stop() {
        stop = true;
    }

    boolean active() {
        Thread t = thread;
        return t != null && t.isAlive();
    }

    String name() {
        return active() ? name : "";
    }

    long elapsedMs() {
        return active() ? System.currentTimeMillis() - startedAt : 0;
    }

    private static HttpURLConnection open(String url, String ua) throws Exception {
        String cur = url;
        for (int i = 0; i < 6; i++) {
            HttpURLConnection c = (HttpURLConnection) new URL(cur).openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setInstanceFollowRedirects(false);
            c.setRequestProperty("User-Agent", ua);
            int code = c.getResponseCode();
            if (code >= 300 && code < 400 && c.getHeaderField("Location") != null) {
                cur = new URL(new URL(cur), c.getHeaderField("Location")).toString();
                c.disconnect();
                continue;
            }
            return c;
        }
        throw new java.io.IOException("Te veel doorverwijzingen");
    }

    private void run(String url, String ua, File out, long until) {
        try (OutputStream os = new FileOutputStream(out)) {
            if (url.toLowerCase(Locale.ROOT).contains(".m3u8")) hls(url, ua, os, until);
            else raw(url, ua, os, until);
        } catch (Exception ignored) {
            // the file keeps what was written so far
        }
    }

    private void copy(HttpURLConnection c, OutputStream os, long until) throws Exception {
        try (InputStream in = c.getInputStream()) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while (!stop && System.currentTimeMillis() < until && (n = in.read(buf)) > 0) os.write(buf, 0, n);
        } finally {
            c.disconnect();
        }
    }

    private void raw(String url, String ua, OutputStream os, long until) throws Exception {
        copy(open(url, ua), os, until);
    }

    private static String text(String url, String ua) throws Exception {
        HttpURLConnection c = open(url, ua);
        try (InputStream in = c.getInputStream()) {
            java.io.ByteArrayOutputStream b = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
            return b.toString("UTF-8");
        } finally {
            c.disconnect();
        }
    }

    private void hls(String url, String ua, OutputStream os, long until) throws Exception {
        String list = url;
        Set<String> seen = new HashSet<>();
        List<String> order = new ArrayList<>();
        while (!stop && System.currentTimeMillis() < until) {
            String body = text(list, ua);
            String[] lines = body.split("\r?\n");
            if (body.contains("#EXT-X-STREAM-INF")) {
                for (int i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith("#EXT-X-STREAM-INF") && i + 1 < lines.length) {
                        list = new URL(new URL(list), lines[i + 1].trim()).toString();
                        break;
                    }
                }
                continue;
            }
            boolean any = false;
            for (String l : lines) {
                String s = l.trim();
                if (s.isEmpty() || s.startsWith("#")) continue;
                String seg = new URL(new URL(list), s).toString();
                if (!seen.add(seg)) continue;
                order.add(seg);
                if (order.size() > 400) seen.remove(order.remove(0));
                any = true;
                if (stop || System.currentTimeMillis() >= until) break;
                copy(open(seg, ua), os, Long.MAX_VALUE);
            }
            if (!any) Thread.sleep(2000);
        }
    }
}
