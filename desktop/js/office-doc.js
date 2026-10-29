/**
 * HTML wrappers for the free document editor and spreadsheet.
 * Inner document HTML is sanitized by the caller before it is wrapped.
 */

function escapeText(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Full HTML file a person can open, print, and save on their own computer. */
export function documentFileHtml(title, innerHtml) {
  const safeTitle = escapeText(title || "Document");
  const body = innerHtml && String(innerHtml).trim() ? String(innerHtml) : "<p><br></p>";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="generator" content="Alison Scorpion Document"/>
<title>${safeTitle}</title>
<style>
  body { font-family: Georgia, "Palatino Linotype", Palatino, serif; color: #1a1428; line-height: 1.55; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; }
  td, th { border: 1px solid #ccc; padding: 4px 8px; }
  @media print {
    body { margin: 0; max-width: none; padding: 0; }
  }
  @page { margin: 0.75in; }
</style>
</head>
<body spellcheck="true">
${body}
</body>
</html>
`;
}

/** Pull the editable body out of a saved document, or return the fragment. */
export function extractDocumentInner(raw) {
  const s = String(raw ?? "");
  const match = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return (match ? match[1] : s).trim();
}

/** Printable HTML table of values already calculated. Cells are escaped. */
export function sheetPrintHtml(title, rows) {
  const safeTitle = escapeText(title || "Spreadsheet");
  const body = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const cells = (Array.isArray(row) ? row : [])
        .map((cell) => `<td>${escapeText(cell)}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${safeTitle}</title>
<style>
  body { font-family: system-ui, sans-serif; color: #111; }
  h1 { font-size: 16px; font-weight: 600; margin: 0 0 12px; }
  table { border-collapse: collapse; font-size: 12px; }
  td { border: 1px solid #bbb; padding: 3px 8px; vertical-align: top; }
  @page { margin: 0.6in; }
</style>
</head>
<body>
<h1>${safeTitle}</h1>
<table>${body}</table>
</body>
</html>
`;
}
