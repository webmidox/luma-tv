package com.luma.tv;

import android.app.Activity;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.audiofx.DynamicsProcessing;
import android.net.Uri;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.SurfaceView;
import android.view.View;
import android.view.WindowManager;
import android.util.LruCache;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.common.TrackSelectionParameters;
import androidx.media3.common.Tracks;
import androidx.media3.common.VideoSize;
import androidx.media3.common.text.CueGroup;
import androidx.media3.ui.SubtitleView;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.upstream.DefaultBandwidthMeter;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Full-screen playback.
 *
 * Live channels: up and down (or channel up and down) zap; digits type a channel number; OK opens the channel bar with
 * what is on now and next, recently watched channels and four actions (channel list, favourite, previous channel, info).
 * Films and episodes: left and right seek, OK pauses.
 *
 * Actions (D-pad row): picture format, audio track, subtitles, sleep timer, speed, skip intro, next episode.
 *
 * The result handed back to the interface: {id, live, ended, position, duration, favs, done, watch}.
 */
public class PlayerActivity extends Activity {
    static final String EXTRA_PAYLOAD = "payload";
    /** The payload can be many MB (all channels); an Intent only holds about 1 MB, so it travels here. */
    static volatile String pending;

    private static final int HIDDEN = 0;
    private static final int BRIEF = 1;
    private static final int BAR = 2;
    private static final int LIST = 3;
    private static final int ROWS = 9;

    private static final class Item {
        String id;
        String title;
        String url;
        String group = "";
        String logo = "";
        String showId = "";
        int num;
        long[] ps = new long[0];
        long[] pe = new long[0];
        String[] pt = new String[0];
        String[] pd = new String[0];
        String[] alt = new String[0];
    }

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<Item> items = new ArrayList<>();
    private final List<String> history = new ArrayList<>();
    private final Set<String> favs = new LinkedHashSet<>();
    private int index;
    private boolean live;
    private long startPosition;
    private String userAgent = "LumaTV/0.1";
    private boolean ended;
    private boolean closing;
    private int retries;
    private int accent = 0xFFFF8A1F;
    private long seekBack = 10000;
    private long seekFwd = 30000;
    private long overlayMs = 5000;
    private String audioLang = "";
    private String subLang = "off";
    private int maxH;
    private boolean autoNext = true;
    private boolean stopAfter;
    private boolean repeatOne;
    private TextView peekView;
    private long lastOk;
    private long pausedAt;
    private boolean autoIntro;
    private long introAt;
    private boolean introDone;
    private int subDelay;
    private static final int[] SUBDELAYS = {0, 500, 1000, 2000, 3000};
    private int subDelayIdx;
    private int night;
    private int nightFrom = -1, nightTo = -1;
    private TextView bingeView;
    private int bingeLeft;
    private int subColor = Color.WHITE;
    private FrameLayout radioView;
    private TextView radioTitle, radioNow;
    // timeshift: the buffer file, and whether the player is watching it instead of the live stream
    private boolean tsAuto;
    private boolean shiftOn;
    private boolean onFile;
    private boolean shiftWait;
    private long shiftStart;
    private String curUrl = "";
    private int recMin = 60;
    private float subScale = 1f;
    private int altTry;
    private DynamicsProcessing dyn;
    private long skipMs = 85000;
    private int aspect;
    private int vw;
    private int vh;
    private float vpar = 1f;
    private int speedIdx = 1;
    private int sleepIdx;
    private int audioSel = -1;
    private int subSel = -1;
    private boolean vodFocus;
    private final Map<String, Long> watch = new HashMap<>();
    private final List<String> done = new ArrayList<>();
    private static final float[] SPEEDS = {0.75f, 1f, 1.25f, 1.5f, 2f};
    private static final int[] SLEEPS = {0, 15, 30, 60, 90};
    private static final String[] LIVE_ACTS = {"pp", "restart", "list", "fav", "prev", "subs", "audio", "info", "aspect", "tsback", "tsfwd", "golive", "night", "rec", "vol", "sleep"};
    private static final String[] VOD_ACTS = {"pp", "skip", "next", "speed", "subs", "audio", "info", "aspect", "night", "repeat", "stopafter", "credits", "subdelay", "sleep"};
    private SubtitleView subtitles;
    private TextView flashView;

    private int mode = HIDDEN;
    private int action;
    private int listSel;
    private boolean infoOn;
    private String digits = "";

    private ExoPlayer player;
    private SurfaceView surface;
    private ProgressBar spinner;
    private TextView errorView;
    private LinearLayout recentRow;
    private TextView chNum;
    private TextView numView;
    private LinearLayout bottom;
    private TextView titleView;
    private TextView subView;
    private TextView nextView;
    private TextView descView;
    private ProgressBar bar;
    private LinearLayout actionsRow;
    private final TextView[] actionViews = new TextView[20];
    private static final int PRIMARY = 4;
    private final LruCache<String, Bitmap> logos = new LruCache<>(40);
    private final Set<String> loadingLogos = new LinkedHashSet<>();
    private boolean optsShown;
    private LinearLayout optsRow;
    private TextView timeView;
    private TextView nowTag;
    private TextView clockView;
    private TextView prevTitle;
    private TextView prevTime;
    private TextView nextTitle;
    private TextView nextTime;
    private ImageView mainLogo;
    private LinearLayout topBar;
    private LinearLayout prevTile;
    private LinearLayout nextTile;
    private LinearLayout listPanel;
    private final TextView[] listRows = new TextView[ROWS];

