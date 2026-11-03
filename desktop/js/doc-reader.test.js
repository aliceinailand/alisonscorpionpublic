/**
 * Unit tests for Reader helpers (no DOM).
 * Run: node desktop/js/doc-reader.test.js
 */
import { classifyReaderFile, lightMarkdownToHtml } from "./doc-reader.js";
import { asxSavePath } from "./notepad-app.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert failed");
}

assert(classifyReaderFile({ name: "a.pdf", type: "application/pdf" }) === "pdf", "pdf");
assert(classifyReaderFile({ name: "notes.md", type: "" }) === "markdown", "md");
assert(classifyReaderFile({ name: "run.log", type: "text/plain" }) === "text", "log");
assert(classifyReaderFile({ name: "x.docx", type: "" }) === "docx", "docx");
assert(classifyReaderFile({ name: "pic.png", type: "image/png" }) === "image", "image");
assert(classifyReaderFile({ name: "clip.mp4", type: "video/mp4" }) === "video", "video");
assert(classifyReaderFile({ name: "song.mp3", type: "audio/mpeg" }) === "audio", "audio");

const html = lightMarkdownToHtml("# Title\n\nHello **bold** and `code`\n- one\n- two");
assert(html.includes("<h1>Title</h1>"), "h1");
assert(html.includes("<strong>bold</strong>"), "bold");
assert(html.includes("<code>code</code>"), "code");
assert(html.includes("<li>"), "list");
assert(!html.includes("<script"), "no script");

assert(
  asxSavePath("/home/guest/Desktop", "hello") === "/home/guest/Desktop/hello.txt",
  "asx path adds .txt"
);
assert(
  asxSavePath("/home/guest/Documents/", "note.md") === "/home/guest/Documents/note.md",
  "asx path keeps md"
);
assert(
  asxSavePath("/home/guest/Desktop", "../evil.txt") === "/home/guest/Desktop/_evil.txt",
  "sanitize traversal"
);

console.log("doc-reader + notepad helpers: OK");
