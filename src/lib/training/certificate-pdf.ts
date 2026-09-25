import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";

export type CertificatePdfFacts = {
  issueId: string; reference: string; completionId: string;
  personName: string; courseTitle: string; courseVersion: number;
  templateTitle: string; issuerLabel: string; statement: string;
  templateVersion: number; templateHash: string;
  issuedAt: string; issueDate: string; expiryOn: string | null;
};

const ink = rgb(0.08, 0.14, 0.23);
const blue = rgb(0.09, 0.30, 0.65);
const muted = rgb(0.35, 0.41, 0.49);

export async function renderCertificatePdf(facts: CertificatePdfFacts): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(await readFile(join(process.cwd(), "src/lib/training/assets/Geist-Regular.ttf")), { subset: true });
  const page = doc.addPage([595.28, 841.89]);
  const width = page.getWidth();
  const margin = 56;
  const line = (y: number) => page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.82, 0.86, 0.91) });
  const text = (value: string, x: number, y: number, size: number, color = ink) =>
    page.drawText(value, { x, y, size, font, color });
  const wrap = (value: string, size: number, maxWidth: number) => {
    const lines: string[] = [];
    let current = "";
    for (const word of value.normalize("NFC").split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
      else { if (current) lines.push(current); current = word; }
    }
    if (current) lines.push(current);
    if (lines.some(item => font.widthOfTextAtSize(item, size) > maxWidth)) throw new Error("Certificate text exceeds safe page width");
    return lines;
  };

  page.drawRectangle({ x: 0, y: 0, width, height: page.getHeight(), color: rgb(0.985, 0.989, 0.996) });
  page.drawRectangle({ x: 0, y: 808, width, height: 34, color: blue });
  text("KSS  /  TRAINING RECORD", margin, 755, 11, blue);
  line(736);
  const titles = wrap(facts.templateTitle, 29, width - 2 * margin);
  if (titles.length > 2) throw new Error("Certificate title exceeds safe layout");
  titles.forEach((value, index) => text(value, margin, 679 - index * 34, 29));
  text("Issued for", margin, 615, 10, muted);
  const names = wrap(facts.personName, 23, width - 2 * margin);
  if (names.length > 2) throw new Error("Learner name exceeds safe certificate layout");
  names.forEach((value, index) => text(value, margin, 582 - index * 31, 23));
  const courseY = 520 - (names.length - 1) * 31;
  text("Course", margin, courseY, 10, muted);
  const course = wrap(facts.courseTitle, 18, width - 2 * margin);
  if (course.length > 2) throw new Error("Course title exceeds safe certificate layout");
  course.forEach((value, index) => text(value, margin, courseY - 32 - index * 24, 18));
  const statementY = courseY - 102 - (course.length - 1) * 24;
  const statement = wrap(facts.statement, 11, width - 2 * margin);
  if (statement.length > 3) throw new Error("Certificate statement exceeds safe layout");
  statement.forEach((value, index) => text(value, margin, statementY - index * 18, 11));

  line(332);
  text("REFERENCE", margin, 303, 9, muted);
  text(facts.reference, margin, 281, 14, blue);
  text("ISSUE DATE  /  EUROPE/LONDON", margin, 243, 9, muted);
  text(facts.issueDate, margin, 220, 13);
  if (facts.expiryOn) {
    text("RECORDED EXPIRY DATE", 322, 243, 9, muted);
    text(facts.expiryOn, 322, 220, 13);
  }
  line(188);
  if (font.widthOfTextAtSize(facts.issuerLabel, 10) > width - 2 * margin)
    throw new Error("Certificate issuer label exceeds safe layout");
  text(facts.issuerLabel, margin, 163, 10);
  text(`Course version ${facts.courseVersion}  /  Template version ${facts.templateVersion}`, margin, 139, 9, muted);
  text(`Completion ${facts.completionId}`, margin, 113, 8, muted);
  text(`Issue ${facts.issueId}`, margin, 98, 8, muted);
  text("This records a separate certificate issue. It is not a credential or deployment decision.", margin, 66, 8, muted);

  doc.setTitle(`${facts.templateTitle} - ${facts.reference}`);
  doc.setSubject("Synthetic Development training certificate issue");
  doc.setProducer("KSS Training");
  doc.setCreationDate(new Date(facts.issuedAt));
  doc.setModificationDate(new Date(facts.issuedAt));
  return doc.save({ useObjectStreams: false });
}
