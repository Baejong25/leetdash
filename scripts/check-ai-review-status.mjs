// check-ai-review-status.mjs
//
// Zero-dependency status probe for the OpenCode Go gateway and the
// DeepSeek V4 Flash (AI review) model. Writes shields.io-compatible
// badge JSON into <out>/gateway-status.json and
// <out>/deepseek-flash-status.json.
//
// CLI: node scripts/check-ai-review-status.mjs --out <dir>
// Env: OPENCODE_API_KEY (required)
//
// Exit code 0 whenever both probes completed and both files were
// written ("down" is a valid outcome — the badge reports it). Exit
// code 1 + stderr only on misconfiguration: missing OPENCODE_API_KEY,
// missing/empty --out, or an output write failure.

import { mkdir, writeFile as fsWriteFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GATEWAY_URL = "https://opencode.ai/zen/go/v1/models";
const CHAT_COMPLETIONS_URL = "https://opencode.ai/zen/go/v1/chat/completions";
const FLASH_MODEL = "deepseek-v4-flash";
const GATEWAY_TIMEOUT_MS = 20_000;
const FLASH_TIMEOUT_MS = 30_000;

const GATEWAY_LABEL = "OpenCode Go Gateway";
const FLASH_LABEL = "DeepSeek V4 Flash (AI Review)";

function badgeFor(up) {
  return up ? { message: "up", color: "brightgreen" } : { message: "down", color: "red" };
}

/**
 * Single fetch with an AbortController timeout. Resolves with the
 * parsed JSON body on HTTP 2xx, null on non-2xx, and rejects on
 * network failure, timeout (AbortError), or invalid JSON — every
 * rejection classifies the probe as down.
 */
async function fetchProbe(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    if (response.status < 200 || response.status >= 300) return null;
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function checkGateway({ fetchImpl, apiKey }) {
  try {
    const body = await fetchProbe(fetchImpl, GATEWAY_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    }, GATEWAY_TIMEOUT_MS);
    const up = body !== null && Array.isArray(body.data) && body.data.length > 0;
    return badgeFor(up);
  } catch {
    return badgeFor(false);
  }
}

async function checkFlash({ fetchImpl, apiKey }) {
  try {
    const body = await fetchProbe(fetchImpl, CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: FLASH_MODEL,
        messages: [{ role: "user", content: "Reply exactly with: OK" }],
        max_tokens: 1,
        stream: false,
      }),
    }, FLASH_TIMEOUT_MS);
    // Mirrors the review client response validation
    // (scripts/opencode-review-clients.mjs): structural checks only —
    // untrusted response content is never executed.
    const choices = body?.choices;
    const first = Array.isArray(choices) && choices.length >= 1 ? choices[0] : undefined;
    const up = body !== null
      && first?.message?.role === "assistant"
      && typeof first?.message?.content === "string"
      && first.message.content.trim().length > 0;
    return badgeFor(up);
  } catch {
    return badgeFor(false);
  }
}

function statusFile({ label, message, color, lastChecked }) {
  return { schemaVersion: 1, label, message, color, lastChecked };
}

/**
 * Run both independent probes and write the two badge JSON files.
 * One probe failing never skips the other. Throws on misconfiguration
 * (missing apiKey/outDir) or output write failure.
 */
async function runStatusCheck({ fetchImpl = fetch, writeFile = fsWriteFile, outDir, apiKey, now = () => new Date() } = {}) {
  if (!apiKey) throw new Error("OPENCODE_API_KEY is required (set the env var before running).");
  if (!outDir) throw new Error("--out <dir> is required.");

  await mkdir(outDir, { recursive: true });

  const [gateway, flash] = await Promise.all([
    checkGateway({ fetchImpl, apiKey }),
    checkFlash({ fetchImpl, apiKey }),
  ]);

  const lastChecked = now().toISOString();
  await Promise.all([
    writeFile(path.join(outDir, "gateway-status.json"), JSON.stringify(statusFile({ label: GATEWAY_LABEL, ...gateway, lastChecked }), null, 2)),
    writeFile(path.join(outDir, "deepseek-flash-status.json"), JSON.stringify(statusFile({ label: FLASH_LABEL, ...flash, lastChecked }), null, 2)),
  ]);

  return { gateway, flash, lastChecked };
}

async function main({ argv = process.argv, env = process.env } = {}) {
  const outIndex = argv.indexOf("--out");
  const outDir = outIndex !== -1 ? argv[outIndex + 1] : undefined;
  if (!env.OPENCODE_API_KEY) throw new Error("OPENCODE_API_KEY is required (set the env var before running).");
  if (!outDir) throw new Error("--out <dir> is required.");
  await runStatusCheck({ fetchImpl: fetch, writeFile: fsWriteFile, outDir, apiKey: env.OPENCODE_API_KEY });
  return { exitCode: 0 };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main()
    .then(({ exitCode }) => { process.exitCode = exitCode; })
    .catch((error) => {
      console.error(`check-ai-review-status: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}

export { main, runStatusCheck };
