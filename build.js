/* ------------------------------------------------------------------
   build.js - static generator for social previews + SEO.

   for each post it prerenders posts/<slug>/index.md into a fully
   static posts/<slug>/index.html with baked <head> metadata:
   Open Graph (Discord/Facebook/LinkedIn), Twitter Card (x.com),
   canonical URL, and JSON-LD (Google). also writes sitemap.xml,
   robots.txt, and refreshes the home page's meta block.

   run it with:   node build.js
   while writing:  node build.js --watch   (rebuilds on every save)
   the GitHub Pages workflow runs it automatically on every deploy.
   authoring a post is unchanged: add the folder + posts.js entry.
   ------------------------------------------------------------------ */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SITE = "https://" + fs.readFileSync(path.join(ROOT, "CNAME"), "utf8").trim();
const AUTHOR = "Abdelmounaim Moulahcene";
const SITE_NAME = "bl0rph";
const FAVICON =
  'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22>' +
  '<rect width=%2216%22 height=%2216%22 fill=%22%23111%22/>' +
  '<rect x=%223%22 y=%223%22 width=%2210%22 height=%2210%22 fill=%22%23e5342a%22/></svg>';
const THEME_SCRIPT =
  '<script>(function(){try{var t=localStorage.getItem("theme");' +
  'if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}})();</script>';

// --- helpers --------------------------------------------------------
const esc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const absUrl = p => !p ? "" : (/^https?:/i.test(p) ? p : SITE + "/" + String(p).replace(/^\//, ""));
const jsonLd = obj => JSON.stringify(obj).replace(/</g, "\\u003c");

// evaluate a browser script and pull named globals out of it
function loadGlobals(file, names) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  const ctx = {};
  new Function(src + "\n;" + names.map(n => `this.${n}=${n};`).join("")).call(ctx);
  return ctx;
}
// pull a marked block out of index.html (single source for sidebar/footer)
function extract(html, name) {
  const m = html.match(new RegExp("<!-- " + name + ":start[^>]*-->([\\s\\S]*?)<!-- " + name + ":end -->"));
  return m ? m[1].trim() : "";
}

// --- per-post page --------------------------------------------------
function renderPost(p, ctx) {
  const dir = path.join(ROOT, "posts", p.slug);
  const mdPath = path.join(dir, "index.md");
  if (!fs.existsSync(mdPath)) {
    console.warn("  ! skipped " + p.slug + " (no index.md)");
    return null;
  }
  const source = fs.readFileSync(mdPath, "utf8");
  const body = ctx.md.mdToHtml(source, "");       // images resolve relative to the post dir
  const rt = ctx.md.readingTime(source);
  const url = SITE + "/posts/" + p.slug + "/";
  const desc = p.summary || "";
  const img = absUrl(p.thumb);
  const tags = p.tags || [];

  const ld = jsonLd({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: desc,
    datePublished: p.date,
    dateModified: p.date,
    author: { "@type": "Person", name: AUTHOR, url: SITE + "/" },
    publisher: { "@type": "Person", name: AUTHOR },
    mainEntityOfPage: url,
    url: url,
    keywords: tags.join(", "),
    image: img ? [img] : undefined,
  });

  const head = [
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    "<title>" + esc(p.title) + " · " + SITE_NAME + "</title>",
    '<link rel="stylesheet" href="/style.css">',
    '<link rel="icon" href="' + FAVICON + '">',
    '<meta name="description" content="' + esc(desc) + '">',
    '<meta name="author" content="' + esc(AUTHOR) + '">',
    '<link rel="canonical" href="' + url + '">',
    '<meta property="og:type" content="article">',
    '<meta property="og:site_name" content="' + SITE_NAME + '">',
    '<meta property="og:title" content="' + esc(p.title) + '">',
    '<meta property="og:description" content="' + esc(desc) + '">',
    '<meta property="og:url" content="' + url + '">',
    img ? '<meta property="og:image" content="' + esc(img) + '">' : "",
    img ? '<meta property="og:image:alt" content="' + esc(p.title) + '">' : "",
    '<meta property="article:published_time" content="' + esc(p.date) + '">',
    ...tags.map(t => '<meta property="article:tag" content="' + esc(t) + '">'),
    '<meta name="twitter:card" content="' + (img ? "summary_large_image" : "summary") + '">',
    '<meta name="twitter:title" content="' + esc(p.title) + '">',
    '<meta name="twitter:description" content="' + esc(desc) + '">',
    img ? '<meta name="twitter:image" content="' + esc(img) + '">' : "",
    '<script type="application/ld+json">' + ld + "</script>",
    THEME_SCRIPT,
  ].filter(Boolean).join("\n  ");

  const metaLine =
    "<span>" + esc(p.date) + "</span>" +
    "<span>~" + rt + " min read</span>" +
    (tags.length ? '<span class="tags">' + esc(tags.map(t => "#" + t).join(" ")) + "</span>" : "");

  const html =
    "<!DOCTYPE html>\n" +
    '<html lang="en">\n<head>\n  ' + head + "\n</head>\n<body>\n" +
    '  <div class="layout">\n\n    ' + ctx.SIDEBAR + "\n\n" +
    '    <main class="content">\n' +
    '      <nav class="crumb"><a href="/">&larr; back to the blog</a></nav>\n' +
    '      <header class="post-head">\n' +
    "        <h1>" + esc(p.title) + "</h1>\n" +
    '        <div class="post-meta">' + metaLine + "</div>\n" +
    "      </header>\n" +
    '      <article id="content">\n' + body + "\n      </article>\n" +
    '      <p class="post-end">&middot; end &middot;</p>\n' +
    "    </main>\n\n  </div>\n\n" +
    "  " + ctx.FOOTER + "\n\n" +
    '  <script src="/theme.js"></script>\n' +
    "</body>\n</html>\n";

  fs.writeFileSync(path.join(dir, "index.html"), html);
  console.log("  + posts/" + p.slug + "/index.html");
  return { url, lastmod: p.date };
}

// --- home meta block ------------------------------------------------
function updateHomeMeta(ctx) {
  const newest = ctx.POSTS.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const img = newest ? absUrl(newest.thumb) : "";
  const desc = "bl0rph / abdelmounaim: security research notes, interesting findings, and thoughts.";
  const ld = jsonLd({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE + "/",
    author: { "@type": "Person", name: AUTHOR, url: SITE + "/" },
  });
  const block = [
    "<!-- meta:start (regenerated by build.js; edit there, not here) -->",
    '<meta name="description" content="' + esc(desc) + '">',
    '<link rel="canonical" href="' + SITE + '/">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="' + SITE_NAME + '">',
    '<meta property="og:title" content="bl0rph blog">',
    '<meta property="og:description" content="' + esc(desc) + '">',
    '<meta property="og:url" content="' + SITE + '/">',
    img ? '<meta property="og:image" content="' + esc(img) + '">' : "",
    '<meta name="twitter:card" content="' + (img ? "summary_large_image" : "summary") + '">',
    '<meta name="twitter:title" content="bl0rph blog">',
    '<meta name="twitter:description" content="' + esc(desc) + '">',
    img ? '<meta name="twitter:image" content="' + esc(img) + '">' : "",
    '<script type="application/ld+json">' + ld + "</script>",
    "<!-- meta:end -->",
  ].filter(Boolean).join("\n  ");
  const out = ctx.homeHtml.replace(/<!-- meta:start[\s\S]*?<!-- meta:end -->/, block);
  if (out !== ctx.homeHtml) {
    fs.writeFileSync(path.join(ROOT, "index.html"), out);
    console.log("  ~ index.html meta refreshed");
  }
}

// --- sitemap + robots ----------------------------------------------
function writeSitemap(entries) {
  const newest = entries.map(e => e.lastmod).sort().pop() || "";
  const urls = [{ url: SITE + "/", lastmod: newest }, ...entries];
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u =>
      "  <url><loc>" + u.url + "</loc>" +
      (u.lastmod ? "<lastmod>" + u.lastmod + "</lastmod>" : "") +
      "</url>").join("\n") +
    "\n</urlset>\n";
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml);
  fs.writeFileSync(path.join(ROOT, "robots.txt"),
    "User-agent: *\nAllow: /\n\nSitemap: " + SITE + "/sitemap.xml\n");
  console.log("  + sitemap.xml, robots.txt");
}

