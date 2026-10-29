package com.luma.tv;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Tells the launcher what is on now, in the shape its "game_day" panel reads (docs/modules.md in CleanYourTV).
 * One row: the channel and programme, between the programme's start and end, so Home says "Live now".
 * Only the channel and programme name are published: the provider is readable by any app.
 */
public class NowProvider extends ContentProvider {
    static final String AUTHORITY = "com.luma.tv.now";
    static final Uri TURNS = Uri.parse("content://" + AUTHORITY + "/turns");
    private static final String PREFS = "luma_now";
    private static final String[] COLUMNS = {"top_line", "word", "start_ms", "end_ms", "colour", "calendar", "turn_seconds"};

    /** {@code json}: {line, start, end} from the web interface, or null to clear. */
    static void publish(Context context, String json) {
        SharedPreferences.Editor e = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        if (json == null) e.remove("now");
        else e.putString("now", json);
        e.apply();
        context.getContentResolver().notifyChange(TURNS, null);
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        MatrixCursor cursor = new MatrixCursor(COLUMNS);
        Context context = getContext();
        if (context == null || !"turns".equals(uri.getLastPathSegment())) return cursor;
        String json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("now", null);
        if (json == null) return cursor;
        try {
            JSONObject o = new JSONObject(json);
            String line = o.optString("line", "");
            long start = o.optLong("start", 0);
            long end = o.optLong("end", 0);
            if (line.isEmpty() || end <= System.currentTimeMillis()) return cursor;
            cursor.addRow(new Object[]{line, "", start, end, 0xFF7C5CFF, "luma", 30});
        } catch (JSONException ignored) {
            // A bad row hides the panel; nothing else to do.
        }
        return cursor;
    }

    @Override
    public String getType(Uri uri) {
        return null;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
