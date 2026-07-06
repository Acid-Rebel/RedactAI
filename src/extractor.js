import * as pdfjsLib from 'pdfjs-dist/build/pdf.js';

let workerConfigured = false;

function configurePdfWorker() {
  if (workerConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.js');
  workerConfigured = true;
}

/**
 * Extract plain text from a PDF File object.
 * Returns the concatenated text from all pages.
 */
export async function extractPdfText(file) {
  configurePdfWorker();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    disableFontFace: true,
    useSystemFonts: false,
    disableRange: true,
    disableStream: true,
    disableAutoFetch: true,
  }).promise;

  const parts = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    let pageText = '';
    let lastY = null;
    let lastX = null;

    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const x = item.transform[4];
      const y = item.transform[5];

      if (lastY !== null && Math.abs(y - lastY) > 5) {
        pageText += '\n';
      } else if (lastX !== null && x > lastX + 10) {
        pageText += ' ';
      }

      pageText += item.str;
      lastY = y;
      lastX = x + (item.width || 0);
    }

    const trimmed = pageText.trim();
    if (trimmed) {
      parts.push(trimmed);
    }
  }

  return parts.join('\n\n');
}

/**
 * Extract text from a plain text file.
 */
export async function extractTextFile(file) {
  return await file.text();
}
