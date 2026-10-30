package com.luma.tv;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/** Remembers the latest playback errors so the app can show which channels keep failing. */
final class ErrLog {
    private static final String PREFS = "luma_log";

    private ErrLog() {}

    static synchronized void add(Context c, String id, String name, String code) {
        try {
            SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONArray old = new JSONArray(p.getString("log", "[]"));
            JSONArray out = new JSONArray();
            int from = Math.max(0, old.length() - 119);
            for (int i = from; i < old.length(); i++) out.put(old.get(i));
            JSONObject o = new JSONObject();
            o.put("t", System.currentTimeMillis());
            o.put("id", id);
            o.put("name", name);
            o.put("code", code);
            out.put(o);
            p.edit().putString("log", out.toString()).apply();
        } catch (Exception ignored) {
            // The log is best effort.
        }
    }

    static String get(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("log", "[]");
    }

    static void clear(Context c) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("log").apply();
    }
}
