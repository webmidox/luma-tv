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

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

/** Hosts the Luma TV interface (assets/www) and hands playback to {@link PlayerActivity}. */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final int REQ_PLAY = 1;
    private static final String TAG = "LumaTV";

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0B0C12);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        setContentView(web);

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
