/* eslint-disable @typescript-eslint/no-require-imports */
// Run after npm run build: node scripts/sanity-capacity-sandbox-browser.cjs
// Uses installed Chrome (or CHROME_PATH), a temporary profile, and Node's CDP
// WebSocket client. No package installation or application dependencies needed.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { fixture } = require("./sanity-capacity-sandbox.cjs");
const { planFlights } = require("../lib/flights.ts");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function retry(fn) {
  let last;
  for (let i = 0; i < 120; i++) {
    try { const result = await fn(); if (result) return result; } catch (error) { last = error; }
    await pause(250);
  }
  throw last ?? new Error("Timed out waiting for browser state");
}
async function port() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const result = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return result;
}
async function main() {
  const webPort = await port(), debugPort = await port();
  const url = `http://127.0.0.1:${webPort}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "capacity-sandbox-browser-"));
  let browser, socket;
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(webPort)], { windowsHide: true, stdio: "ignore" });
  try {
    console.log("Starting production server for browser checks...");
    await retry(async () => (await fetch(url, { signal: AbortSignal.timeout(1500) })).ok);
    console.log("Production server ready; starting headless Chrome...");
    browser = spawn(process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
    browser.on("error", (error) => console.error(error.message));
    const target = await retry(async () => {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`, { signal: AbortSignal.timeout(1500) })).json();
      return targets.find((entry) => entry.type === "page");
    });
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let sequence = 0;
    const pending = new Map(), errors = [];
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
      if (message.id) {
        const entry = pending.get(message.id);
        if (entry) {
          pending.delete(message.id);
          if (message.error) entry.reject(new Error(message.error.message));
          else entry.resolve(message.result);
        }
      }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      return result.result.value;
    };
    await send("Runtime.enable");
    await send("Page.enable");
    const data = fixture();
    const state = { ...data, plan: planFlights(data.totes, data.capacities) };
    const storage = JSON.stringify(state);
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `if (!sessionStorage.getItem('sandbox-test-seeded')) { localStorage.setItem('zamiigo-state-v1', ${JSON.stringify(storage)}); sessionStorage.setItem('sandbox-test-seeded','yes'); }` });
    await send("Page.navigate", { url: `${url}/flights` });
    console.log("Flight Management loaded; checking sandbox interactions...");
    const section = "document.querySelector('[aria-labelledby=\"capacity-sandbox-title\"]')";
    const text = () => evaluate(`${section}?.innerText`);
    await retry(async () => (await text())?.includes("Showing baseline; no scenario applied."));
    const persisted = await evaluate("localStorage.getItem('zamiigo-state-v1')");
    const baselineTable = await evaluate(`${section}.querySelector('table').innerText`);
    const setInput = (index, value) => evaluate(`(() => { const input = ${section}.querySelectorAll('input')[${index}]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', {bubbles:true})); })()`);
    const click = (label) => evaluate(`(() => { const button = [...${section}.querySelectorAll('button')].find(button => button.textContent === ${JSON.stringify(label)}); if (!button) throw new Error('Missing button'); button.click(); })()`);
    await setInput(0, "0");
    await click("Recalculate Scenario");
    await retry(async () => (await text()).includes("3 totes changed departure"));
    assert.ok((await text()).includes("2 orders delayed"));
    assert.ok((await text()).includes("moved later"));
    assert.equal(await evaluate("localStorage.getItem('zamiigo-state-v1')"), persisted);
    await click("Reset");
    await retry(async () => (await text()).includes("Showing baseline; no scenario applied."));
    assert.equal(await evaluate(`${section}.querySelector('table').innerText`), baselineTable);
    assert.equal(await evaluate(`${section}.querySelector('input').value`), "30");
    assert.ok((await text()).includes("0 totes changed departure"));
    assert.equal(await evaluate("localStorage.getItem('zamiigo-state-v1')"), persisted);
    await setInput(1, "1.5");
    assert.equal(await evaluate(`${section}.querySelector('form').checkValidity()`), false);
    await click("Reset");
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.ok(await evaluate(`${section}.getBoundingClientRect().width <= 390`));
    assert.ok(await evaluate("!!document.querySelector('[aria-label=\"Open Zamiigo Copilot\"]')"));
    // Existing controls, manifests, and cabin stay on the operational plan.
    assert.ok(await evaluate("!!document.querySelector('[aria-label=\"Cabin load map\"]')"));
    assert.ok(await evaluate("[...document.querySelectorAll('button')].some(button => button.textContent === 'Print manifests')"));
    await setInput(0, "0");
    await click("Recalculate Scenario");
    await retry(async () => (await text()).includes("3 totes changed departure"));
    await evaluate(`(() => { const select = ${section}.querySelector('select'); select.value='omega'; select.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await retry(async () => (await text()).includes("Showing baseline; no scenario applied."));
    assert.ok((await text()).includes("0 totes changed departure"));
    // Real capacity edits invalidate the preview and establish a new baseline.
    await evaluate("[...document.querySelectorAll('button')].find(button => button.textContent === 'One full Caravan (Stage 1)').click()");
    await retry(async () => await evaluate(`${section}.querySelectorAll('option').length === 1`));
    await setInput(0, "0");
    await click("Recalculate Scenario");
    await retry(async () => (await text()).includes("became unscheduled"));
    assert.ok((await text()).includes("0 orders delayed"));
    await click("Reset");
    await retry(async () => (await text()).includes("0 totes changed departure"));
    // Existing Plan flights action remains usable after scenario reset.
    await evaluate("[...document.querySelectorAll('button')].find(button => button.textContent === 'Plan flights').click()");
    await retry(async () => (JSON.parse(await evaluate("localStorage.getItem('zamiigo-state-v1')"))).plan?.flights[0]?.loadedToteIds.length === 3);
    await evaluate("localStorage.removeItem('zamiigo-state-v1'); location.reload()");
    await retry(async () => (await text())?.includes("Pack orders into totes"));
    assert.equal(await evaluate(`${section}.querySelectorAll('input').length`), 0);
    assert.deepEqual(errors, []);
    console.log("PASS: browser UI; recalculation; Reset; storage unchanged; departure/source reset; Stage 1; empty state; mobile section; copilot; existing cabin/manifest/Plan flights controls.");
    await send("Browser.close");
  } finally {
    socket?.close();
    browser?.kill();
    server.kill();
    // Only delete the unique test profile inside the OS temporary directory.
    const target = path.resolve(profile);
    if (path.dirname(target) === path.resolve(os.tmpdir()) && path.basename(target).startsWith("capacity-sandbox-browser-")) {
      await pause(500);
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    }
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
