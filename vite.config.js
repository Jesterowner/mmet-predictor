import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const ALLOWED_HOSTS = new Set(["mete.labdrive.net"]);
const MAX = 10 * 1024 * 1024;

export default defineConfig({
  plugins: [
    react(),
    {
      name: "mmet-local-api-proxy-coa",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          try {
            if (!req.url || !req.url.startsWith("/api/proxy-coa")) return next();

            const fullUrl = new URL(req.url, "http://localhost");
            const target = fullUrl.searchParams.get("url");
            if (!target) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "Missing url param" }));
              return;
            }

            let u;
            try { u = new URL(target); }
            catch {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "Invalid URL" }));
              return;
            }

            if (u.protocol !== "https:" || !ALLOWED_HOSTS.has(u.hostname)) {
              res.statusCode = 403;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "Host not allowed" }));
              return;
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 12000);

            const resp = await fetch(u.toString(), {
              method: "GET",
              redirect: "follow",
              signal: controller.signal,
              headers: {
                "User-Agent": "MMET-COA-Proxy/1.0",
                "Accept": "application/pdf,application/octet-stream,*/*",
              },
            }).finally(() => clearTimeout(timeout));

            if (!resp.ok) {
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: `Upstream error: ${resp.status}` }));
              return;
            }

            const contentType = resp.headers.get("content-type") || "application/pdf";
            const contentDisposition = resp.headers.get("content-disposition") || "";

            const buf = Buffer.from(await resp.arrayBuffer());
            if (buf.length > MAX) {
              res.statusCode = 413;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "File too large" }));
              return;
            }

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
              ok: true,
              contentType,
              filename: filenameFrom(contentDisposition, u.pathname),
              base64: buf.toString("base64"),
              bytes: buf.length,
            }));
          } catch (e) {
            const msg = e && e.name === "AbortError" ? "Upstream timeout" : (e && e.message ? e.message : "Server error");
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: msg }));
          }
        });
      }
    }
  ]
});

function filenameFrom(contentDisposition, pathname) {
  const m = /filename\*?=(?:UTF-8''|")?([^;"\n]+)"?/i.exec(contentDisposition || "");
  if (m && m[1]) return decodeURIComponent(m[1].trim().replace(/"/g, ""));
  const parts = String(pathname || "").split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "coa.pdf";
  return last.toLowerCase().endsWith(".pdf") ? last : `${last}.pdf`;
}
