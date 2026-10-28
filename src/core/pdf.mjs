// Minimal zero-dependency PDF 1.4 writer: A4, Helvetica, WinAnsiEncoding.
const W = 595, H = 842, M = 56;
const TITLE_SIZE = 18, BODY_SIZE = 11, LEADING = 15;

// Unicode -> cp1252 byte (Latin-1 range is identical; a few extras in 0x80-0x9F).
const CP1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };

function enc(s) {
  const out = [];
  for (const ch of String(s ?? "")) {
    const c = ch.codePointAt(0);
    if (c === 9) out.push(0x20, 0x20, 0x20, 0x20);
    else if (c < 0x20 || c === 0x7f) out.push(0x20);
    else if (c < 0x80 || (c >= 0xA0 && c <= 0xFF)) out.push(c);
    else out.push(CP1252[c] ?? 0x3F);
  }
  return Buffer.from(out);
}
const hex = (b) => "<" + b.toString("hex") + ">";
const utf16hex = (s) => "<FEFF" + Buffer.from(String(s ?? ""), "utf16le").swap16().toString("hex") + ">";

function wrap(text, size, maxW) {
  const maxChars = Math.max(10, Math.floor(maxW / (size * 0.5)));
  const res = [];
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    let line = "";
    for (let word of raw.split(" ")) {
      while (word.length > maxChars) {
        if (line) { res.push(line); line = ""; }
        res.push(word.slice(0, maxChars)); word = word.slice(maxChars);
      }
      if (!line) line = word;
      else if ((line + " " + word).length <= maxChars) line += " " + word;
      else { res.push(line); line = word; }
    }
    res.push(line);
  }
  return res;
}

export function textPdf({ title = "", lines = [] } = {}) {
  const items = []; // { text, bold, size }
  if (title) for (const t of wrap(title, TITLE_SIZE, W - 2 * M)) items.push({ text: t, bold: true, size: TITLE_SIZE });
  if (title) items.push({ text: "", size: BODY_SIZE });
  for (const l of lines) for (const t of wrap(l, BODY_SIZE, W - 2 * M)) items.push({ text: t, size: BODY_SIZE });

  const perPage = Math.floor((H - 2 * M) / LEADING);
  const pages = [];
  for (let i = 0; i < items.length || !pages.length; i += perPage) pages.push(items.slice(i, i + perPage));

  const streams = pages.map((pg) => {
    let s = "BT\n";
    let first = true;
    for (const it of pg) {
      s += `/${it.bold ? "F2" : "F1"} ${it.size} Tf\n`;
      s += first ? `1 0 0 1 ${M} ${H - M - it.size} Tm\n` : `0 -${LEADING} Td\n`;
      first = false;
      if (it.text) s += `${hex(enc(it.text))} Tj\n`;
    }
    return s + "ET\n";
  });

  // objects: 1 catalog, 2 pages, 3 F1, 4 F2, 5 info, then page/content pairs
  const objs = [];
  const kids = pages.map((_, i) => `${6 + 2 * i} 0 R`).join(" ");
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objs[5] = `<< /Title ${utf16hex(title)} /Producer (dante-watch) >>`;
  pages.forEach((_, i) => {
    objs[6 + 2 * i] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${7 + 2 * i} 0 R >>`;
    objs[7 + 2 * i] = `<< /Length ${Buffer.byteLength(streams[i], "latin1")} >>\nstream\n${streams[i]}endstream`;
  });

  const parts = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offsets = [];
  let pos = parts[0].length;
  for (let n = 1; n < objs.length; n++) {
    offsets[n] = pos;
    const b = Buffer.from(`${n} 0 obj\n${objs[n]}\nendobj\n`, "latin1");
    parts.push(b); pos += b.length;
  }
  let xref = `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let n = 1; n < objs.length; n++) xref += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
  xref += `trailer\n<< /Size ${objs.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  parts.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(parts);
}
