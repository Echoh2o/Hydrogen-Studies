import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installCsrfInterceptor } from "./lib/csrf";
import { scheduleAnalytics } from "./lib/analytics";

// Attach CSRF tokens to all same-origin mutating fetches before the app runs.
installCsrfInterceptor();

// GA4 (Consent Mode v2) + cookieless Ahrefs. Consent defaults are queued now;
// gtag.js and the Ahrefs script load after `load` + idle so they don't
// compete with LCP (see scheduleAnalytics).
scheduleAnalytics();

createRoot(document.getElementById("root")!).render(<App />);
