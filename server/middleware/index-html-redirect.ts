import type { Request, Response, NextFunction } from "express";

/**
 * GET/HEAD /index.html → 301 /. express.static's `index: false` only stops
 * directory requests from serving index.html; a direct /index.html request
 * still returned 200 with the bare SPA shell (a duplicate of the home page
 * with no SSR content). Mounted before static serving. Keeps the query string.
 */
export function redirectIndexHtml(req: Request, res: Response, next: NextFunction) {
  if ((req.method === "GET" || req.method === "HEAD") && req.path === "/index.html") {
    const q = req.originalUrl.indexOf("?");
    return res.redirect(301, q === -1 ? "/" : "/" + req.originalUrl.slice(q));
  }
  next();
}
