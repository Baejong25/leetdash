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

import {
  isRetryableStatus,
  openCodeApiModel,
  openCodeChatCompletionsUrl,
  openCodeRequestTimeoutMs,
  parseAssistantResponse,
} from "./opencode-api-contract.mjs";

const GATEWAY_URL = "https://opencode.ai/zen/go/v1/models";
const GATEWAY_TIMEOUT_MS = 20_000;

const GATEWAY_LABEL = "OpenCode Go Gateway";
const FLASH_LABEL = "DeepSeek V4 Flash (AI Review)";

const FLASH_PROMPT = "Reply exactly with: OK";
const FLASH_MAX_ATTEMPTS = 2;

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

/**
 * One flash chat-completions attempt under the shared per-attempt
 * timeout (openCodeRequestTimeoutMs). Returns { ok: true } on a valid
 * assistant response, or { ok: false, retryable } where retryable is
 * true only for timeout/transport failures and the retryable HTTP
 * statuses (408/425/429/5xx). Invalid JSON and invalid assistant
 * responses are final. Each attempt owns its own AbortController timer.
 */
async function attemptFlash({ fetchImpl, apiKey }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), openCodeRequestTimeoutMs);
  try {
    let response;
    try {
      response = await fetchImpl(openCodeChatCompletionsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: openCodeApiModel,
          messages: [{ role: "user", content: FLASH_PROMPT }],
        }),
        signal: controller.signal,
      });
    } catch {
      // Timeout or transport failure — retryable.
      return { ok: false, retryable: true };
    }
    if (response.status < 200 || response.status >= 300) {
      return { ok: false, retryable: isRetryableStatus(response.status) };
    }
    let body;
    try {
      body = await response.json();
    } catch {
      // Invalid JSON — final.
      return { ok: false, retryable: false };
    }
    // Mirrors the review client response validation via the shared
    // contract: structural checks only — untrusted response content is
    // never executed and never embedded in the result.
    const parsed = parseAssistantResponse(body);
    return parsed.ok ? { ok: true } : { ok: false, retryable: false };
  } finally {
    clearTimeout(timer);
  }
}

async function checkFlash({ fetchImpl, apiKey }) {
  let outcome = { ok: false, retryable: true };
  for (let attempt = 1; attempt <= FLASH_MAX_ATTEMPTS; attempt += 1) {
    outcome = await attemptFlash({ fetchImpl, apiKey });
    if (outcome.ok || !outcome.retryable) break;
  }
  return badgeFor(outcome.ok);
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

export { checkFlash, main, runStatusCheck };
