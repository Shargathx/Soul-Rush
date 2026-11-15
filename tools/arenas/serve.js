// Serves the preview folder at / and the Soul Rush project (read-only) at /project/.
const http = require("http"), fs = require("fs"), path = require("path");
const here = __dirname, project = process.argv[2] || path.join(__dirname, "..", "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".json": "application/json" };
http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split("?")[0]);
  let f = u.startsWith("/project/") ? path.join(project, u.slice(9)) : path.join(here, u === "/" ? "preview.html" : u);
  const base = u.startsWith("/project/") ? project : here;
  if (!path.resolve(f).startsWith(path.resolve(base))) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" }); r.end(d); });
}).listen(8766, "127.0.0.1", () => console.log("listening 8766"));
