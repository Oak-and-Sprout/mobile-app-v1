import UIKit
import WebKit
import Capacitor

/// The shell's JS stops running once the WebView navigates to the remote server,
/// so keep-awake and immersive mode for nursery mode have to be driven natively.
/// WKWebView.url is KVO-compliant and updates on history.pushState, so Next.js
/// client-side navigation (how the web app enters/leaves nursery mode) is
/// observed too, not just hard page loads.
class NurseryAwareViewController: CAPBridgeViewController {
    private var urlObservation: NSKeyValueObservation?
    private var nurseryActive = false

    /// The route is `/{slug}/nursery-mode` — the second path segment must
    /// equal "nursery-mode" exactly, not merely start with it.
    static func isNurseryPath(_ path: String) -> Bool {
        let segments = path.split(separator: "/").map(String.init)
        return segments.count >= 2 && segments[1] == "nursery-mode"
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        urlObservation = webView?.observe(\.url, options: [.new]) { [weak self] _, change in
            guard let self, let url = change.newValue ?? nil else { return }
            self.apply(active: Self.isNurseryPath(url.path))
        }
    }

    /// Idempotent and paired: re-entering nursery mode without leaving is a
    /// no-op, and every "active" transition has exactly one matching
    /// "inactive" transition that reverts both the idle timer and the
    /// status bar.
    private func apply(active: Bool) {
        guard active != nurseryActive else { return }
        nurseryActive = active
        UIApplication.shared.isIdleTimerDisabled = active
        setStatusBarVisible(!active)
    }

    deinit {
        urlObservation?.invalidate()
        // Never leave the idle timer disabled past this controller's lifetime.
        UIApplication.shared.isIdleTimerDisabled = false
    }
}
