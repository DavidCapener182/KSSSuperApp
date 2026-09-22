/** Read a multipart request with a real byte cap, even without Content-Length. */
export async function boundedMultipart(request: Request, maxBytes: number): Promise<FormData | null> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data;") || !request.body) return null;
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(length) || length > maxBytes) throw new RangeError("Request too large");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new RangeError("Request too large"); }
      chunks.push(value);
    }
    return await new Response(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))), {
      headers: { "content-type": type },
    }).formData();
  } catch (error) {
    if (error instanceof RangeError) throw error;
    return null;
  } finally { reader.releaseLock(); }
}
