// src/utils/pdfText.js
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Extract text from a PDF File and reconstruct lines using x/y positions.
 * This dramatically improves downstream parsing for COA-style PDFs.
 */
export async function extractTextFromPdfFile(file) {
  if (!file) throw new Error("No file provided");

  const buf = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
  const pdf = await loadingTask.promise;

  const pages = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);

    // normalizeWhitespace helps, but the key is grouping by Y to rebuild lines
    const content = await page.getTextContent({ normalizeWhitespace: true });

    const items = (content.items || [])
      .map((it) => {
        const str = (it?.str || "").replace(/\s+/g, " ").trim();
        const x = it?.transform?.[4] ?? 0;
        const y = it?.transform?.[5] ?? 0;
        return { str, x, y };
      })
      .filter((it) => it.str.length > 0);

    // Sort: top-to-bottom, then left-to-right
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    const lines = [];
    let currentY = null;
    let lineParts = [];

    // Tolerance for grouping items onto the same line
    const yTol = 2.5;

    for (const it of items) {
      if (currentY === null) {
        currentY = it.y;
        lineParts.push(it.str);
        continue;
      }

      if (Math.abs(it.y - currentY) <= yTol) {
        lineParts.push(it.str);
      } else {
        lines.push(lineParts.join(" ").trim());
        lineParts = [it.str];
        currentY = it.y;
      }
    }

    if (lineParts.length) lines.push(lineParts.join(" ").trim());

    pages.push(lines.join("\n"));
  }

  return pages.join("\n\n").trim();
}
