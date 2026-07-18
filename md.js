/* ------------------------------------------------------------------
   md.js - a small hand-written markdown renderer.
   supports: headings, paragraphs, fenced code, inline code, bold,
   italic, strikethrough, links, images, lists, blockquotes, tables,
   horizontal rules. nothing more; a log does not need more.
   ------------------------------------------------------------------ */

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveUrl(url, base) {
  if (/^(https?:|mailto:|\/|#|data:)/i.test(url)) return url;
  return base + url;
}

// optional image sizing: {width=0.6} | {0.6} | {width=60%} | {width=320px}
// a bare number is a fraction of the text column (1 = full width, 1.2 = 120%).
function imgWidthStyle(attr) {
  if (!attr) return "";
  var m = attr.match(/([\d.]+)\s*(%|px)?/);
  if (!m) return "";
  var num = parseFloat(m[1]);
  if (!isFinite(num) || num <= 0) return "";
  var w = m[2] === "%" ? num + "%" : m[2] === "px" ? num + "px" : (num * 100) + "%";
  return ' style="width:' + w + ';max-width:' + w + '"';
}

function inlineMd(text, base) {
  const stash = [];
  const SEP = String.fromCharCode(0); // sentinel: cannot occur in real text
  // protect inline code spans from further transforms
  text = text.replace(/`([^`]+)`/g, function (_, c) {
    stash.push("<code>" + c + "</code>");
    return SEP + (stash.length - 1) + SEP;
  });
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)(\{[^}]*\})?/g, function (_, alt, src, attr) {
    return '<img src="' + resolveUrl(src, base) + '" alt="' + alt + '"' +
      imgWidthStyle(attr) + ">";
  });
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, href) {
    const ext = /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : "";
    return '<a href="' + resolveUrl(href, base) + '"' + ext + ">" + label + "</a>";
  });
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  text = text.replace(new RegExp(SEP + "(\\d+)" + SEP, "g"), function (_, i) {
    return stash[+i];
  });
  return text;
}

function mdToHtml(src, base) {
  base = base || "";
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;

  function flushList(items, ordered) {
    const tag = ordered ? "ol" : "ul";
    out.push("<" + tag + ">");
    for (const it of items) out.push("<li>" + inlineMd(it, base) + "</li>");
    out.push("</" + tag + ">");
  }

  while (i < lines.length) {
    let line = lines[i];

    if (/^\s*$/.test(line)) { i++; continue; }

    // fenced code block
    let m = line.match(/^```(\S*)\s*$/);
    if (m) {
      const lang = m[1];
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence
      out.push('<figure class="codeblock">');
      if (lang) out.push("<figcaption>" + escapeHtml(lang) + "</figcaption>");
      out.push("<pre><code>" + escapeHtml(buf.join("\n")) + "</code></pre></figure>");
      continue;
    }

    // horizontal rule
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

    // standalone image -> figure with caption (alt text). optional {width=..}
    let im = line.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)\)(\{[^}]*\})?\s*$/);
    if (im) {
      const alt = escapeHtml(im[1]);
      out.push('<figure class="fig"><img src="' + resolveUrl(im[2], base) +
               '" alt="' + alt + '"' + imgWidthStyle(im[3]) + ">" +
               (im[1] ? "<figcaption>" + alt + "</figcaption>" : "") +
               "</figure>");
      i++;
      continue;
    }

    // heading
    m = line.match(/^(#{1,4})\s+(.*)$/);
    if (m) {
      const level = m[1].length;
      out.push("<h" + level + ">" + inlineMd(escapeHtml(m[2]), base) + "</h" + level + ">");
      i++;
      continue;
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i]))
        buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push("<blockquote>" + inlineMd(escapeHtml(buf.join(" ")), base) + "</blockquote>");
      continue;
    }

    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]))
        items.push(escapeHtml(lines[i++].replace(/^\s*[-*]\s+/, "")));
      flushList(items, false);
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]))
        items.push(escapeHtml(lines[i++].replace(/^\s*\d+\.\s+/, "")));
      flushList(items, true);
      continue;
    }

    // table: header row followed by |---|---| separator
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length &&
        /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const cells = function (l) {
        return l.trim().replace(/^\||\|$/g, "").split("|").map(function (c) {
          return inlineMd(escapeHtml(c.trim()), base);
        });
      };
      out.push("<table><thead><tr>");
      for (const c of cells(line)) out.push("<th>" + c + "</th>");
      out.push("</tr></thead><tbody>");
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        out.push("<tr>");
        for (const c of cells(lines[i])) out.push("<td>" + c + "</td>");
        out.push("</tr>");
        i++;
      }
      out.push("</tbody></table>");
      continue;
    }

    // paragraph: accumulate until blank line or block start
    const buf = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) &&
           !/^(#{1,4}\s|```|>\s?|\s*[-*]\s+|\s*\d+\.\s+|\s*\|)/.test(lines[i]) &&
           !/^\s*(---+|\*\*\*+)\s*$/.test(lines[i])) {
      buf.push(lines[i++]);
    }
    out.push("<p>" + inlineMd(escapeHtml(buf.join(" ")), base) + "</p>");
  }

  return out.join("\n");
}

function readingTime(src) {
  const words = src.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
