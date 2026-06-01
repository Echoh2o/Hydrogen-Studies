import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installCsrfInterceptor } from "./lib/csrf";

// Attach CSRF tokens to all same-origin mutating fetches before the app runs.
installCsrfInterceptor();

createRoot(document.getElementById("root")!).render(<App />);
