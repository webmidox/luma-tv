package com.luma.tv;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

import java.util.EnumMap;
import java.util.Map;

/** Draws a QR code as a small SVG picture (black on white, with a quiet border). */
final class QrSvg {
    private QrSvg() {}

    static String of(String text) throws Exception {
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.MARGIN, 0);
        hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
        BitMatrix m = new QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0, hints);
        int n = m.getWidth();
        StringBuilder d = new StringBuilder();
        for (int y = 0; y < m.getHeight(); y++) {
            int x = 0;
            while (x < n) {
                if (!m.get(x, y)) { x++; continue; }
                int start = x;
                while (x < n && m.get(x, y)) x++;
                d.append('M').append(start).append(',').append(y).append('h').append(x - start).append("v1h-").append(x - start).append('z');
            }
        }
        int pad = 3;
        int size = n + 2 * pad;
        return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='" + (-pad) + " " + (-pad) + " " + size + " " + size
                + "' shape-rendering='crispEdges'><rect x='" + (-pad) + "' y='" + (-pad) + "' width='" + size + "' height='" + size
                + "' fill='#fff'/><path fill='#000' d='" + d + "'/></svg>";
    }
}
