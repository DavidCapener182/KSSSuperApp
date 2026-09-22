import { createHash } from "node:crypto";
import { MAX_DOCUMENT_BYTES } from "./policy";

const TYPES: Record<string, { extensions: string[]; signature: number[] }> = {
  "application/pdf": { extensions: ["pdf"], signature: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  "image/png": { extensions: ["png"], signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  "image/jpeg": { extensions: ["jpg", "jpeg"], signature: [0xff, 0xd8, 0xff] },
};
export function validatedFile(file: File) {
  const name = file.name.normalize("NFC").trim();
  if (!name || name.length > 180 || /[\\/\u0000-\u001f\u007f]/.test(name)) return null;
  const type = TYPES[file.type];
  const extension = name.split(".").pop()?.toLowerCase();
  if (!type || !extension || !type.extensions.includes(extension) || file.size < 1 || file.size > MAX_DOCUMENT_BYTES) return null;
  return { name, type };
}
export async function checkedBytes(file: File) {
  const metadata = validatedFile(file);
  if (!metadata) return null;
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || bytes.length > MAX_DOCUMENT_BYTES ||
    !metadata.type.signature.every((byte, index) => bytes[index] === byte)) return null;
  return { bytes, filename: metadata.name, mimeType: file.type,
    sha256: createHash("sha256").update(bytes).digest("hex") };
}
export function sha256(bytes: ArrayBuffer | Uint8Array) {
  return createHash("sha256").update(bytes instanceof ArrayBuffer ? Buffer.from(bytes) : Buffer.from(bytes)).digest("hex");
}
