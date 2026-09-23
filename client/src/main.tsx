import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installCsrfInterceptor } from "./lib/csrf";
import { initAnalytics } from "./lib/analytics";

// Attach CSRF tokens to all same-origin mutating fetches before the app runs.
installCsrfInterceptor();

// GA4 (Consent Mode v2) + cookieless Ahrefs, as early as possible so the
// first page_view isn't lost to a quick bounce. Idempotent — the later
// initGA()/initAhrefs() calls in App.tsx are no-ops.
initAnalytics();

createRoot(document.getElementById("root")!).render(<App />);
