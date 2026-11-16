// Turns a simple markdown file (headings, bullets, numbered lists, tables, bold, italics, code, block quotes, rules) into a standalone
// HTML file that Google Docs, Word and Drive open and convert cleanly. Used for docs/playtest-questionnaire.html.
// Run: node tools/docs/md_to_html.js docs/playtest-questionnaire.md   (writes the .html next to it)
const fs = require("fs"), path = require("path");
const src = process.argv[2];
if (!src) { console.error("usage: node tools/docs/md_to_html.js file.md"); process.exit(1); }
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = s => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>");
const lines = fs.readFileSync(src, "utf8").replace(/\r\n/g, "\n").split("\n");
const out = []; let list = null, table = null, quote = false;
const closeList = () => { if (list) { out.push("</" + list + ">"); list = null; } };
const closeTable = () => { if (table) { out.push("</table>"); table = null; } };
const closeQuote = () => { if (quote) { out.push("</blockquote>"); quote = false; } };
const closeAll = () => { closeList(); closeTable(); closeQuote(); };
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  let m;
  if (/^\s*$/.test(l)) { closeAll(); continue; }
  if (/^---+\s*$/.test(l)) { closeAll(); out.push("<hr>"); continue; }
  if ((m = l.match(/^(#{1,6})\s+(.*)$/))) { closeAll(); out.push("<h" + m[1].length + ">" + inline(m[2]) + "</h" + m[1].length + ">"); continue; }
  if (/^\|.*\|\s*$/.test(l)) {
    const cells = l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
    if (cells.every(c => /^-+$/.test(c))) continue;
    if (!table) { closeList(); closeQuote(); table = true; out.push('<table border="1" cellpadding="6" cellspacing="0">'); out.push("<tr>" + cells.map(c => "<th>" + inline(c) + "</th>").join("") + "</tr>"); }
    else out.push("<tr>" + cells.map(c => "<td>" + inline(c) + "</td>").join("") + "</tr>");
    continue;
  } else closeTable();
  if ((m = l.match(/^>\s?(.*)$/))) { closeList(); if (!quote) { out.push("<blockquote>"); quote = true; } out.push("<p>" + inline(m[1]) + "</p>"); continue; } else closeQuote();
  if ((m = l.match(/^(\s*)[-*]\s+(.*)$/))) { if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; } out.push("<li>" + inline(m[2]) + "</li>"); continue; }
  if ((m = l.match(/^(\d+)\.\s+(.*)$/))) { if (list !== "ol") { closeList(); out.push('<ol start="' + m[1] + '">'); list = "ol"; } out.push("<li>" + inline(m[2]) + "</li>"); continue; }
  closeList(); out.push("<p>" + inline(l.trim()) + "</p>");
}
closeAll();
const title = (lines.find(l => /^#\s/.test(l)) || "# Document").replace(/^#\s+/, "");
const html = '<!doctype html>\n<html><head><meta charset="utf-8"><title>' + esc(title) + "</title></head><body>\n" + out.join("\n") + "\n</body></html>\n";
const dst = src.replace(/\.md$/i, ".html");
fs.writeFileSync(dst, html);
console.log("wrote", dst, "(" + html.length + " bytes)");
