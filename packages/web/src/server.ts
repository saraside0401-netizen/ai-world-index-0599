// Deploy-compat entrypoint: the platform's release pipeline bundles
// packages/web/src/server.ts as the production server.
// Node-compatible production server — no Bun runtime required.

import app from "./api/index.ts";
import { initDatabase } from "./api/database/init.ts";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3000);
const distDir = path.resolve(__dirname, "..", "dist");
const indexPath = path.join(distDir, "index.html");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

function getStaticFilePath(pathname: string) {
  const cleanPath = decodeURIComponent(pathname).replace(/^\/+/, "").replaceAll("..", "");
  return cleanPath ? path.join(distDir, cleanPath) : indexPath;
}

async function serveStatic(filePath: string): Promise<Response | null> {
  try {
    await stat(filePath);
  } catch {
    return null;
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";
  const data = await readFile(filePath);
  return new Response(data, { headers: { "Content-Type": mime } });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    if (url.pathname.startsWith("/api")) {
      const headers = new Headers();
      for (const [key, val] of Object.entries(req.headers)) {
        if (val) headers.set(key, Array.isArray(val) ? val.join(", ") : val);
      }
      const request = new Request(url, {
        method: req.method ?? "GET",
        headers,
        body: req.method !== "GET" && req.method !== "HEAD" ? req : undefined,
        // @ts-expect-error duplex needed for streaming request bodies
        duplex: req.method !== "GET" && req.method !== "HEAD" ? "half" : undefined,
      });
      const response = await app.fetch(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      const buf = Buffer.from(await response.arrayBuffer());
      res.end(buf);
      return;
    }

    const filePath = getStaticFilePath(url.pathname);
    const staticResponse = await serveStatic(filePath);
    if (staticResponse) {
      res.writeHead(staticResponse.status, Object.fromEntries(staticResponse.headers));
      res.end(Buffer.from(await staticResponse.arrayBuffer()));
      return;
    }

    const indexResponse = await serveStatic(indexPath);
    if (indexResponse) {
      res.writeHead(indexResponse.status, Object.fromEntries(indexResponse.headers));
      res.end(Buffer.from(await indexResponse.arrayBuffer()));
      return;
    }

    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Build output not found. Run `npm run build` first.");
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal Server Error");
  }
});

server.listen(port, async () => {
  try {
    await initDatabase();
    console.log("Database initialized.");
  } catch (err) {
    console.error("Database init failed:", err);
  }
  console.log(`Web server listening on http://localhost:${port}`);
});
