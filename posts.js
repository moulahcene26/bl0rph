/* ------------------------------------------------------------------
   posts.js - the blog index.
   to publish a new post:
     1. create posts/<slug>/index.md   (plain markdown, images beside it)
     2. add an object to the top of this list
     3. commit & push. that's the whole pipeline.

   optional per-post fields:
     thumb: "path/to/image.jpg"  -> shows a thumbnail on the index.
            path is relative to the site root (e.g. "posts/<slug>/thumb.jpg").
   ------------------------------------------------------------------ */

const POSTS = [
  {
    slug: "leaky-avatar",
    title: "Leaky Avatar : file read",
    date: "2026-07-18",
    tags: ["bug_bounty"],
    summary: "this is how I pulled a critical file read on a bb target by changing my avatar",
    thumb: "draw_me_your_secrets.png",
  },
];
