package com.luma.tv;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.graphics.Outline;
import android.view.TextureView;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.widget.FrameLayout;

import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

/** Hosts the Luma TV interface (assets/www) and hands playback to {@link PlayerActivity}. */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final int REQ_PLAY = 1;
    private static final String TAG = "LumaTV";

    private WebView web;
    private FrameLayout root;
    private ExoPlayer pv;
    private TextureView pvView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0B0C12);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        WebView.setWebContentsDebuggingEnabled(debuggable);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost()) && FetchProxy.PATH.equals(u.getPath())) {
                    return FetchProxy.handle(getCacheDir(), u);
                }
                return loader.shouldInterceptRequest(u);
            }
        });
        web.addJavascriptInterface(new LumaBridge(this), "LumaNative");
        web.loadUrl("https://" + HOST + "/assets/www/index.html");
        web.requestFocus();
    }

    void startPlayer(String json) {
        try {
            JSONObject check = new JSONObject(json);
            Intent i = new Intent(this, PlayerActivity.class);
            PlayerActivity.pending = check.toString(); // too big for an Intent (TransactionTooLargeException)
            startActivityForResult(i, REQ_PLAY);
        } catch (Exception e) {
            Log.w(TAG, "Bad player request", e);
        }
    }

    /** Muted live picture on top of a card (x, y, w, h in device pixels). One at a time; a failure just leaves the card as it was. */
    void previewStart(final String url, final String ua, final int x, final int y, final int w, final int h, final int radius) {
        runOnUiThread(() -> {
            try {
                previewStop();
                if (url == null || url.isEmpty() || w < 40 || h < 40) return;
                DefaultHttpDataSource.Factory data = new DefaultHttpDataSource.Factory()
                        .setUserAgent(ua == null || ua.trim().isEmpty() ? "LumaTV/0.1" : ua)
                        .setAllowCrossProtocolRedirects(true)
                        .setConnectTimeoutMs(8000)
                        .setReadTimeoutMs(10000);
                pv = new ExoPlayer.Builder(this)
                        .setMediaSourceFactory(new DefaultMediaSourceFactory(new DefaultDataSource.Factory(this, data)))
                        .build();
                pv.setVolume(0f);
                pv.setTrackSelectionParameters(pv.getTrackSelectionParameters().buildUpon()
                        .setMaxVideoSize(1280, 720)
                        .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, true)
                        .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                        .build());
                final TextureView tv = new TextureView(this);
                tv.setFocusable(false);
                tv.setAlpha(0f);
                tv.setOutlineProvider(new ViewOutlineProvider() {
                    @Override
                    public void getOutline(View v, Outline o) {
                        o.setRoundRect(0, 0, v.getWidth(), v.getHeight(), radius);
                    }
                });
                tv.setClipToOutline(true);
                FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(w, h);
                lp.leftMargin = x;
                lp.topMargin = y;
                root.addView(tv, lp);
                pvView = tv;
                pv.setVideoTextureView(tv);
                pv.addListener(new Player.Listener() {
                    @Override
                    public void onRenderedFirstFrame() {
                        tv.animate().alpha(1f).setDuration(350).start();
                    }

                    @Override
                    public void onPlayerError(PlaybackException error) {
                        previewStop();
                    }
                });
                pv.setMediaItem(MediaItem.fromUri(url));
                pv.prepare();
                pv.play();
            } catch (Exception e) {
                Log.w(TAG, "Preview failed", e);
                previewStop();
            }
        });
    }

    void previewStop() {
        runOnUiThread(() -> {
            if (pv != null) {
                try { pv.release(); } catch (Exception e) { /* already gone */ }
                pv = null;
            }
            if (pvView != null) {
                root.removeView(pvView);
                pvView = null;
            }
        });
    }

    @Override
    protected void onPause() {
        previewStop();
        super.onPause();
    }

    /** Runs a line of script in the page; safe to call from any thread. */
    void js(String code) {
        runOnUiThread(() -> web.evaluateJavascript(code, null));
    }

    /** A source typed on the phone arrived; hand it to the interface. */
    void remoteSource(String json) {
        runOnUiThread(() -> web.evaluateJavascript("window.lumaRemoteAdd && window.lumaRemoteAdd(" + json + ")", null));
    }

    /** Progress text for the update screen; safe to call from any thread. */
    void status(String msg) {
        runOnUiThread(() -> web.evaluateJavascript(
                "window.lumaUpdateStatus && window.lumaUpdateStatus(" + JSONObject.quote(msg) + ")", null));
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_PLAY) return;
        String json = data == null ? null : data.getStringExtra("result");
        web.evaluateJavascript("window.lumaPlayerClosed && window.lumaPlayerClosed(" + (json == null ? "null" : json) + ")", null);
    }

    @Override
    public boolean onKeyDown(int keyCode, android.view.KeyEvent ev) {
        String call = null;
        if (keyCode == android.view.KeyEvent.KEYCODE_SEARCH) call = "window.lumaSearch&&window.lumaSearch()";
        else if (keyCode == android.view.KeyEvent.KEYCODE_PROG_RED) call = "window.lumaGo&&window.lumaGo('live')";
        else if (keyCode == android.view.KeyEvent.KEYCODE_PROG_GREEN) call = "window.lumaGo&&window.lumaGo('vod')";
        else if (keyCode == android.view.KeyEvent.KEYCODE_PROG_YELLOW) call = "window.lumaGo&&window.lumaGo('series')";
        else if (keyCode == android.view.KeyEvent.KEYCODE_PROG_BLUE) call = "window.lumaGo&&window.lumaGo('radio')";
        if (call != null && web != null) {
            web.evaluateJavascript(call, null);
            return true;
        }
        return super.onKeyDown(keyCode, ev);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.lumaBack ? window.lumaBack() : false", value -> {
            if (!"true".equals(value)) finish();
        });
    }

    @Override
    protected void onDestroy() {
        RemoteSetup.stop();
        if (web != null) {
            web.removeJavascriptInterface("LumaNative");
            web.destroy();
        }
        super.onDestroy();
    }
}
