import fs from "node:fs";
import assert from "node:assert/strict";
import create from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";
const toolkit = new VerovioToolkit(await create());
toolkit.setOptions({
  scale: 38,
  pageWidth: 2200,
  pageHeight: 8000,
  adjustPageHeight: true,
  breaks: "encoded",
});
const library = JSON.parse(
  fs.readFileSync("hosted/data/czerny-op599.json", "utf8"),
);
for (const ex of library) {
  const xml = fs.readFileSync(`hosted/public${ex.notationUrl}`, "utf8");
  assert.ok(toolkit.loadData(xml), ex.title);
  let measures = 0;
  let notes = 0;
  for (let page = 1; page <= toolkit.getPageCount(); page++) {
    const svg = toolkit.renderToSVG(page);
    assert.ok(svg.includes("<svg"), ex.title);
    measures += [...svg.matchAll(/class="measure"/g)].length;
    notes += [...svg.matchAll(/class="note"/g)].length;
  }
  assert.equal(measures, ex.right.length, ex.title);
  assert.equal(
    notes,
    [...xml.matchAll(/<pitch>/g)].length,
    `${ex.title}: visible notes`,
  );
}
toolkit.destroy();
console.log("All 100 Czerny scores render with their complete measure counts.");
