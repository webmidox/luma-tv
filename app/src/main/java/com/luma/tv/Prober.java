package com.luma.tv;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/** Checks whether streams answer at all, a few at a time. Results go back to the page one by one. */
final class Prober {
    interface Sink {
        void result(String id, boolean ok);

        void done();
    }

    private static volatile boolean cancel;

    private Prober() {
    }

    static void cancel() {
        cancel = true;
    }

    static void run(String json, String ua, Sink sink) {
        cancel = false;
        final String agent = (ua == null || ua.trim().isEmpty()) ? "LumaTV/0.1" : ua;
        final JSONArray arr;
        try {
            arr = new JSONArray(json);
        } catch (Exception e) {
            sink.done();
            return;
        }
        final ExecutorService pool = Executors.newFixedThreadPool(8);
        final AtomicInteger left = new AtomicInteger(arr.length());
        if (arr.length() == 0) {
            sink.done();
            return;
        }
        for (int i = 0; i < arr.length(); i++) {
            final JSONObject o = arr.optJSONObject(i);
            pool.execute(() -> {
                if (o != null && !cancel) sink.result(o.optString("id"), check(o.optString("url"), agent));
                if (left.decrementAndGet() == 0) {
                    sink.done();
                    pool.shutdown();
                }
            });
        }
    }

    private static boolean check(String url, String ua) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(6000);
            c.setReadTimeout(6000);
            c.setRequestProperty("User-Agent", ua);
            int code = c.getResponseCode();
            if (code < 200 || code >= 400) return false;
            try (InputStream in = c.getInputStream()) {
                byte[] buf = new byte[2048];
                int n = in.read(buf);
                return n > 0;
            }
        } catch (Exception e) {
            return false;
        } finally {
            if (c != null) c.disconnect();
        }
    }
}
