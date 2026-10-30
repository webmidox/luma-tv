package com.luma.tv;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * A tiny web page the TV serves on the home network while the "enter with your phone" screen is open.
 * The address contains a random secret, so only whoever scanned the QR code can open it. It only accepts the
 * form of a new source and hands it to the app; nothing else is served. Plain Java so it can be tested alone.
 */
final class RemoteSetup {
    /** Text shown at /<token>/rapport so a phone can read and copy it. */
    static volatile String report = "";

    interface Listener {
        /** A source arrived from the phone, as a JSON object. */
        void onSource(String json);
    }

    private static ServerSocket server;

    private RemoteSetup() {}

    /** Starts serving and returns the address to put in the QR code. */
    static synchronized String start(Listener listener) throws IOException {
        stop();
        String ip = localIp();
        if (ip == null) throw new IOException("Geen wifi-adres gevonden");
        byte[] raw = new byte[9];
        new SecureRandom().nextBytes(raw);
        StringBuilder sb = new StringBuilder();
        for (byte b : raw) sb.append(String.format("%02x", b));
        final String token = sb.toString();
        final ServerSocket s = new ServerSocket(0);
        server = s;
        Thread t = new Thread(() -> {
            while (!s.isClosed()) {
                try {
                    final Socket c = s.accept();
                    Thread w = new Thread(() -> handle(c, token, listener), "luma-remote-conn");
                    w.setDaemon(true);
                    w.start();
                } catch (IOException e) {
                    break;
                }
            }
        }, "luma-remote");
        t.setDaemon(true);
        t.start();
        return "http://" + ip + ":" + s.getLocalPort() + "/" + token;
    }

    static synchronized void stop() {
        if (server != null) {
            try { server.close(); } catch (IOException ignored) { }
            server = null;
        }
    }

