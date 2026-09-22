import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { test } from "node:test";

async function availablePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  server.close();
  await once(server, "close");
  return port;
}

test("built KSS foundation serves the correct, honest page", { timeout: 30000 }, async () => {
  const port = await availablePort();
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(),
    stdio: "ignore",
  });

  try {
    let response;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (server.exitCode !== null) throw new Error(`Next.js exited with code ${server.exitCode}`);
      try {
        response = await fetch(`http://127.0.0.1:${port}/`);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    assert.ok(response, "server should accept HTTP requests");
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /KSS Enterprise Platform/);
    assert.match(html, /Operational systems and live staff data are not connected/);
    assert.match(html, /Development accounts only/);
    assert.doesNotMatch(html, /Create Next App|Deploy Now|Next\.js logo/);
  } finally {
    server.kill("SIGTERM");
    if (server.exitCode === null) await once(server, "exit");
  }
});
