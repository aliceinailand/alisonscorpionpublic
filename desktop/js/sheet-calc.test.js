import assert from "node:assert/strict";
import {
  evaluateGrid,
  insertRow,
  deleteRow,
  insertCol,
  deleteCol,
  rewriteFormula,
} from "./sheet-calc.js";
import { documentFileHtml, extractDocumentInner, sheetPrintHtml } from "./office-doc.js";

function cell(grid, r, c) {
  return evaluateGrid(grid)[r][c];
}

assert.equal(cell([["1", "2", "=A1+B1*2"]], 0, 2), "5");
assert.equal(cell([["=(1+2)*3"]], 0, 0), "9");
assert.equal(cell([["1"], ["2"], ["3"], ["=SUM(A1:A3)"]], 3, 0), "6");
assert.equal(cell([["1"], ["2"], ["3"], ["=AVERAGE(A1:A3)"]], 3, 0), "2");
assert.equal(cell([["4"], ["1"], ["9"], ["=MIN(A1:A3)"]], 3, 0), "1");
assert.equal(cell([["4"], ["1"], ["9"], ["=MAX(A1:A3)"]], 3, 0), "9");
assert.equal(cell([["1"], ["x"], ["3"], ["=COUNT(A1:A3)"]], 3, 0), "2");
assert.equal(cell([["1"], ["x"], [""], ["=COUNTA(A1:A3)"]], 3, 0), "2");
assert.equal(cell([["2"], ["5"], ["=PRODUCT(A1:A2)"]], 2, 0), "10");
assert.equal(cell([["11", '=IF(A1>10,"big","small")']], 0, 1), "big");
assert.equal(cell([["3", '=IF(A1>10,"big","small")']], 0, 1), "small");
assert.equal(cell([["1.5"], ["=ROUND(A1,0)"]], 1, 0), "2");
assert.equal(cell([["-1.5"], ["=ROUND(A1,0)"]], 1, 0), "-2");
assert.equal(cell([["-4"], ["=ABS(A1)"]], 1, 0), "4");
assert.equal(cell([["Ada", "Lovelace", '=CONCAT(A1," ",B1)']], 0, 2), "Ada Lovelace");
assert.equal(cell([["Ada", "Lovelace", '=A1&" "&B1']], 0, 2), "Ada Lovelace");
assert.equal(cell([["=1/0"]], 0, 0), "#DIV/0!");
assert.equal(cell([["=NOPE(1)"]], 0, 0), "#NAME?");
assert.equal(cell([["=A1"]], 0, 0), "#CYCLE!");
assert.equal(cell([["=B1", "=A1"]], 0, 0), "#CYCLE!");
assert.equal(cell([["hello"]], 0, 0), "hello");
assert.equal(cell([['=CONCAT("say ""hi""")']], 0, 0), 'say "hi"');
assert.equal(cell([["2", "3", "=SUM(A1:B1)"]], 0, 2), "5");
assert.equal(cell([["", "=SUM(A1)"]], 0, 1), "0");
assert.equal(cell([["", "=AVERAGE(A1)"]], 0, 1), "#DIV/0!");

assert.equal(rewriteFormula("=A1", { kind: "insert-row", index: 0 }), "=A2");
assert.equal(rewriteFormula("=$A$1", { kind: "insert-row", index: 0 }), "=$A$2");
assert.equal(rewriteFormula("=A1", { kind: "insert-row", index: 1 }), "=A1");
assert.equal(rewriteFormula('="A1"', { kind: "insert-row", index: 0 }), '="A1"');
assert.equal(rewriteFormula("=A1", { kind: "delete-row", index: 0 }), "=#REF!");
assert.equal(rewriteFormula("=SUM(A1:A3)", { kind: "delete-row", index: 1 }), "=SUM(A1:A2)");
assert.equal(rewriteFormula("=B1", { kind: "delete-col", index: 0 }), "=A1");
assert.equal(rewriteFormula("=A1", { kind: "insert-col", index: 0 }), "=B1");

const inserted = insertRow([["1"], ["=A1+1"]], 0);
assert.equal(inserted[0][0], "");
assert.equal(inserted[2][0], "=A2+1");
assert.equal(evaluateGrid(inserted)[2][0], "2");

const removed = deleteRow([["=B1"], ["9"]], 0);
assert.equal(removed.error, "");
assert.equal(removed.data[0][0], "9");

const shifted = insertCol([["=B1", "4"]], 0);
assert.equal(shifted[0][0], "");
assert.equal(shifted[0][1], "=C1");
assert.equal(shifted[0][2], "4");
assert.equal(evaluateGrid(shifted)[0][1], "4");

const dropped = deleteCol([["1", "=A1+5"]], 0);
assert.equal(dropped.error, "");
assert.equal(dropped.data[0][0], "=#REF!+5");
assert.equal(evaluateGrid(dropped.data)[0][0], "#REF!");

const html = documentFileHtml("My notes", "<p>Hello <strong>there</strong></p>");
assert.match(html, /<title>My notes<\/title>/);
assert.match(html, /Hello <strong>there<\/strong>/);
assert.match(html, /@page \{ margin: 0\.75in; \}/);
assert.equal(extractDocumentInner(html), "<p>Hello <strong>there</strong></p>");
assert.equal(extractDocumentInner("<p>Only a fragment</p>"), "<p>Only a fragment</p>");

const printed = sheetPrintHtml("Budget", [
  ["Item", "Cost"],
  ["Tea", "3"],
]);
assert.match(printed, /<h1>Budget<\/h1>/);
assert.match(printed, /<td>Tea<\/td><td>3<\/td>/);
assert.match(printed, /@page \{ margin: 0\.6in; \}/);
const escaped = sheetPrintHtml("A&B", [["<b>"]]);
assert.match(escaped, /<h1>A&amp;B<\/h1>/);
assert.match(escaped, /<td>&lt;b&gt;<\/td>/);

console.log("sheet-calc and office-doc tests passed");