    static String localIp() {
        String forced = System.getProperty("luma.ip");
        if (forced != null) return forced;
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address && a.isSiteLocalAddress()) return a.getHostAddress();
                }
            }
        } catch (IOException ignored) { }
        return null;
    }

    private static void handle(Socket c, String token, Listener listener) {
        try (Socket sock = c) {
            sock.setSoTimeout(8000);
            InputStream in = sock.getInputStream();
            OutputStream out = sock.getOutputStream();
            String request = readLine(in);
            if (request == null) return;
            String[] p = request.split(" ");
            if (p.length < 2) return;
            int length = 0;
            String line;
            while ((line = readLine(in)) != null && !line.isEmpty()) {
                int i = line.indexOf(':');
                if (i > 0 && line.substring(0, i).trim().equalsIgnoreCase("content-length")) {
                    try { length = Integer.parseInt(line.substring(i + 1).trim()); } catch (NumberFormatException e) { length = -1; }
                }
            }
            String path = p[1];
            int q = path.indexOf('?');
            if (q >= 0) path = path.substring(0, q);
            if (p[0].equals("GET") && path.equals("/" + token + "/rapport")) {
                respond(out, 200, report, "text/plain; charset=utf-8");
                return;
            }
            if (!path.equals("/" + token)) {
                respond(out, 404, "Niet gevonden", "text/plain; charset=utf-8");
                return;
            }
            if (p[0].equals("GET")) {
                respond(out, 200, FORM, "text/html; charset=utf-8");
            } else if (p[0].equals("POST")) {
                if (length < 0 || length > 20000) {
                    respond(out, 413, page("Te groot", "Dit formulier is te groot."), "text/html; charset=utf-8");
                    return;
                }
                byte[] body = new byte[length];
                int got = 0;
                while (got < length) {
                    int n = in.read(body, got, length - got);
                    if (n < 0) break;
                    got += n;
                }
                Map<String, String> f = parseForm(new String(body, 0, got, StandardCharsets.UTF_8));
                String json = toSourceJson(f);
                if (json == null) {
                    respond(out, 400, page("Niet compleet", "Controleer of alle verplichte velden zijn ingevuld en ga terug om het opnieuw te proberen."), "text/html; charset=utf-8");
                } else {
                    listener.onSource(json);
                    respond(out, 200, page("Gelukt", "Je gegevens staan nu op de tv. Je kunt dit scherm sluiten."), "text/html; charset=utf-8");
                }
            } else {
                respond(out, 405, "Niet toegestaan", "text/plain; charset=utf-8");
            }
        } catch (IOException ignored) {
            // A phone that disconnects half way is not an error.
        }
    }

    /** Turns the form fields into the JSON the web interface expects, or null when something required is missing. */
    static String toSourceJson(Map<String, String> f) {
        String type = f.getOrDefault("type", "m3u");
        StringBuilder sb = new StringBuilder("{");
        if (type.equals("xtream")) {
            String server = trim(f.get("server"));
            String user = trim(f.get("user"));
            String pass = f.getOrDefault("pass", "");
            if (server.isEmpty() || user.isEmpty() || pass.isEmpty()) return null;
            sb.append("\"type\":\"xtream\",\"server\":").append(quote(server)).append(",\"user\":").append(quote(user))
              .append(",\"pass\":").append(quote(pass));
        } else {
            String url = trim(f.get("url"));
            if (!url.matches("(?i)^https?://\\S+$")) return null;
            sb.append("\"type\":\"m3u\",\"url\":").append(quote(url));
        }
        sb.append(",\"name\":").append(quote(trim(f.get("name"))))
          .append(",\"epg\":").append(quote(trim(f.get("epg"))))
          .append(",\"ua\":").append(quote(trim(f.get("ua")))).append("}");
        return sb.toString();
    }

    static Map<String, String> parseForm(String body) {
        Map<String, String> m = new HashMap<>();
        for (String pair : body.split("&")) {
            if (pair.isEmpty()) continue;
            int i = pair.indexOf('=');
            String k = i < 0 ? pair : pair.substring(0, i);
            String v = i < 0 ? "" : pair.substring(i + 1);
            try {
                m.put(URLDecoder.decode(k, "UTF-8"), URLDecoder.decode(v, "UTF-8"));
            } catch (Exception ignored) { }
        }
        return m;
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

    static String quote(String s) {
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            switch (ch) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                case ' ': sb.append("\\u2028"); break;
                case ' ': sb.append("\\u2029"); break;
                default:
                    if (ch < 0x20) sb.append(String.format("\\u%04x", (int) ch));
                    else sb.append(ch);
            }
        }
        return sb.append('"').toString();
    }

    private static String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        int c;
        while ((c = in.read()) >= 0) {
            if (c == '\n') break;
            if (c != '\r') b.write(c);
            if (b.size() > 8192) throw new IOException("regel te lang");
        }
        if (c < 0 && b.size() == 0) return null;
        return b.toString("UTF-8");
    }

    private static void respond(OutputStream out, int code, String body, String type) throws IOException {
        byte[] data = body.getBytes(StandardCharsets.UTF_8);
        String head = "HTTP/1.1 " + code + " OK\r\nContent-Type: " + type + "\r\nContent-Length: " + data.length
                + "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.UTF_8));
        out.write(data);
        out.flush();
    }

    private static String page(String title, String text) {
        return "<!doctype html><html lang=nl><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
                + "<title>Luma TV</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0c0b10;color:#f6f5f8;"
                + "font:18px system-ui,sans-serif;padding:24px;text-align:center}h1{margin:0 0 8px}p{color:#aaa}</style><body><div><h1>"
                + title + "</h1><p>" + text + "</p></div>";
    }

    private static final String FORM = "<!doctype html><html lang=nl><meta charset=utf-8>"
            + "<meta name=viewport content='width=device-width,initial-scale=1'><title>Luma TV</title>"
            + "<style>*{box-sizing:border-box}body{margin:0;background:radial-gradient(900px 500px at 80% -10%,#3b2a73,transparent),#0c0b10;color:#f6f5f8;"
            + "font:17px/1.4 system-ui,sans-serif;padding:24px 20px 48px}h1{font-size:28px;margin:8px 0 4px}p{color:#aaa;margin:0 0 20px}"
            + "label{display:block;margin:16px 0 6px;color:#bbb;font-size:15px}input{width:100%;padding:14px;border-radius:12px;"
            + "border:1px solid #3a3750;background:#1a1824;color:#fff;font-size:17px}"
            + ".tabs{display:flex;gap:8px;margin:12px 0}.tabs button{flex:1;padding:12px;border-radius:99px;border:1px solid #3a3750;background:#1a1824;color:#fff;font-size:16px}"
            + ".tabs button.on{background:#fff;color:#111}.go{margin-top:28px;width:100%;padding:16px;border:0;border-radius:99px;background:#8f7bff;color:#fff;font-size:18px;font-weight:600}"
            + ".x{display:none}small{color:#888;display:block;margin-top:24px}</style>"
            + "<h1>Luma TV</h1><p>Voer hier je eigen IPTV-gegevens in. Ze gaan rechtstreeks naar je tv.</p>"
            + "<form method=post><input type=hidden name=type id=type value=m3u>"
            + "<div class=tabs><button type=button id=tm class=on>M3U-link</button><button type=button id=tx>Xtream Codes</button></div>"
            + "<label>Naam (optioneel)</label><input name=name autocomplete=off>"
            + "<div id=m><label>Link naar M3U-lijst</label><input name=url type=url inputmode=url autocapitalize=off autocomplete=off placeholder='http://…'></div>"
            + "<div id=x class=x><label>Server</label><input name=server autocapitalize=off autocomplete=off placeholder='http://voorbeeld.tv:8080'>"
            + "<label>Gebruikersnaam</label><input name=user autocapitalize=off autocomplete=off><label>Wachtwoord</label><input name=pass type=password autocomplete=off></div>"
            + "<label>Gids (XMLTV-link, optioneel)</label><input name=epg autocapitalize=off autocomplete=off>"
            + "<label>User-agent (optioneel)</label><input name=ua autocapitalize=off autocomplete=off>"
            + "<button class=go>Naar de tv sturen</button></form>"
            + "<small>Deze pagina werkt alleen op je eigen wifi en alleen zolang het scherm op de tv open staat.</small>"
            + "<script>var t=document.getElementById('type'),m=document.getElementById('m'),x=document.getElementById('x'),a=document.getElementById('tm'),b=document.getElementById('tx');"
            + "function s(k){t.value=k;m.className=k=='m3u'?'':'x';x.className=k=='xtream'?'':'x';a.className=k=='m3u'?'on':'';b.className=k=='xtream'?'on':''}"
            + "a.onclick=function(){s('m3u')};b.onclick=function(){s('xtream')}</script>";
}
