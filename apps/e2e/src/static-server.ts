import fs from "node:fs";
import http from "node:http";
import path from "node:path";

export const LOOPBACK = "127.0.0.1";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

export interface StaticServer {
  origin: string;
  address: string;
  requests: { method: string; path: string }[];
  close: () => Promise<void>;
}

/** GET and HEAD only, bound to 127.0.0.1 on an ephemeral port, no CORS headers. */
export async function serveDirectory(root: string): Promise<StaticServer> {
  const requests: { method: string; path: string }[] = [];
  const base = path.resolve(root);
  const server = http.createServer((req, res) => {
    const method = req.method ?? "";
    const pathname = (req.url ?? "/").split("?")[0] ?? "/";
    requests.push({ method, path: pathname });
    const headers = { "cache-control": "no-store" };
    if (method !== "GET" && method !== "HEAD") {
      res.writeHead(405, { ...headers, allow: "GET, HEAD" });
      res.end();
      return;
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      res.writeHead(400, headers);
      res.end();
      return;
    }
    const target = path.resolve(base, "." + path.posix.normalize("/" + decoded));
    if (target !== base && !target.startsWith(base + path.sep)) {
      res.writeHead(404, headers);
      res.end();
      return;
    }
    let file = target;
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      // Routes without a file extension fall back to the app shell; a missing asset is a 404.
      if (path.extname(decoded) !== "") {
        res.writeHead(404, headers);
        res.end();
        return;
      }
      file = path.join(base, "index.html");
    }
    const body = fs.readFileSync(file);
    res.writeHead(200, {
      ...headers,
      "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
      "content-length": body.length,
    });
    res.end(method === "HEAD" ? undefined : body);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, LOOPBACK, resolve);
  });
  const info = server.address();
  if (info === null || typeof info === "string" || info.address !== LOOPBACK) {
    server.close();
    throw new Error("The e2e server did not bind to 127.0.0.1.");
  }
  return {
    origin: `http://${LOOPBACK}:${info.port}`,
    address: info.address,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
