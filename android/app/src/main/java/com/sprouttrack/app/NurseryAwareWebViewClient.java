package com.sprouttrack.app;

import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/**
 * doUpdateVisitedHistory - not onPageStarted - because the web app enters and
 * leaves nursery mode via Next.js history.pushState, which does not start a
 * page load and so never fires onPageStarted.
 */
public class NurseryAwareWebViewClient extends BridgeWebViewClient {
    public interface NurseryListener {
        void onNurseryChanged(boolean active);
    }

    private final NurseryListener listener;
    private boolean active = false;

    public NurseryAwareWebViewClient(Bridge bridge, NurseryListener listener) {
        super(bridge);
        this.listener = listener;
    }

    /**
     * Pure string parsing (no android.net.Uri) so this stays a plain,
     * host-JVM-testable function. The route is /{slug}/nursery-mode - the
     * second path segment must equal "nursery-mode" exactly, not merely
     * start with it. Handles a full URL (scheme://host/path?query#frag) or a
     * bare path, plus leading/trailing slashes and query/fragment strings.
     */
    static boolean isNurseryPath(String url) {
        if (url == null) {
            return false;
        }

        String path = url;

        int schemeIdx = path.indexOf("://");
        if (schemeIdx >= 0) {
            int pathStart = path.indexOf('/', schemeIdx + 3);
            path = pathStart >= 0 ? path.substring(pathStart) : "";
        }

        int queryIdx = path.indexOf('?');
        if (queryIdx >= 0) {
            path = path.substring(0, queryIdx);
        }
        int fragmentIdx = path.indexOf('#');
        if (fragmentIdx >= 0) {
            path = path.substring(0, fragmentIdx);
        }

        String trimmed = path.replaceAll("^/+", "").replaceAll("/+$", "");
        if (trimmed.isEmpty()) {
            return false;
        }

        String[] segments = trimmed.split("/");
        return segments.length >= 2 && "nursery-mode".equals(segments[1]);
    }

    @Override
    public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
        super.doUpdateVisitedHistory(view, url, isReload);
        boolean next = isNurseryPath(url);
        if (next != active) {
            active = next;
            listener.onNurseryChanged(next);
        }
    }
}
