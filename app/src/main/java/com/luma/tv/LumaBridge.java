package com.luma.tv;

import android.webkit.JavascriptInterface;

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

    @JavascriptInterface
    public void exit() {
        activity.runOnUiThread(activity::finish);
    }
}
