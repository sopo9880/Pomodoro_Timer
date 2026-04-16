const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");

const HOST = "0.0.0.0";
const PORT = Number.parseInt(process.env.PORT || "4173", 10);
const ROOT = __dirname;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host}`);
    const relativePath = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.replace(/^\/+/, "");
    const normalizedPath = path.normalize(relativePath);
    const filePath = path.resolve(ROOT, normalizedPath);

    if (!filePath.startsWith(ROOT)) {
      sendText(response, 403, "Forbidden");
      return;
    }

    const finalPath = await resolveFilePath(filePath);
    const extension = path.extname(finalPath).toLowerCase();
    const contentType = MIME_TYPES[extension] || "application/octet-stream";
    const file = await fs.readFile(finalPath);

    response.writeHead(200, {
      "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600",
      "Content-Type": contentType,
    });
    response.end(file);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      sendText(response, 404, "Not Found");
      return;
    }

    sendText(response, 500, "Internal Server Error");
  }
});

server.listen(PORT, HOST, () => {
  const urls = getAccessibleUrls(PORT);
  console.log("Bloomodoro local server is running.");
  urls.forEach((url) => console.log(url));
});

async function resolveFilePath(filePath) {
  const stats = await fs.stat(filePath);
  if (stats.isDirectory()) {
    return path.join(filePath, "index.html");
  }

  return filePath;
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(message);
}

function getAccessibleUrls(port) {
  const urls = [`Local: http://localhost:${port}`];
  const seen = new Set();

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal || seen.has(entry.address)) {
        continue;
      }

      seen.add(entry.address);
      urls.push(`Network: http://${entry.address}:${port}`);
    }
  }

  return urls;
}
