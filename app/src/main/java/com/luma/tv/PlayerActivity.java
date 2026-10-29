package com.luma.tv;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.SurfaceView;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Full-screen playback. Live channels can be zapped without leaving the player: up and down (or channel up and
 * down) move through the list the interface passed in. Films and episodes seek with left and right.
 * The result handed back to the interface: {id, live, ended, position, duration}.
 */
public class PlayerActivity extends Activity {
    static final String EXTRA_PAYLOAD = "payload";
    private static final long OVERLAY_MS = 4000;

    private static final class Item {
        String id;
        String title;
        String url;
    }

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<Item> items = new ArrayList<>();
    private int index;
    private boolean live;
    private long startPosition;
    private String userAgent = "LumaTV/0.1";
    private boolean ended;
    private boolean closing;
    private int retries;

    private ExoPlayer player;
    private SurfaceView surface;
    private ProgressBar spinner;
    private View overlay;
    private TextView titleView;
    private TextView timeView;
    private ProgressBar bar;
    private TextView errorView;

    private final Runnable hideOverlay = () -> overlay.setVisibility(View.GONE);
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            updateOverlay();
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

    private boolean readPayload() {
        String raw = getIntent().getStringExtra(EXTRA_PAYLOAD);
        if (raw == null) return false;
        try {
            JSONObject o = new JSONObject(raw);
            live = o.optBoolean("live", false);
            startPosition = o.optLong("position", 0);
            userAgent = o.optString("ua", userAgent);
            if (userAgent.trim().isEmpty()) userAgent = "LumaTV/0.1";
            JSONArray list = o.optJSONArray("list");
            if (list != null && list.length() > 0) {
                for (int i = 0; i < list.length(); i++) items.add(toItem(list.getJSONObject(i)));
                index = Math.max(0, Math.min(items.size() - 1, o.optInt("index", 0)));
            } else {
                items.add(toItem(o));
                index = 0;
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
        return it;
    }

    private void buildUi() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        surface = new SurfaceView(this);
        root.addView(surface, new FrameLayout.LayoutParams(-1, -1));

        spinner = new ProgressBar(this);
        spinner.setVisibility(View.GONE);
        FrameLayout.LayoutParams sp = new FrameLayout.LayoutParams(dp(56), dp(56), Gravity.CENTER);
        root.addView(spinner, sp);

        errorView = new TextView(this);
        errorView.setTextColor(Color.WHITE);
        errorView.setTextSize(20);
        errorView.setGravity(Gravity.CENTER);
        errorView.setVisibility(View.GONE);
        root.addView(errorView, new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER));

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setBackgroundColor(0xB3000000);
        box.setPadding(dp(48), dp(20), dp(48), dp(28));
        titleView = new TextView(this);
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(24);
        titleView.setSingleLine(true);
        timeView = new TextView(this);
        timeView.setTextColor(0xCCFFFFFF);
        timeView.setTextSize(15);
        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        box.addView(titleView);
        box.addView(timeView);
        box.addView(bar, new LinearLayout.LayoutParams(-1, dp(6)));
        overlay = box;
        root.addView(overlay, new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM));

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

    private void initPlayer() {
        DefaultHttpDataSource.Factory data = new DefaultHttpDataSource.Factory()
                .setUserAgent(userAgent)
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(30000);
        player = new ExoPlayer.Builder(this)
                .setMediaSourceFactory(new DefaultMediaSourceFactory(data))
                .build();
        player.setVideoSurfaceView(surface);
        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int state) {
                spinner.setVisibility(state == Player.STATE_BUFFERING ? View.VISIBLE : View.GONE);
                if (state == Player.STATE_READY) {
                    retries = 0;
                    errorView.setVisibility(View.GONE);
                }
                if (state == Player.STATE_ENDED && !live) {
                    ended = true;
                    finishWithResult();
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
        titleView.setText(it.title);
        showOverlay();
        long from = (!live && startPosition > 0) ? startPosition : C.TIME_UNSET;
        player.setMediaItem(MediaItem.fromUri(it.url), from);
        player.prepare();
        player.setPlayWhenReady(true);
    }

    private void handleError(PlaybackException error) {
        errorView.setText(getString(R.string.player_error) + "\n" + error.getErrorCodeName());
        errorView.setVisibility(View.VISIBLE);
        if (live && retries < 3) {
            retries++;
            handler.postDelayed(() -> {
                if (!closing) play(index);
            }, 3000);
        }
    }

    private void zap(int delta) {
        if (!live || items.size() < 2) {
            showOverlay();
            return;
        }
        retries = 0;
        errorView.setVisibility(View.GONE);
        play((index + delta + items.size()) % items.size());
    }

    private void seekBy(long deltaMs) {
        if (live) return;
        long dur = player.getDuration();
        long target = player.getCurrentPosition() + deltaMs;
        if (dur != C.TIME_UNSET) target = Math.min(target, dur - 1000);
        player.seekTo(Math.max(0, target));
        showOverlay();
    }

    private void showOverlay() {
        overlay.setVisibility(View.VISIBLE);
        updateOverlay();
        handler.removeCallbacks(hideOverlay);
        handler.postDelayed(hideOverlay, OVERLAY_MS);
    }

    private void updateOverlay() {
        if (player == null || overlay.getVisibility() != View.VISIBLE) return;
        long dur = player.getDuration();
        if (live || dur == C.TIME_UNSET) {
            bar.setVisibility(View.GONE);
            timeView.setText(live ? "LIVE  ▲▼ zappen" : "");
        } else {
            bar.setVisibility(View.VISIBLE);
            bar.setMax((int) (dur / 1000));
            bar.setProgress((int) (player.getCurrentPosition() / 1000));
            timeView.setText(format(player.getCurrentPosition()) + " / " + format(dur));
        }
    }

    private static String format(long ms) {
        long s = Math.max(0, ms / 1000);
        return s >= 3600
                ? String.format(Locale.US, "%d:%02d:%02d", s / 3600, (s / 60) % 60, s % 60)
                : String.format(Locale.US, "%d:%02d", s / 60, s % 60);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_UP:
                if (live) zap(-1);
                else showOverlay();
                return true;
            case KeyEvent.KEYCODE_DPAD_DOWN:
                if (live) zap(1);
                else showOverlay();
                return true;
            case KeyEvent.KEYCODE_CHANNEL_UP:
                zap(1);
                return true;
            case KeyEvent.KEYCODE_CHANNEL_DOWN:
                zap(-1);
                return true;
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_MEDIA_REWIND:
                seekBy(-10000);
                return true;
            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                seekBy(30000);
                return true;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                if (!live) player.setPlayWhenReady(!player.getPlayWhenReady());
                showOverlay();
                return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY:
                player.setPlayWhenReady(true);
                return true;
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
                if (!live) player.setPlayWhenReady(false);
                return true;
            default:
                return super.onKeyDown(keyCode, event);
        }
    }

    @Override
    public void onBackPressed() {
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
        } catch (JSONException ignored) {
            // Keys and numbers only; cannot fail.
        }
        setResult(RESULT_OK, new Intent().putExtra("result", o.toString()));
        finish();
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (player != null) player.pause();
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (player != null && !closing && player.getPlaybackState() != Player.STATE_IDLE) player.play();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
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