// --- one full build -------------------------------------------------
function build() {
  const ctx = {
    md: loadGlobals("md.js", ["mdToHtml", "readingTime"]),
    homeHtml: fs.readFileSync(path.join(ROOT, "index.html"), "utf8"),
  };
  ctx.POSTS = loadGlobals("posts.js", ["POSTS"]).POSTS;
  ctx.SIDEBAR = extract(ctx.homeHtml, "sidebar").replace(/href="\.\/"/g, 'href="/"');
  ctx.FOOTER = extract(ctx.homeHtml, "footer");

  console.log("building " + SITE);
  const entries = ctx.POSTS.map(p => renderPost(p, ctx)).filter(Boolean);
  updateHomeMeta(ctx);
  writeSitemap(entries);
  console.log("done: " + entries.length + " post page(s).");
}

// --- run / watch ----------------------------------------------------
function safeBuild() {
  try { build(); } catch (e) { console.error("build failed: " + e.message); }
}

safeBuild();

if (process.argv.includes("--watch")) {
  // rebuild on source changes; ignore our own generated outputs to avoid loops
  const isGenerated = f =>
    !f || /(^|\/)index\.html$/.test(f) || /sitemap\.xml$/.test(f) || /robots\.txt$/.test(f);
  let timer = null;
  const onChange = (_evt, filename) => {
    if (isGenerated(filename)) return;
    clearTimeout(timer);
    timer = setTimeout(() => { console.log("\n[watch] change detected"); safeBuild(); }, 120);
  };
  try {
    fs.watch(ROOT, { recursive: true }, onChange);
    console.log("\n[watch] watching for changes… (Ctrl-C to stop)");
  } catch (e) {
    console.error("[watch] not supported here (" + e.message + "); re-run 'node build.js' manually.");
  }
}
