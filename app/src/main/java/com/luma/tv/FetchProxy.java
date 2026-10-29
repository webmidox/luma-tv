package com.luma.tv;

import android.net.Uri;
import android.webkit.WebResourceResponse;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.GZIPInputStream;

/**
 * Fetches playlists, guide data and provider APIs for the web interface.
 *
 * The page asks {@code /proxy?u=<url>&ttl=<seconds>&ua=<user agent>} on its own origin, so there is no CORS to fight.
 * The answer is stored in the app's private cache (gzip is unpacked on the way), and a later request inside the ttl
 * is served from there. Providers often use plain http, redirects between http and https, or .gz guide files, which
 * is why this is done natively.
 */
final class FetchProxy {
    static final String PATH = "/proxy";
    private static final int MAX_REDIRECTS = 5;

    private FetchProxy() {
    }

    static WebResourceResponse handle(File cacheDir, Uri request) {
        String target = request.getQueryParameter("u");
        if (target == null || !(target.startsWith("http://") || target.startsWith("https://"))) {
            return error(400, "Bad Request", "Geen geldig adres");
        }
        long ttlMs = parseLong(request.getQueryParameter("ttl")) * 1000L;
        String ua = request.getQueryParameter("ua");
        if (ua == null || ua.trim().isEmpty()) ua = "LumaTV/0.1";

        File dir = new File(cacheDir, "fetch");
        if (!dir.exists() && !dir.mkdirs()) return error(500, "Internal Error", "Cache niet beschikbaar");
        File file = new File(dir, sha256(target));
        try {
            boolean fresh = ttlMs > 0 && file.exists() && System.currentTimeMillis() - file.lastModified() < ttlMs;
            if (!fresh) download(target, ua, file);
            return ok(new FileInputStream(file));
        } catch (IOException e) {
            return error(502, "Bad Gateway", String.valueOf(e.getMessage()));
        }
    }

    /** Removes everything cached, for "Lijsten opnieuw laden". */
    static void clear(File cacheDir) {
        File[] files = new File(cacheDir, "fetch").listFiles();
        if (files == null) return;
        for (File f : files) //noinspection ResultOfMethodCallIgnored
            f.delete();
    }

    private static void download(String target, String ua, File out) throws IOException {
        String url = target;
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(15000);
            c.setReadTimeout(60000);
            c.setRequestProperty("User-Agent", ua);
            c.setRequestProperty("Accept", "*/*");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) {
                String location = c.getHeaderField("Location");
                c.disconnect();
                if (location == null) throw new IOException("Doorverwijzing zonder adres");
                url = new URL(new URL(url), location).toString();
                continue;
            }
            if (code >= 400) {
                c.disconnect();
                throw new IOException("De server antwoordde met " + code);
            }
            File tmp = new File(out.getPath() + ".tmp");
            try (InputStream raw = new BufferedInputStream(c.getInputStream());
                 OutputStream sink = new FileOutputStream(tmp)) {
                raw.mark(2);
                int b1 = raw.read();
                int b2 = raw.read();
                raw.reset();
                InputStream in = (b1 == 0x1f && b2 == 0x8b) ? new GZIPInputStream(raw) : raw;
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) sink.write(buf, 0, n);
            } finally {
                c.disconnect();
            }
            //noinspection ResultOfMethodCallIgnored
            out.delete();
            if (!tmp.renameTo(out)) throw new IOException("Opslaan in de cache mislukt");
            return;
        }
        throw new IOException("Te veel doorverwijzingen");
    }

    private static WebResourceResponse ok(InputStream body) {
        return new WebResourceResponse("text/plain", "utf-8", 200, "OK", headers(), body);
    }

    private static WebResourceResponse error(int code, String reason, String message) {
        return new WebResourceResponse("text/plain", "utf-8", code, reason, headers(),
                new ByteArrayInputStream(message.getBytes(StandardCharsets.UTF_8)));
    }

    private static Map<String, String> headers() {
        Map<String, String> h = new HashMap<>();
        h.put("Cache-Control", "no-store");
        return h;
    }

    private static long parseLong(String s) {
        try {
            return s == null ? 0 : Long.parseLong(s);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /** The cache file is named after a hash, so a URL with a password never appears as a file name. */
    private static String sha256(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