    private final Runnable hide = () -> setMode(HIDDEN);
    private final Runnable tune = this::tuneDigits;
    private final Runnable flashHide = () -> flashView.setVisibility(View.GONE);
    private final Runnable sleepRun = () -> {
        if (player != null) player.pause();
        finishWithResult();
    };
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (player != null && player.isPlaying() && !closing) {
                String id = items.get(index).id;
                Long w = watch.get(id);
                watch.put(id, (w == null ? 0L : w) + 1000L);
            }
            if (introAt > 0 && !introDone && !live && player != null) {
                long pos = player.getCurrentPosition();
                if (pos >= introAt && pos < introAt + 4000) {
                    introDone = true;
                    seekBy(skipMs);
                    flash("Intro automatisch overgeslagen");
                } else if (pos >= introAt + 4000) introDone = true;
            }
            refresh();
            handler.postDelayed(this, 1000);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (!readPayload()) {
            finish();
            return;
        }
        buildUi();
        initPlayer();
        play(index);
        handler.post(tick);
    }

    // ---------- input data ----------

    private boolean readPayload() {
        String raw = pending != null ? pending : getIntent().getStringExtra(EXTRA_PAYLOAD);
        if (raw == null) return false;
        try {
            JSONObject o = new JSONObject(raw);
            live = o.optBoolean("live", false);
            startPosition = o.optLong("position", 0);
            userAgent = o.optString("ua", userAgent);
            if (userAgent.trim().isEmpty()) userAgent = "LumaTV/0.1";
            String ac = o.optString("accent", "");
            if (ac.matches("#[0-9a-fA-F]{6}")) accent = Color.parseColor(ac);
            seekBack = o.optLong("seekBack", seekBack);
            seekFwd = o.optLong("seekFwd", seekFwd);
            overlayMs = Math.max(2000, o.optLong("overlayMs", overlayMs));
            audioLang = o.optString("alang", "");
            subLang = o.optString("slang", "off");
            maxH = o.optInt("maxH", 0);
            recMin = Math.max(1, o.optInt("recMin", 60));
            tsAuto = o.optBoolean("tsAuto", false);
            autoIntro = o.optBoolean("autoIntro", false);
            nightFrom = o.optInt("nightFrom", -1);
            nightTo = o.optInt("nightTo", -1);
            if (nightFrom >= 0 && nightTo >= 0) {
                int hr = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);
                boolean inside = nightFrom <= nightTo ? (hr >= nightFrom && hr < nightTo) : (hr >= nightFrom || hr < nightTo);
                if (inside) night = 2;
            }
            String sc = o.optString("subColor", "wit");
            subColor = "geel".equals(sc) ? 0xFFFFE066 : "groen".equals(sc) ? 0xFF7CFF8A : "cyaan".equals(sc) ? 0xFF7CF3FF : Color.WHITE;
            subScale = (float) Math.max(0.5, Math.min(3.0, o.optDouble("subScale", 1.0)));
            autoNext = o.optBoolean("autoNext", true);
            skipMs = Math.max(10000, o.optLong("skipMs", skipMs));
            JSONArray fa = o.optJSONArray("favs");
            if (fa != null) for (int i = 0; i < fa.length(); i++) favs.add(fa.getString(i));
            JSONArray list = o.optJSONArray("list");
            if (list != null && list.length() > 0) {
                for (int i = 0; i < list.length(); i++) items.add(toItem(list.getJSONObject(i)));
                index = Math.max(0, Math.min(items.size() - 1, o.optInt("index", 0)));
            } else {
                items.add(toItem(o));
                index = 0;
            }
            JSONArray ra = o.optJSONArray("recent");
            if (ra != null) for (int i = 0; i < ra.length(); i++) {
                String id = ra.getString(i);
                if (!id.equals(items.get(index).id) && !history.contains(id)) history.add(id);
            }
            return !items.isEmpty() && items.get(index).url != null && !items.get(index).url.isEmpty();
        } catch (JSONException e) {
            return false;
        }
    }

    private static Item toItem(JSONObject o) {
        Item it = new Item();
        it.id = o.optString("id", "");
        it.title = o.optString("title", "");
        it.url = o.optString("url", "");
        it.group = o.optString("group", "");
        it.logo = o.optString("logo", "");
        it.showId = o.optString("showId", "");
        it.num = o.optInt("num", 0);
        JSONArray al = o.optJSONArray("alt");
        if (al != null) {
            it.alt = new String[al.length()];
            for (int i = 0; i < al.length(); i++) it.alt[i] = al.optString(i, "");
        }
        JSONArray p = o.optJSONArray("p");
        if (p != null) {
            int n = p.length();
            it.ps = new long[n];
            it.pe = new long[n];
            it.pt = new String[n];
            it.pd = new String[n];
            for (int i = 0; i < n; i++) {
                JSONArray r = p.optJSONArray(i);
                if (r == null) continue;
                it.ps[i] = r.optLong(0);
                it.pe[i] = r.optLong(1);
                it.pt[i] = r.optString(2, "");
                it.pd[i] = r.optString(3, "");
            }
        }
        return it;
    }

    /** Index of the programme on now, or -1. */
    private static int progNow(Item it, long now) {
        for (int i = 0; i < it.pt.length; i++) if (it.ps[i] <= now && now < it.pe[i]) return i;
        return -1;
    }

    /** Index of the programme after the one on now (or the first one still to come), or -1. */
    private static int progNext(Item it, long now) {
        int n = progNow(it, now);
        if (n >= 0) return n + 1 < it.pt.length ? n + 1 : -1;
        for (int i = 0; i < it.pt.length; i++) if (it.ps[i] > now) return i;
        return -1;
    }

    private static String hm(long ms) {
        return new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(ms));
    }

    // ---------- views ----------

    private TextView text(float sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setTextSize(sp);
        t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private GradientDrawable rounded(int color, int radiusDp) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(dp(radiusDp));
        return g;
    }

    private int onAccent() {
        double lum = (0.299 * Color.red(accent) + 0.587 * Color.green(accent) + 0.114 * Color.blue(accent)) / 255.0;
        return lum > 0.6 ? 0xFF14110A : Color.WHITE;
    }

    private final Runnable bingeTick = new Runnable() {
        @Override
        public void run() {
            if (bingeLeft <= 0 || closing) return;
            bingeLeft--;
            if (bingeLeft == 0) {
                bingeNow();
                return;
            }
            showBinge();
            handler.postDelayed(this, 1000);
        }
    };

    private void startBinge() {
        bingeLeft = 8;
        showBinge();
        handler.postDelayed(bingeTick, 1000);
    }

    private void showBinge() {
        bingeView.setText("Volgende: " + items.get(index + 1).title + "  ·  over " + bingeLeft + " s\nOK = nu afspelen   Terug = stoppen");
        bingeView.setVisibility(View.VISIBLE);
    }

    private void bingeNow() {
        handler.removeCallbacks(bingeTick);
        bingeLeft = 0;
        bingeView.setVisibility(View.GONE);
        play(index + 1);
    }

    private void bingeCancel() {
        handler.removeCallbacks(bingeTick);
        bingeLeft = 0;
        bingeView.setVisibility(View.GONE);
        ended = true;
        finishWithResult();
    }

    private android.content.SharedPreferences prefs() {
        return getSharedPreferences("luma_player", MODE_PRIVATE);
    }

    private boolean isRadio(Item it) {
        return live && it.group != null && it.group.toLowerCase(Locale.ROOT).contains("radio");
    }

    private final class Bars extends View {
        private final android.graphics.Paint paint = new android.graphics.Paint();
        private final java.util.Random rnd = new java.util.Random();
        private final float[] h = new float[20];

        Bars(android.content.Context c) {
            super(c);
            paint.setColor(accent);
        }

        @Override
        protected void onDraw(android.graphics.Canvas cv) {
            boolean on = player != null && player.isPlaying();
            float w = getWidth() / (float) h.length;
            for (int i = 0; i < h.length; i++) {
                h[i] = on ? 0.15f + rnd.nextFloat() * 0.85f : 0.1f;
                float bh = h[i] * getHeight();
                cv.drawRect(i * w + w * 0.2f, getHeight() - bh, (i + 1) * w - w * 0.2f, getHeight(), paint);
            }
            postInvalidateDelayed(140);
        }
    }

    /** One of the two dimmed side tiles (previous / next programme) of the live bar. */
    private LinearLayout sideTile(boolean prev) {
        LinearLayout t = new LinearLayout(this);
        t.setOrientation(LinearLayout.VERTICAL);
        t.setPadding(dp(14), dp(14), dp(14), dp(12));
        t.setBackground(rounded(0xE6161715, 4));
        TextView title = text(17, 0xFFB9B9B9, false);
        title.setSingleLine(true);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);
        TextView time = text(15, 0xFF8F8F8F, false);
        time.setSingleLine(true);
        View line = new View(this);
        line.setBackgroundColor(0xFF8A8A8A);
        t.addView(title);
        t.addView(time);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(3));
        lp.setMargins(0, dp(12), 0, 0);
        t.addView(line, lp);
        if (prev) { prevTitle = title; prevTime = time; } else { nextTitle = title; nextTime = time; }
        return t;
    }

    /** The live info bar: previous programme, the programme on now with logo, times and progress, and the next one. */
    private void buildLiveBar(FrameLayout root) {
        bottom.setPadding(dp(32), dp(90), dp(32), dp(26));
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);

        prevTile = sideTile(true);
        LinearLayout.LayoutParams pl = new LinearLayout.LayoutParams(dp(190), -2);
        pl.setMargins(0, 0, dp(14), 0);
        row.addView(prevTile, pl);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(rounded(0xF2171816, 4));
        View top = new View(this);
        top.setBackgroundColor(accent);
        card.addView(top, new LinearLayout.LayoutParams(-1, dp(2)));
        LinearLayout inner = new LinearLayout(this);
        inner.setOrientation(LinearLayout.HORIZONTAL);
        inner.setGravity(Gravity.CENTER_VERTICAL);
        inner.setPadding(dp(18), dp(12), dp(18), dp(8));
        mainLogo = new ImageView(this);
        mainLogo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        inner.addView(mainLogo, new LinearLayout.LayoutParams(dp(60), dp(60)));
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        titleView.setTextSize(26);
        titleView.setEllipsize(android.text.TextUtils.TruncateAt.END);
        col.addView(titleView);
        LinearLayout tl = new LinearLayout(this);
        tl.setOrientation(LinearLayout.HORIZONTAL);
        tl.setGravity(Gravity.CENTER_VERTICAL);
        nowTag = text(13, 0xFFE0E0E0, true);
        nowTag.setText("NU");
        timeView.setTextSize(18);
        timeView.setGravity(Gravity.START);
        timeView.setTextColor(Color.WHITE);
        timeView.setPadding(dp(12), 0, 0, 0);
        tl.addView(nowTag);
        tl.addView(timeView);
        col.addView(tl);
        LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(0, -2, 1f);
        cl.setMargins(dp(16), 0, dp(12), 0);
        inner.addView(col, cl);
        TextView dots = text(22, onAccent(), true);
        dots.setText("•••");
        dots.setGravity(Gravity.CENTER);
        dots.setPadding(dp(28), dp(12), dp(28), dp(12));
        dots.setBackground(rounded(accent, 4));
        inner.addView(dots, new LinearLayout.LayoutParams(-2, -2));
        card.addView(inner);
        bar.setProgressBackgroundTintList(ColorStateList.valueOf(0x55FFFFFF));
        card.addView(bar, new LinearLayout.LayoutParams(-1, dp(5)));
        row.addView(card, new LinearLayout.LayoutParams(0, -2, 1f));

        nextTile = sideTile(false);
        LinearLayout.LayoutParams nl = new LinearLayout.LayoutParams(dp(190), -2);
        nl.setMargins(dp(14), 0, 0, 0);
        row.addView(nextTile, nl);
        bottom.addView(row, new LinearLayout.LayoutParams(-1, -2));

        bottom.addView(descView);
        LinearLayout.LayoutParams ar = new LinearLayout.LayoutParams(-2, -2);
        ar.setMargins(dp(8), dp(14), 0, 0);
        bottom.addView(actionsRow, ar);
        LinearLayout.LayoutParams or2 = new LinearLayout.LayoutParams(-2, -2);
        or2.setMargins(dp(8), dp(10), 0, 0);
        bottom.addView(optsRow, or2);

        topBar = new LinearLayout(this);
        topBar.setOrientation(LinearLayout.HORIZONTAL);
        topBar.setGravity(Gravity.CENTER_VERTICAL);
        topBar.setPadding(dp(32), dp(20), dp(32), dp(40));
        topBar.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[]{0xB3000000, 0x00000000}));
        TextView where = text(15, Color.WHITE, false);
        where.setText("SPEELT NU - LIVE TV");
        where.setLetterSpacing(0.04f);
        topBar.addView(where, new LinearLayout.LayoutParams(0, -2, 1f));
        clockView = text(20, Color.WHITE, false);
        topBar.addView(clockView);
        topBar.setVisibility(View.GONE);
        root.addView(topBar, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));
    }

    /** Index of the last programme that ended before now (or the one before the current one), or -1. */
    private static int progPrev(Item it, long now) {
        int n = progNow(it, now);
        if (n >= 0) return n - 1;
        int best = -1;
        for (int i = 0; i < it.pt.length; i++) if (it.pe[i] <= now) best = i;
        return best;
    }

    private void buildUi() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        surface = new SurfaceView(this);
        root.addView(surface, new FrameLayout.LayoutParams(-1, -1));

        bingeView = text(26, Color.WHITE, true);
        bingeView.setGravity(Gravity.CENTER);
        bingeView.setPadding(48, 28, 48, 28);
        bingeView.setBackgroundColor(0xE6101018);
        bingeView.setVisibility(View.GONE);
        radioView = new FrameLayout(this);
        radioView.setBackgroundColor(0xFF0B0B10);
        radioView.setVisibility(View.GONE);
        LinearLayout rl = new LinearLayout(this);
        rl.setOrientation(LinearLayout.VERTICAL);
        rl.setGravity(Gravity.CENTER);
        radioTitle = text(44, Color.WHITE, true);
        radioTitle.setGravity(Gravity.CENTER);
        radioNow = text(24, 0xFFB8B8C4, false);
        radioNow.setGravity(Gravity.CENTER);
        rl.addView(radioTitle, new LinearLayout.LayoutParams(-2, -2));
        rl.addView(radioNow, new LinearLayout.LayoutParams(-2, -2));
        rl.addView(new Bars(this), new LinearLayout.LayoutParams(420, 120));
        radioView.addView(rl, new FrameLayout.LayoutParams(-1, -1));
        root.addView(radioView, new FrameLayout.LayoutParams(-1, -1));

        FrameLayout.LayoutParams bl = new FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        bl.bottomMargin = 140;
        root.addView(bingeView, bl);

        subtitles = new SubtitleView(this);
        subtitles.setUserDefaultStyle();
        subtitles.setUserDefaultTextSize();
        root.addView(subtitles, new FrameLayout.LayoutParams(-1, -1));

        flashView = text(22, Color.WHITE, true);
        flashView.setPadding(dp(24), dp(10), dp(24), dp(10));
        flashView.setBackground(rounded(0xCC000000, 12));
        flashView.setVisibility(View.GONE);
        FrameLayout.LayoutParams fp = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        fp.setMargins(0, dp(32), 0, 0);
        root.addView(flashView, fp);

        peekView = text(18, 0xFFE8E8F0, false);
        peekView.setBackgroundColor(0xB0101018);
        peekView.setPadding(24, 14, 24, 14);
        peekView.setVisibility(View.GONE);
        FrameLayout.LayoutParams pp = new FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM | Gravity.END);
        pp.setMargins(0, 0, dp(32), dp(200));
        root.addView(peekView, pp);

        spinner = new ProgressBar(this);
        spinner.setVisibility(View.GONE);
        root.addView(spinner, new FrameLayout.LayoutParams(dp(56), dp(56), Gravity.CENTER));

        errorView = text(20, Color.WHITE, false);
        errorView.setGravity(Gravity.CENTER);
        errorView.setVisibility(View.GONE);
        root.addView(errorView, new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER));

        recentRow = new LinearLayout(this);
        recentRow.setOrientation(LinearLayout.HORIZONTAL);
        recentRow.setVisibility(View.GONE);
        FrameLayout.LayoutParams rp = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.START);
        rp.setMargins(dp(32), live ? dp(64) : dp(32), 0, 0);
        root.addView(recentRow, rp);

        chNum = text(40, Color.WHITE, true);
        chNum.setGravity(Gravity.CENTER);
        chNum.setMinWidth(dp(96));
        chNum.setMinHeight(dp(96));
        chNum.setPadding(dp(18), dp(10), dp(18), dp(10));
        chNum.setBackground(rounded(0xCC000000, 6));
        chNum.setVisibility(View.GONE);
        FrameLayout.LayoutParams cp = new FrameLayout.LayoutParams(-2, -2, Gravity.END | Gravity.CENTER_VERTICAL);
        cp.setMargins(0, 0, dp(48), dp(30));
        root.addView(chNum, cp);

        numView = text(72, Color.WHITE, true);
        numView.setGravity(Gravity.CENTER);
        numView.setPadding(dp(40), dp(16), dp(40), dp(16));
        numView.setBackground(rounded(0xCC000000, 16));
        numView.setVisibility(View.GONE);
        root.addView(numView, new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER));

        bottom = new LinearLayout(this);
        bottom.setOrientation(LinearLayout.VERTICAL);
        bottom.setPadding(dp(48), dp(72), dp(48), dp(28));
        bottom.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[]{0x00000000, 0xE6000000}));
        titleView = text(34, Color.WHITE, true);
        titleView.setSingleLine(true);
        subView = text(17, 0xDDFFFFFF, false);
        subView.setSingleLine(true);
        nextView = text(15, 0xAAFFFFFF, false);
        nextView.setSingleLine(true);
        descView = text(15, 0xCCFFFFFF, false);
        descView.setMaxLines(3);
        descView.setVisibility(View.GONE);
        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setProgressTintList(ColorStateList.valueOf(accent));
        actionsRow = new LinearLayout(this);
        actionsRow.setOrientation(LinearLayout.HORIZONTAL);
        actionsRow.setGravity(Gravity.CENTER_VERTICAL);
        optsRow = new LinearLayout(this);
        optsRow.setOrientation(LinearLayout.HORIZONTAL);
        for (int i = 0; i < actionViews.length; i++) {
            TextView a = text(i == 0 ? 22 : 15, Color.WHITE, true);
            if (i == 1) a.setTextSize(22);
            a.setGravity(Gravity.CENTER);
            if (i < 2 && live) {
                a.setMinWidth(dp(56));
                a.setMinHeight(dp(56));
                a.setPadding(dp(12), dp(8), dp(12), dp(8));
            } else {
                a.setPadding(dp(16), dp(9), dp(16), dp(9));
            }
            LinearLayout.LayoutParams ap = new LinearLayout.LayoutParams(-2, -2);
            ap.setMargins(0, 0, dp(10), 0);
            (i < PRIMARY ? actionsRow : optsRow).addView(a, ap);
            actionViews[i] = a;
        }
        timeView = text(14, 0xCCFFFFFF, false);
        timeView.setGravity(Gravity.END);
        if (live) buildLiveBar(root);
        else {
            bottom.addView(titleView);
            bottom.addView(subView);
            bottom.addView(nextView);
            bottom.addView(descView);
            LinearLayout.LayoutParams rp2 = new LinearLayout.LayoutParams(-2, -2);
            rp2.setMargins(0, dp(14), 0, 0);
            bottom.addView(actionsRow, rp2);
            LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(-1, dp(5));
            bp.setMargins(0, dp(14), 0, dp(6));
            bottom.addView(bar, bp);
            bottom.addView(timeView, new LinearLayout.LayoutParams(-1, -2));
            LinearLayout.LayoutParams op = new LinearLayout.LayoutParams(-2, -2);
            op.setMargins(0, dp(10), 0, 0);
            bottom.addView(optsRow, op);
        }
        bottom.setVisibility(View.GONE);
        root.addView(bottom, new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM));

        listPanel = new LinearLayout(this);
        listPanel.setOrientation(LinearLayout.VERTICAL);
        listPanel.setBackgroundColor(0xE8101018);
        listPanel.setPadding(dp(20), dp(32), dp(20), dp(32));
        listPanel.setGravity(Gravity.CENTER_VERTICAL);
        for (int i = 0; i < ROWS; i++) {
            TextView r = text(18, Color.WHITE, false);
            r.setSingleLine(true);
            r.setPadding(dp(16), dp(10), dp(16), dp(10));
            listPanel.addView(r, new LinearLayout.LayoutParams(-1, -2));
            listRows[i] = r;
        }
        listPanel.setVisibility(View.GONE);
        root.addView(listPanel, new FrameLayout.LayoutParams(dp(520), -1, Gravity.END));

        setContentView(root);
        hideSystemUi();
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    // ---------- player ----------

    private void initPlayer() {
        DefaultHttpDataSource.Factory data = new DefaultHttpDataSource.Factory()
                .setUserAgent(userAgent)
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(30000);
        player = new ExoPlayer.Builder(this)
                .setMediaSourceFactory(new DefaultMediaSourceFactory(new DefaultDataSource.Factory(this, data)))
                .build();
        player.setVideoSurfaceView(surface);
        subtitles.setFractionalTextSize(SubtitleView.DEFAULT_TEXT_SIZE_FRACTION * subScale);
        subtitles.setStyle(new androidx.media3.ui.CaptionStyleCompat(subColor, Color.TRANSPARENT, Color.TRANSPARENT, androidx.media3.ui.CaptionStyleCompat.EDGE_TYPE_OUTLINE, Color.BLACK, null));
        TrackSelectionParameters.Builder tp = player.getTrackSelectionParameters().buildUpon();
        if (!audioLang.isEmpty()) tp.setPreferredAudioLanguage(audioLang);
        if ("off".equals(subLang) || subLang.isEmpty()) tp.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true);
        else tp.setPreferredTextLanguage(subLang);
        if (maxH > 0) tp.setMaxVideoSize(Integer.MAX_VALUE, maxH);
        player.setTrackSelectionParameters(tp.build());
        player.addListener(new Player.Listener() {
            @Override
            public void onVideoSizeChanged(VideoSize size) {
                vw = size.width;
                vh = size.height;
                vpar = size.pixelWidthHeightRatio > 0 ? size.pixelWidthHeightRatio : 1f;
                applyAspect();
            }

            @Override
            public void onMediaMetadataChanged(androidx.media3.common.MediaMetadata md) {
                if (items == null || index >= items.size() || !isRadio(items.get(index))) return;
                CharSequence t = md.title != null ? md.title : md.artist;
                if (t != null && t.length() > 0) radioNow.setText(md.artist != null && md.title != null ? md.artist + " – " + md.title : t);
            }

            @Override
            public void onRenderedFirstFrame() {
                handler.removeCallbacks(noPicture);
            }

            @Override
            public void onCues(CueGroup cueGroup) {
                if (subDelay > 0) handler.postDelayed(() -> subtitles.setCues(cueGroup.cues), subDelay);
                else subtitles.setCues(cueGroup.cues);
            }

            @Override
            public void onPlaybackStateChanged(int state) {
                spinner.setVisibility(state == Player.STATE_BUFFERING ? View.VISIBLE : View.GONE);
                handler.removeCallbacks(stall);
                if (state == Player.STATE_BUFFERING && live && !onFile && !isRadio(items.get(index))) handler.postDelayed(stall, 15000);
                if (state == Player.STATE_READY) {
                    retries = 0;
                    errorView.setVisibility(View.GONE);
                    applyNight();
                }
                if (state == Player.STATE_ENDED && live && onFile) {
                    long pos = player.getCurrentPosition();
                    if (shiftElapsed() - pos < 4000) goLive();
                    else handler.postDelayed(() -> {
                        if (!closing && player != null && onFile) playFile(pos, true);
                    }, 400);
                }
                if (state == Player.STATE_ENDED && !live) {
                    if (autoNext && !stopAfter && index + 1 < items.size()) {
                        done.add(items.get(index).id);
                        startPosition = 0;
                        startBinge();
                    } else {
                        ended = true;
                        finishWithResult();
                    }
                }
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                handleError(error);
            }
        });
    }

    private void play(int i) {
        index = i;
        Item it = items.get(i);
        history.remove(it.id);
        infoOn = false;
        audioSel = -1;
        subSel = -1;
        subtitles.setCues(new ArrayList<>());
        setMode(live ? BRIEF : BAR);
        long from = (!live && startPosition > 0) ? startPosition : C.TIME_UNSET;
        String url = (altTry > 0 && altTry <= it.alt.length) ? it.alt[altTry - 1] : it.url;
        boolean radio = isRadio(it);
        radioView.setVisibility(radio ? View.VISIBLE : View.GONE);
        if (radio) {
            radioTitle.setText(it.title);
            radioNow.setText(it.group);
        }
        handler.removeCallbacks(noPicture);
        if (live && !it.group.toLowerCase(Locale.ROOT).contains("radio")) handler.postDelayed(noPicture, 20000);
        curUrl = url;
        onFile = false;
        shiftWait = false;
        applyItemPrefs(it);
        player.setMediaItem(MediaItem.fromUri(url), from);
        player.prepare();
        player.setPlayWhenReady(true);
        if (live && tsAuto && !shiftOn) startShift();
    }

    private void applyItemPrefs(Item it) {
        float vol = live ? prefs().getFloat("vol:" + it.id, 1f) : 1f;
        player.setVolume(vol);
        if (live) {
            int sa = prefs().getInt("asp:" + it.id, -1);
            if (sa >= 0 && sa != aspect) {
                aspect = sa;
                applyAspect();
            }
        }
        introDone = false;
        introAt = (!live && autoIntro && !it.showId.isEmpty()) ? prefs().getLong("ia:" + it.showId, 0L) : 0L;
        if (!live && !it.showId.isEmpty()) {
            String al = prefs().getString("a:" + it.showId, null);
            String sl = prefs().getString("s:" + it.showId, null);
            TrackSelectionParameters.Builder tb = player.getTrackSelectionParameters().buildUpon();
            if (al != null && !al.isEmpty()) tb.setPreferredAudioLanguage(al);
            if (sl != null) {
                if (sl.isEmpty()) tb.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true);
                else tb.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false).setPreferredTextLanguage(sl);
            }
            player.setTrackSelectionParameters(tb.build());
        }
    }

    private static final float[] VOLS = {1f, 0.8f, 0.6f, 0.45f, 0.3f};

    private void cycleVol() {
        Item it = items.get(index);
        float cur = prefs().getFloat("vol:" + it.id, 1f);
        int n = 0;
        for (int i = 0; i < VOLS.length; i++) if (Math.abs(VOLS[i] - cur) < 0.02f) n = i;
        n = (n + 1) % VOLS.length;
        prefs().edit().putFloat("vol:" + it.id, VOLS[n]).apply();
        player.setVolume(VOLS[n]);
        flash("Volume van deze zender: " + Math.round(VOLS[n] * 100) + "%");
    }

    private final Runnable stall = () -> {
        if (closing || player == null || !live || onFile || player.getPlaybackState() != Player.STATE_BUFFERING) return;
        if (retries >= 3) return;
        retries++;
        flash("Zender hapert: opnieuw verbinden…");
        play(index);
    };

    private final Runnable noPicture = () -> {
        if (closing || player == null || !live) return;
        flash("Geen beeld op deze zender: probeer een andere met ▲ of ▼");
    };

    private void handleError(PlaybackException error) {
        ErrLog.add(this, items.get(index).id, items.get(index).title, error.getErrorCodeName());
        if (live && onFile) {
            flash("Terugkijken lukt niet: terug naar live");
            goLive();
            return;
        }
        Item cur = items.get(index);
        if (live && altTry < cur.alt.length) {
            altTry++;
            flash("Reservezender " + altTry + " proberen…");
            handler.postDelayed(() -> {
                if (!closing) play(index);
            }, 1000);
            return;
        }
        errorView.setText(friendly(error) + (live ? "\nDruk op OK, ▲ of ▼ voor een andere zender" : ""));
        errorView.setVisibility(View.VISIBLE);
        if (live && retries < 3) {
            retries++;
            handler.postDelayed(() -> {
                if (!closing) play(index);
            }, 3000);
        }
    }

    private String friendly(PlaybackException e) {
        int c = e.errorCode;
        if (c == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED || c == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT)
            return "Geen verbinding met de zender";
        if (c == PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS || c == PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND)
            return "De zender reageert niet of bestaat niet meer";
        if (c == PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED || c == PlaybackException.ERROR_CODE_PARSING_MANIFEST_MALFORMED)
            return "De zender stuurt een onleesbaar signaal";
        if (c == PlaybackException.ERROR_CODE_DECODER_INIT_FAILED || c == PlaybackException.ERROR_CODE_DECODING_FAILED)
            return "Dit beeldformaat wordt niet ondersteund";
        return getString(R.string.player_error) + " (" + e.getErrorCodeName() + ")";
    }

    private void zap(int delta) {
        if (!live || items.size() < 2) {
            setMode(BRIEF);
            return;
        }
        gotoChannel((index + delta + items.size()) % items.size());
    }

    private void gotoChannel(int i) {
        if (i == index) {
            setMode(BRIEF);
            return;
        }
        String prev = items.get(index).id;
        history.remove(prev);
        history.add(0, prev);
        retries = 0;
        altTry = 0;
        stopShift();
        errorView.setVisibility(View.GONE);
        play(i);
    }

    private void previousChannel() {
        for (String id : history) {
            for (int i = 0; i < items.size(); i++) {
                if (items.get(i).id.equals(id) && i != index) {
                    gotoChannel(i);
                    return;
                }
            }
        }
        setMode(BRIEF);
    }

    private void tuneDigits() {
        String d = digits;
        digits = "";
        numView.setVisibility(View.GONE);
        if (d.isEmpty()) return;
        int n;
        try {
            n = Integer.parseInt(d);
        } catch (NumberFormatException e) {
            return;
        }
        for (int i = 0; i < items.size(); i++) {
            if (items.get(i).num == n) {
                gotoChannel(i);
                return;
            }
        }
        for (int i = 0; i < items.size(); i++) {
            if (items.get(i).num == 0 && i + 1 == n) {
                gotoChannel(i);
                return;
            }
        }
        errorView.setText("Zender " + n + " bestaat niet");
        errorView.setVisibility(View.VISIBLE);
        handler.postDelayed(() -> errorView.setVisibility(View.GONE), 1500);
    }

    private void flash(String msg) {
        flashView.setText(msg);
        flashView.setVisibility(View.VISIBLE);
        handler.removeCallbacks(flashHide);
        handler.postDelayed(flashHide, 2200);
    }

    /** Picture format: fit, fill (zoom) or stretch. */
    private void applyAspect() {
        if (vw <= 0 || vh <= 0) return;
        DisplayMetrics dm = getResources().getDisplayMetrics();
        float sw = dm.widthPixels;
        float sh = dm.heightPixels;
        float va = vw * vpar / vh;
        float ww;
        float hh;
        if (aspect == 2) {
            ww = sw;
            hh = sh;
        } else if ((sw / sh > va) == (aspect == 0)) {
            hh = sh;
            ww = sh * va;
        } else {
            ww = sw;
            hh = sw / va;
        }
        surface.setLayoutParams(new FrameLayout.LayoutParams(Math.round(ww), Math.round(hh), Gravity.CENTER));
    }

    private void cycleTrack(int type) {
        List<Tracks.Group> gs = new ArrayList<>();
        for (Tracks.Group g : player.getCurrentTracks().getGroups()) {
            if (g.getType() == type && g.isSupported()) gs.add(g);
        }
        boolean text = type == C.TRACK_TYPE_TEXT;
        if (gs.isEmpty()) {
            flash(text ? "Geen ondertitels beschikbaar" : "Geen andere audiosporen");
            return;
        }
        int next = (text ? subSel : audioSel) + 1;
        TrackSelectionParameters.Builder b = player.getTrackSelectionParameters().buildUpon();
        String name;
        if (next >= gs.size()) {
            next = -1;
            if (text) b.setTrackTypeDisabled(type, true);
            else b.clearOverridesOfType(type);
            name = text ? "Ondertitels uit" : "Audio: standaard";
        } else {
            Format f = gs.get(next).getTrackFormat(0);
            String lang = f.label != null ? f.label : f.language != null ? f.language : "spoor " + (next + 1);
            name = (text ? "Ondertitels: " : "Audio: ") + lang;
            b.setTrackTypeDisabled(type, false).setOverrideForType(new TrackSelectionOverride(gs.get(next).getMediaTrackGroup(), 0));
        }
        player.setTrackSelectionParameters(b.build());
        if (text) subSel = next;
        else audioSel = next;
        Item cur = items.get(index);
        if (!cur.showId.isEmpty()) {
            String code = "";
            if (next >= 0) {
                Format sf = gs.get(next).getTrackFormat(0);
                code = sf.language != null ? sf.language : "";
            }
            if (!text && next < 0) prefs().edit().remove("a:" + cur.showId).apply();
            else prefs().edit().putString((text ? "s:" : "a:") + cur.showId, code).apply();
        }
        flash(name);
    }

    /** Back to the start of the programme on now, when the stream keeps a window of the past. */
    private void restartShow() {
        Item it = items.get(index);
        long now = System.currentTimeMillis();
        int n = progNow(it, now);
        if (n < 0) {
            flash("Geen programma-informatie voor deze zender");
            return;
        }
        if (!player.isCurrentMediaItemSeekable()) {
            flash("Deze zender laat geen terugspoelen toe");
            return;
        }
        long back = now - it.ps[n];
        long target = player.getCurrentPosition() - back;
        if (target < 0) {
            player.seekTo(0);
            flash("Begin niet meer beschikbaar, je kijkt vanaf " + Math.round(player.getCurrentPosition() / 60000f) + " min terug");
        } else {
            player.seekTo(target);
            flash("Programma opnieuw gestart");
        }
    }

    private void loadLogo(final String url, final ImageView v) {
        if (url == null || url.isEmpty()) return;
        Bitmap cached = logos.get(url);
        if (cached != null) {
            v.setImageBitmap(cached);
            return;
        }
        v.setTag(url);
        synchronized (loadingLogos) {
            if (!loadingLogos.add(url)) return;
        }
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(5000);
                c.setReadTimeout(8000);
                c.setRequestProperty("User-Agent", userAgent);
                try (InputStream in = c.getInputStream()) {
                    Bitmap bm = BitmapFactory.decodeStream(in);
                    if (bm != null) logos.put(url, bm);
                }
            } catch (Exception ignored) {
                // No logo: the tile just shows the name.
            }
            synchronized (loadingLogos) {
                loadingLogos.remove(url);
            }
        }).start();
    }

    private void cycleSleep() {
        sleepIdx = (sleepIdx + 1) % SLEEPS.length;
        handler.removeCallbacks(sleepRun);
        if (sleepIdx > 0) {
            handler.postDelayed(sleepRun, SLEEPS[sleepIdx] * 60000L);
            flash("Slaaptimer: stopt over " + SLEEPS[sleepIdx] + " minuten");
        } else {
            flash("Slaaptimer uit");
        }
    }

    private File shiftFile() {
        return new File(getCacheDir(), "timeshift.ts");
    }

    private void startShift() {
        File f = shiftFile();
        f.delete();
        if (Recorder.SHIFT.begin(f, curUrl, "timeshift", userAgent, 90).isEmpty()) return;
        shiftStart = System.currentTimeMillis();
        shiftOn = true;
    }

    private void stopShift() {
        Recorder.SHIFT.stop();
        shiftOn = false;
        onFile = false;
        shiftWait = false;
        shiftFile().delete();
    }

    private long shiftElapsed() {
        return shiftOn ? System.currentTimeMillis() - shiftStart : 0;
    }

    /** Plays the buffered stream from this position (milliseconds after the buffer started). */
    private void playFile(long posMs, boolean playNow) {
        onFile = true;
        shiftWait = false;
        player.setMediaItem(MediaItem.fromUri(Uri.fromFile(shiftFile())), Math.max(0, posMs));
        player.prepare();
        player.setPlayWhenReady(playNow);
    }

    private void goLive() {
        if (!live) return;
        stopShift();
        retries = 0;
        altTry = 0;
        errorView.setVisibility(View.GONE);
        play(index);
    }

    private void tsPause() {
        if (onFile) {
            player.setPlayWhenReady(!player.getPlayWhenReady());
        } else if (shiftWait) {
            playFile(0, true);
        } else if (shiftOn) {
            playFile(Math.max(0, shiftElapsed() - 1500), false);
            flash("Gepauzeerd: OK om verder te kijken");
        } else {
            startShift();
            player.stop();
            shiftWait = true;
            flash("Gepauzeerd: OK om verder te kijken");
        }
    }

    private void tsBack() {
        if (onFile) {
            player.seekTo(Math.max(0, player.getCurrentPosition() - 30000));
        } else if (shiftOn && shiftElapsed() > 5000) {
            playFile(Math.max(0, shiftElapsed() - 30000), true);
        } else {
            flash("Pauzeer eerst, of zet Terugkijken aan bij Instellingen → Afspelen");
        }
    }

    private void tsFwd() {
        if (!onFile) {
            flash("Je kijkt al live");
            return;
        }
        long target = player.getCurrentPosition() + 30000;
        if (target >= shiftElapsed() - 4000) goLive();
        else player.seekTo(target);
    }

    private void applyNight() {
        try {
            if (dyn != null) {
                dyn.release();
                dyn = null;
            }
            if (night == 0 || player == null) return;
            DynamicsProcessing.Config cfg = new DynamicsProcessing.Config.Builder(
                    DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION, 2, false, 0, false, 0, false, 0, true).build();
            dyn = new DynamicsProcessing(0, player.getAudioSessionId(), cfg);
            DynamicsProcessing.Limiter lim = new DynamicsProcessing.Limiter(true, true, 0, 1f, 80f, night == 1 ? 4f : 10f, night == 1 ? -20f : -32f, night == 1 ? 4f : 10f);
            dyn.setLimiterAllChannelsTo(lim);
            dyn.setEnabled(true);
        } catch (Throwable t) {
            night = 0;
            flash("Nachtmodus werkt niet op dit apparaat");
        }
    }

    private void playNext() {
        if (live || index + 1 >= items.size()) {
            flash("Geen volgende aflevering");
            return;
        }
        long dur = player.getDuration();
        if (dur != C.TIME_UNSET && player.getCurrentPosition() > 0.9 * dur) done.add(items.get(index).id);
        startPosition = 0;
        retries = 0;
        altTry = 0;
        play(index + 1);
    }

    private String techLine() {
        Format f = player.getVideoFormat();
        if (f == null) return "";
        StringBuilder s = new StringBuilder();
        if (f.width > 0) s.append(f.width).append('x').append(f.height);
        if (f.sampleMimeType != null) s.append("  ·  ").append(f.sampleMimeType.replace("video/", ""));
        if (f.bitrate > 0) s.append("  ·  ").append(Math.round(f.bitrate / 100000f) / 10f).append(" Mb/s");
        long bw = DefaultBandwidthMeter.getSingletonInstance(this).getBitrateEstimate();
        if (bw > 0) s.append("\nVerbinding ").append(Math.round(bw / 100000f) / 10f).append(" Mb/s  ·  buffer ").append(player.getTotalBufferedDuration() / 1000).append(" s");
        return s.toString();
    }

    private void seekBy(long deltaMs) {
        if (live) return;
        long dur = player.getDuration();
        long target = player.getCurrentPosition() + deltaMs;
        if (dur != C.TIME_UNSET) target = Math.min(target, dur - 1000);
        player.seekTo(Math.max(0, target));
        setMode(BAR);
    }

    // ---------- overlay ----------

    private void setMode(int m) {
        mode = m;
        handler.removeCallbacks(hide);
        if (m != BAR) {
            vodFocus = false;
            optsShown = false;
        }
        bottom.setVisibility(m == HIDDEN || m == LIST ? View.GONE : View.VISIBLE);
        actionsRow.setVisibility(m == BAR ? View.VISIBLE : View.GONE);
        if (topBar != null) topBar.setVisibility(live && (m == BAR || m == BRIEF) ? View.VISIBLE : View.GONE);
        recentRow.setVisibility(live && (m == BAR || m == BRIEF) ? View.VISIBLE : View.GONE);
        chNum.setVisibility(live && m != HIDDEN ? View.VISIBLE : View.GONE);
        if (m == HIDDEN || m == LIST || !live) peekView.setVisibility(View.GONE);
        listPanel.setVisibility(m == LIST ? View.VISIBLE : View.GONE);
        if (m == LIST) {
            listSel = index;
        }
        refresh();
        if (m == BRIEF) handler.postDelayed(hide, overlayMs);
        else if (m == BAR) handler.postDelayed(hide, live ? overlayMs + 4000 : overlayMs);
    }

    private void bumpHide() {
        if (mode == BAR) {
            handler.removeCallbacks(hide);
            handler.postDelayed(hide, live ? overlayMs + 4000 : overlayMs);
        }
    }

    private void refresh() {
        if (player == null || mode == HIDDEN) return;
        Item it = items.get(index);
        long now = System.currentTimeMillis();
        if (live) {
            int n = progNow(it, now);
            int x = progNext(it, now);
            chNum.setText(it.num > 0 ? String.valueOf(it.num) : String.valueOf(index + 1));
            titleView.setText(n >= 0 ? it.pt[n] : it.title);
            String dd = n >= 0 ? it.pd[n] : "";
            if (dd.length() > 110) dd = dd.substring(0, 107) + "...";
            subView.setText(dd.isEmpty() ? it.group : dd);
            nextView.setText(it.title + (x >= 0 ? "   ·   Hierna: " + it.pt[x] + " (" + hm(it.ps[x]) + ")" : ""));
            nextView.setVisibility(View.VISIBLE);
            if (items.size() > 1 && mode != LIST) {
                Item nx = items.get((index + 1) % items.size());
                int nn = progNow(nx, now);
                peekView.setText("▼ " + (nx.num > 0 ? nx.num + "  " : "") + nx.title + (nn >= 0 ? "\n" + nx.pt[nn] : ""));
                peekView.setVisibility(View.VISIBLE);
            } else peekView.setVisibility(View.GONE);
            String d = n >= 0 ? it.pd[n] : "";
            if (infoOn) d = (d.isEmpty() ? "" : d + "\n") + techLine();
            descView.setText(d);
            descView.setVisibility(infoOn && !d.isEmpty() ? View.VISIBLE : View.GONE);
            timeView.setText(n >= 0 ? hm(it.ps[n]) + " - " + hm(it.pe[n]) : "");
            if (clockView != null) clockView.setText(hm(now));
            if (mainLogo != null) {
                mainLogo.setImageDrawable(null);
                loadLogo(it.logo, mainLogo);
            }
            int pv = progPrev(it, now);
            if (prevTile != null) {
                prevTile.setVisibility(pv >= 0 ? View.VISIBLE : View.INVISIBLE);
                if (pv >= 0) {
                    prevTitle.setText(it.pt[pv]);
                    prevTime.setText(hm(it.ps[pv]) + " - " + hm(it.pe[pv]));
                }
            }
            if (nextTile != null) {
                nextTile.setVisibility(x >= 0 ? View.VISIBLE : View.INVISIBLE);
                if (x >= 0) {
                    nextTitle.setText(it.pt[x]);
                    nextTime.setText(hm(it.ps[x]) + " - " + hm(it.pe[x]));
                }
            }
            if (n >= 0 && it.pe[n] > it.ps[n]) {
                bar.setVisibility(View.VISIBLE);
                bar.setMax(1000);
                bar.setProgress((int) (1000L * (now - it.ps[n]) / (it.pe[n] - it.ps[n])));
            } else {
                bar.setVisibility(View.GONE);
            }
            paintActions();
            paintRecent(now);
            if (mode == LIST) paintList(now);
        } else {
            long dur = player.getDuration();
            titleView.setText(it.title);
            nextView.setVisibility(View.GONE);
            String tech = infoOn ? techLine() : "";
            descView.setText(tech);
            descView.setVisibility(tech.isEmpty() ? View.GONE : View.VISIBLE);
            if (mode == BAR) paintActions();
            if (dur == C.TIME_UNSET) {
                bar.setVisibility(View.GONE);
                subView.setText("");
                timeView.setText("");
            } else {
                bar.setVisibility(View.VISIBLE);
                bar.setMax((int) (dur / 1000));
                bar.setProgress((int) (player.getCurrentPosition() / 1000));
                subView.setText("");
                timeView.setText(format(player.getCurrentPosition()) + " / " + format(dur));
            }
        }
    }

    private String[] acts() {
        return live ? LIVE_ACTS : VOD_ACTS;
    }

    private String labelFor(String a) {
        switch (a) {
            case "pp": return player != null && !player.getPlayWhenReady() ? (live && !onFile && !shiftOn ? "▶ Hervatten bij live" : "▶") : "II";
            case "restart": return "↺";
            case "list": return "≡ Lijst";
            case "fav": return favs.contains(items.get(index).id) ? "★ Favoriet" : "☆ Favoriet";
            case "prev": return "⟲ Vorige";
            case "info": return infoOn ? "i  aan" : "i  Info";
            case "aspect": return aspect == 0 ? "Beeld: passend" : aspect == 1 ? "Beeld: vullen" : "Beeld: rekken";
            case "audio": return audioSel >= 0 ? "Taal " + (audioSel + 1) : "Taal";
            case "subs": return subSel >= 0 ? "CC " + (subSel + 1) : "CC";
            case "tsback": return "⏪ 30 s";
            case "tsfwd": return "30 s ⏩";
            case "golive": return onFile ? "● Live (−" + format(Math.max(0, shiftElapsed() - player.getCurrentPosition())) + ")" : "● Live";
            case "rec": return Recorder.REC.active() ? "■ Stop opname" : "● Opnemen";
            case "vol": {
                float v = prefs().getFloat("vol:" + items.get(index).id, 1f);
                return "Volume " + Math.round(v * 100) + "%";
            }
            case "night": return night == 0 ? "Nacht: uit" : night == 1 ? "Nacht: licht" : "Nacht: sterk";
            case "credits": return "Aftiteling over";
            case "subdelay": return subDelay == 0 ? "Ondertitel: op tijd" : "Ondertitel +" + (subDelay / 1000f) + "s";
            case "repeat": return repeatOne ? "Herhalen: aan" : "Herhalen: uit";
            case "stopafter": return stopAfter ? "Stop erna: aan" : "Stop erna: uit";
            case "sleep": return sleepIdx == 0 ? "Slaaptimer" : "Slaap " + SLEEPS[sleepIdx] + "m";
            case "skip": return "Intro overslaan";
            case "next": return "Volgende";
            case "speed": return SPEEDS[speedIdx] + "x";
            default: return a;
        }
    }

    private GradientDrawable oval(int color) {
        GradientDrawable g = new GradientDrawable();
        g.setShape(GradientDrawable.OVAL);
        g.setColor(color);
        return g;
    }

    private void paintActions() {
        String[] a = acts();
        boolean focus = (live && mode == BAR) || vodFocus;
        optsRow.setVisibility(optsShown && mode == BAR ? View.VISIBLE : View.GONE);
        for (int i = 0; i < actionViews.length; i++) {
            if (i >= a.length) {
                actionViews[i].setVisibility(View.GONE);
                continue;
            }
            actionViews[i].setVisibility(View.VISIBLE);
            boolean sel = focus && i == action;
            actionViews[i].setText(labelFor(a[i]));
            actionViews[i].setTextColor(sel ? onAccent() : Color.WHITE);
            int bg = sel ? accent : 0x66000000;
            actionViews[i].setBackground((i == 0 || (i == 1 && live)) ? oval(bg) : rounded(bg, 14));
        }
    }

    /** Moves the focus left or right inside the row it is in (main row or options row). */
    private void moveAction(int d) {
        int lo = action < PRIMARY ? 0 : PRIMARY;
        int hi = action < PRIMARY ? PRIMARY : acts().length;
        action = lo + (action - lo + d + (hi - lo)) % (hi - lo);
        refresh();
        bumpHide();
    }

    private void paintRecent(long now) {
        recentRow.removeAllViews();
        int shown = 0;
        for (String id : history) {
            if (shown >= 3) break;
            Item it = null;
            for (Item c : items) if (c.id.equals(id)) { it = c; break; }
            if (it == null || it == items.get(index)) continue;
            int n = progNow(it, now);
            LinearLayout tile = new LinearLayout(this);
            tile.setOrientation(LinearLayout.VERTICAL);
            tile.setPadding(dp(12), dp(8), dp(12), dp(8));
            tile.setBackground(rounded(0xCC000000, 6));
            LinearLayout head = new LinearLayout(this);
            head.setOrientation(LinearLayout.HORIZONTAL);
            head.setGravity(Gravity.CENTER_VERTICAL);
            TextView num = text(15, Color.WHITE, true);
            num.setText(it.num > 0 ? String.valueOf(it.num) : "");
            head.addView(num);
            ImageView logo = new ImageView(this);
            logo.setScaleType(ImageView.ScaleType.FIT_START);
            LinearLayout.LayoutParams ilp = new LinearLayout.LayoutParams(dp(70), dp(26));
            ilp.setMargins(dp(10), 0, 0, 0);
            head.addView(logo, ilp);
            loadLogo(it.logo, logo);
            tile.addView(head);
            TextView nm = text(12, Color.WHITE, true);
            nm.setSingleLine(true);
            nm.setText(it.title);
            TextView pr = text(12, 0xCCFFFFFF, false);
            pr.setSingleLine(true);
            pr.setText(n >= 0 ? it.pt[n] : "");
            tile.addView(nm);
            tile.addView(pr);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(170), -2);
            lp.setMargins(0, 0, dp(10), 0);
            recentRow.addView(tile, lp);
            shown++;
        }
    }

    private void paintList(long now) {
        int n = items.size();
        int first = Math.max(0, Math.min(listSel - ROWS / 2, n - ROWS));
        for (int r = 0; r < ROWS; r++) {
            int i = first + r;
            TextView t = listRows[r];
            if (i < 0 || i >= n) {
                t.setVisibility(View.INVISIBLE);
                continue;
            }
            Item it = items.get(i);
            int p = progNow(it, now);
            t.setVisibility(View.VISIBLE);
            t.setText((it.num > 0 ? it.num : i + 1) + "   " + it.title + (favs.contains(it.id) ? "  ★" : "") + (p >= 0 ? "\n" : ""));
            t.setSingleLine(false);
            t.setMaxLines(2);
            if (p >= 0) t.append(it.pt[p]);
            boolean sel = i == listSel;
            t.setTextColor(sel ? onAccent() : Color.WHITE);
            t.setBackground(sel ? rounded(accent, 10) : null);
        }
    }

    private static String format(long ms) {
        long s = Math.max(0, ms / 1000);
        return s >= 3600
                ? String.format(Locale.US, "%d:%02d:%02d", s / 3600, (s / 60) % 60, s % 60)
                : String.format(Locale.US, "%d:%02d", s / 60, s % 60);
    }

    private void doAction() {
        switch (acts()[action]) {
            case "pp":
                if (live && !onFile && !shiftOn && !shiftWait) {
                    if (player.getPlayWhenReady()) {
                        pausedAt = System.currentTimeMillis();
                        player.setPlayWhenReady(false);
                    } else if (System.currentTimeMillis() - pausedAt > 4000) {
                        goLive();
                    } else player.setPlayWhenReady(true);
                } else if (live) tsPause();
                else player.setPlayWhenReady(!player.getPlayWhenReady());
                break;
            case "restart":
                restartShow();
                break;
            case "list":
                setMode(LIST);
                return;
            case "fav": {
                String id = items.get(index).id;
                if (!favs.remove(id)) favs.add(id);
                break;
            }
            case "prev":
                previousChannel();
                return;
            case "info":
                infoOn = !infoOn;
                break;
            case "aspect":
                aspect = (aspect + 1) % 3;
                applyAspect();
                if (live) prefs().edit().putInt("asp:" + items.get(index).id, aspect).apply();
                break;
            case "audio":
                cycleTrack(C.TRACK_TYPE_AUDIO);
                break;
            case "subs":
                cycleTrack(C.TRACK_TYPE_TEXT);
                break;
            case "tsback":
                tsBack();
                break;
            case "tsfwd":
                tsFwd();
                break;
            case "golive":
                if (onFile || shiftWait) goLive();
                else flash("Je kijkt al live");
                break;
            case "rec":
                if (Recorder.REC.active()) {
                    Recorder.REC.stop();
                    flash("Opname gestopt: te vinden bij Instellingen → Opnames");
                } else {
                    Item cur = items.get(index);
                    String path = Recorder.REC.start(this, cur.url, cur.title, userAgent, recMin);
                    flash(path.isEmpty() ? "Er loopt al een opname" : "Opname gestart: " + cur.title + " (max " + recMin + " min)");
                }
                break;
            case "vol":
                cycleVol();
                break;
            case "night":
                night = (night + 1) % 3;
                applyNight();
                if (night > 0) flash("Nachtmodus: " + (night == 1 ? "licht" : "sterk") + " (zachtere pieken)");
                break;
            case "repeat":
                repeatOne = !repeatOne;
                player.setRepeatMode(repeatOne ? Player.REPEAT_MODE_ONE : Player.REPEAT_MODE_OFF);
                break;
            case "stopafter":
                stopAfter = !stopAfter;
                flash(stopAfter ? "Stopt na deze aflevering" : "Gaat door met de volgende aflevering");
                break;
            case "sleep":
                cycleSleep();
                break;
            case "skip":
                if (!items.get(index).showId.isEmpty()) prefs().edit().putLong("ia:" + items.get(index).showId, player.getCurrentPosition()).apply();
                seekBy(skipMs);
                break;
            case "subdelay":
                subDelayIdx = (subDelayIdx + 1) % SUBDELAYS.length;
                subDelay = SUBDELAYS[subDelayIdx];
                flash(subDelay == 0 ? "Ondertitels op tijd" : "Ondertitels komen " + (subDelay / 1000f) + " s later");
                break;
            case "credits":
                if (index + 1 < items.size()) {
                    playNext();
                    return;
                }
                if (player.getDuration() != C.TIME_UNSET) player.seekTo(Math.max(0, player.getDuration() - 1500));
                break;
            case "next":
                playNext();
                return;
            case "speed":
                speedIdx = (speedIdx + 1) % SPEEDS.length;
                player.setPlaybackSpeed(SPEEDS[speedIdx]);
                break;
            default:
                break;
        }
        refresh();
        bumpHide();
    }

    // ---------- keys ----------

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (bingeLeft > 0) {
            if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER) bingeNow();
            else if (keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_ESCAPE) bingeCancel();
            return true;
        }
        if (keyCode == KeyEvent.KEYCODE_MEDIA_AUDIO_TRACK) {
            cycleTrack(C.TRACK_TYPE_AUDIO);
            return true;
        }
        if (keyCode == KeyEvent.KEYCODE_CAPTIONS) {
            cycleTrack(C.TRACK_TYPE_TEXT);
            return true;
        }
        if (keyCode == KeyEvent.KEYCODE_LAST_CHANNEL && live) {
            previousChannel();
            return true;
        }
        if (keyCode >= KeyEvent.KEYCODE_0 && keyCode <= KeyEvent.KEYCODE_9 && live) {
            if (digits.length() < 4) digits += (keyCode - KeyEvent.KEYCODE_0);
            numView.setText(digits);
            numView.setVisibility(View.VISIBLE);
            handler.removeCallbacks(tune);
            handler.postDelayed(tune, 1500);
            return true;
        }
        if (live && errorView.getVisibility() == View.VISIBLE
                && (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER)) {
            zap(1);
            return true;
        }
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_UP:
                if (mode == LIST) {
                    listSel = (listSel - 1 + items.size()) % items.size();
                    refresh();
                } else if (mode == BAR && optsShown) {
                    optsShown = false;
                    action = 0;
                    refresh();
                    bumpHide();
                } else if (mode == BAR && live) setMode(HIDDEN);
                else if (mode == BAR && vodFocus) {
                    vodFocus = false;
                    refresh();
                    bumpHide();
                } else if (live) zap(-1);
                else setMode(BAR);
                return true;
            case KeyEvent.KEYCODE_DPAD_DOWN:
                if (mode == LIST) {
                    listSel = (listSel + 1) % items.size();
                    refresh();
                } else if (mode == BAR && (live || vodFocus)) {
                    if (!optsShown) {
                        optsShown = true;
                        action = PRIMARY;
                    }
                    refresh();
                    bumpHide();
                } else if (mode == BAR) {
                    vodFocus = true;
                    action = 0;
                    refresh();
                    bumpHide();
                } else if (live) zap(1);
                else setMode(BAR);
                return true;
            case KeyEvent.KEYCODE_CHANNEL_UP:
                zap(1);
                return true;
            case KeyEvent.KEYCODE_CHANNEL_DOWN:
                zap(-1);
                return true;
            case KeyEvent.KEYCODE_DPAD_LEFT:
                if (live) {
                    if (mode == BAR) {
                        moveAction(-1);
                    } else if (mode != LIST) {
                        action = 0;
                        setMode(BAR);
                    }
                } else if (mode == BAR && vodFocus) {
                    moveAction(-1);
                } else seekBy(-seekBack);
                return true;
            case KeyEvent.KEYCODE_DPAD_RIGHT:
                if (live) {
                    if (mode == BAR) {
                        moveAction(1);
                    } else if (mode != LIST) {
                        action = 0;
                        setMode(BAR);
                    }
                } else if (mode == BAR && vodFocus) {
                    moveAction(1);
                } else seekBy(seekFwd);
                return true;
            case KeyEvent.KEYCODE_MEDIA_REWIND:
                seekBy(-seekBack);
                return true;
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                seekBy(seekFwd);
                return true;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
                if (event.getRepeatCount() > 0) return true;
                if (live && (mode == HIDDEN || mode == BRIEF)) {
                    long nowMs = System.currentTimeMillis();
                    if (nowMs - lastOk < 350) {
                        lastOk = 0;
                        for (int i = 0; i < acts().length; i++) {
                            if ("fav".equals(acts()[i])) {
                                int old = action;
                                action = i;
                                doAction();
                                action = old;
                                break;
                            }
                        }
                        return true;
                    }
                    lastOk = nowMs;
                }
                if (live) {
                    if (mode == LIST) {
                        gotoChannel(listSel);
                        setMode(BRIEF);
                    } else if (mode == BAR) doAction();
                    else {
                        action = 0;
                        setMode(BAR);
                    }
                } else if (mode == BAR && vodFocus) {
                    doAction();
                } else {
                    player.setPlayWhenReady(!player.getPlayWhenReady());
                    setMode(BAR);
                }
                return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                if (!live) player.setPlayWhenReady(!player.getPlayWhenReady());
                setMode(BAR);
                return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY:
                player.setPlayWhenReady(true);
                return true;
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
                if (!live) player.setPlayWhenReady(false);
                return true;
            case KeyEvent.KEYCODE_MENU:
            case KeyEvent.KEYCODE_GUIDE:
                if (live) setMode(LIST);
                else setMode(BAR);
                return true;
            case KeyEvent.KEYCODE_INFO:
                infoOn = true;
                action = 6;
                optsShown = true;
                setMode(BAR);
                return true;
            default:
                return super.onKeyDown(keyCode, event);
        }
    }

    @Override
    public void onBackPressed() {
        if (bingeLeft > 0) {
            bingeCancel();
            return;
        }
        if (mode == LIST) {
            setMode(BAR);
            return;
        }
        if (mode == BAR && live) {
            setMode(HIDDEN);
            return;
        }
        finishWithResult();
    }

    private void finishWithResult() {
        if (closing) return;
        closing = true;
        JSONObject o = new JSONObject();
        try {
            o.put("id", items.get(index).id);
            o.put("live", live);
            o.put("ended", ended);
            long dur = player == null ? C.TIME_UNSET : player.getDuration();
            o.put("position", player == null ? 0 : player.getCurrentPosition());
            o.put("duration", dur == C.TIME_UNSET ? 0 : dur);
            o.put("favs", new JSONArray(favs));
            o.put("done", new JSONArray(done));
            JSONObject w = new JSONObject();
            for (Map.Entry<String, Long> e : watch.entrySet()) w.put(e.getKey(), e.getValue());
            o.put("watch", w);
        } catch (JSONException ignored) {
            // Keys and numbers only; cannot fail.
        }
        setResult(RESULT_OK, new Intent().putExtra("result", o.toString()));
        finish();
    }

    @Override
    protected void onStop() {
        super.onStop();
        boolean radio = live && items != null && index < items.size() && items.get(index).group.toLowerCase(Locale.ROOT).contains("radio");
        if (player != null && !radio) player.pause();
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (player != null && !closing && player.getPlaybackState() != Player.STATE_IDLE) player.play();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        stopShift();
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
