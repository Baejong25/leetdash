// check-ai-review-status.mjs
//
// Zero-dependency status probe for the OpenCode Go gateway and the
// DeepSeek V4 Flash (AI review) model. Writes shields.io-compatible
// badge JSON into <out>/gateway-status.json and
// <out>/deepseek-flash-status.json.
//
// CLI: node scripts/check-ai-review-status.mjs --out <dir>
// Env: OPENCODE_API_KEY (required), GITHUB_STEP_SUMMARY (optional)
//
// Exit code 0 whenever both probes completed and both files were
// written ("down" is a valid outcome — the badge reports it). Exit
// code 1 + stderr only on misconfiguration: missing OPENCODE_API_KEY,
// missing/empty --out, or an output write failure. On success, main()
// prints one safe line per probe to stdout and appends a safe Markdown
// table to GITHUB_STEP_SUMMARY when that path exists; a summary append
// failure only prints a fixed warning and keeps exit code 0.

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

/**
 * Single gateway fetch with an AbortController timeout. Resolves with a
 * fixed safe result: { reason, status, body }. reason is one of the
 * approved codes (ok/timeout/transport_error/http_error/invalid_json);
 * status is the integer HTTP status whenever a response was received;
 * body is the parsed JSON payload only for reason "ok". Untrusted text
 * (provider bodies, error messages) is never returned or embedded.
 */
async function fetchProbe(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetchImpl(url, { ...init, signal: controller.signal });
    } catch (error) {
      return error?.name === "AbortError" ? { reason: "timeout" } : { reason: "transport_error" };
    }
    if (response.status < 200 || response.status >= 300) {
      return { reason: "http_error", status: response.status };
    }
    let body;
    try {
      body = await response.json();
    } catch {
      return { reason: "invalid_json", status: response.status };
    }
    return { reason: "ok", status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function checkGateway({ fetchImpl, apiKey, now = () => new Date() }) {
  const startMs = now().getTime();
  const probe = await fetchProbe(fetchImpl, GATEWAY_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  }, GATEWAY_TIMEOUT_MS);
  const elapsedMs = Math.round(now().getTime() - startMs);
  const up = probe.reason === "ok" && Array.isArray(probe.body?.data) && probe.body.data.length > 0;
  return {
    message: up ? "up" : "down",
    color: up ? "brightgreen" : "red",
    reason: probe.reason === "ok" && !up ? "invalid_response" : probe.reason,
    attempts: 1,
    elapsedMs,
    ...(probe.status === undefined ? {} : { status: probe.status }),
  };
}

/**
 * One flash chat-completions attempt under the shared per-attempt
 * timeout (openCodeRequestTimeoutMs). Returns { ok, retryable, reason }
 * plus optional status. reason is one of the approved codes
 * (ok/timeout/transport_error/http_error/invalid_json/invalid_response);
 * retryable is true only for timeout/transport failures and the
 * retryable HTTP statuses (408/425/429/5xx). Invalid JSON and invalid
 * assistant responses are final. Each attempt owns one AbortController
 * and one timer that race both the fetch and the response body parse,
 * so a stalled body times out exactly like a stalled fetch (mirrors
 * scripts/opencode-review-clients.mjs). On timeout the controller is
 * aborted and the timer is always cleared in the finally.
 */
async function attemptFlash({ fetchImpl, apiKey }) {
  const controller = new AbortController();
  const timedOut = Symbol("flash attempt timed out");
  let timeout;
  const timeoutFailure = new Promise((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(timedOut);
      controller.abort();
    }, openCodeRequestTimeoutMs);
  });
  try {
    let response;
    try {
      response = await Promise.race([
        fetchImpl(openCodeChatCompletionsUrl, {
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
        }),
        timeoutFailure,
      ]);
    } catch (error) {
      // Timer hit (retryable timeout) or transport failure (retryable).
      return {
        ok: false,
        retryable: true,
        reason: error === timedOut ? "timeout" : "transport_error",
      };
    }
    if (response.status < 200 || response.status >= 300) {
      return {
        ok: false,
        retryable: isRetryableStatus(response.status),
        reason: "http_error",
        status: response.status,
      };
    }
    let body;
    try {
      body = await Promise.race([response.json(), timeoutFailure]);
    } catch (error) {
      // A stalled body parse that hit the timer is retryable timeout; a
      // normal JSON parse rejection before the timer is final invalid_json.
      return error === timedOut
        ? { ok: false, retryable: true, reason: "timeout" }
        : { ok: false, retryable: false, reason: "invalid_json", status: response.status };
    }
    // Mirrors the review client response validation via the shared
    // contract: structural checks only — untrusted response content is
    // never executed and never embedded in the result.
    const parsed = parseAssistantResponse(body);
    return parsed.ok
      ? { ok: true, retryable: false, reason: "ok", status: response.status }
      : { ok: false, retryable: false, reason: "invalid_response", status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkFlash({ fetchImpl, apiKey, now = () => new Date() }) {
  const startMs = now().getTime();
  let outcome = { ok: false, retryable: true, reason: "timeout" };
  let attempts = 0;
  for (let attempt = 1; attempt <= FLASH_MAX_ATTEMPTS; attempt += 1) {
    attempts = attempt;
    outcome = await attemptFlash({ fetchImpl, apiKey });
    if (outcome.ok || !outcome.retryable) break;
  }
  const elapsedMs = Math.round(now().getTime() - startMs);
  return {
    message: outcome.ok ? "up" : "down",
    color: outcome.ok ? "brightgreen" : "red",
    reason: outcome.reason,
    attempts,
    elapsedMs,
    ...(outcome.status === undefined ? {} : { status: outcome.status }),
  };
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
    checkGateway({ fetchImpl, apiKey, now }),
    checkFlash({ fetchImpl, apiKey, now }),
  ]);

  const lastChecked = now().toISOString();
  await Promise.all([
    writeFile(path.join(outDir, "gateway-status.json"), JSON.stringify(statusFile({ label: GATEWAY_LABEL, ...gateway, lastChecked }), null, 2)),
    writeFile(path.join(outDir, "deepseek-flash-status.json"), JSON.stringify(statusFile({ label: FLASH_LABEL, ...flash, lastChecked }), null, 2)),
  ]);

  return { gateway, flash, lastChecked };
}

const SUMMARY_APPEND_FAILURE_WARNING = "check-ai-review-status: could not append GitHub Step Summary; badge files remain published";

/**
 * One safe stdout line per probe containing only approved fields:
 * reason, attempts, elapsedMs, and the optional integer HTTP status.
 */
function formatProbeLine(name, probe) {
  const fields = [`reason=${probe.reason}`, `attempts=${probe.attempts}`, `elapsedMs=${probe.elapsedMs}`];
  if (probe.status !== undefined) fields.push(`status=${probe.status}`);
  return `${name}: ${fields.join(" ")}`;
}

/** Safe GitHub Step Summary Markdown table with an empty cell when the status is absent. */
function buildSummaryTable(probes) {
  const rows = [
    "## DeepSeek status probe diagnostics",
    "",
    "| probe | reason | attempts | elapsedMs | status |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const [name, probe] of probes) {
    rows.push(`| ${name} | ${probe.reason} | ${probe.attempts} | ${probe.elapsedMs} | ${probe.status ?? ""} |`);
  }
  return `${rows.join("\n")}\n`;
}

async function main({
  argv = process.argv,
  env = process.env,
  fetchImpl = fetch,
  writeFile = fsWriteFile,
  summaryWriteFile = fsWriteFile,
  log = (line) => console.log(line),
  warn = (line) => console.error(line),
  now = () => new Date(),
} = {}) {
  const outIndex = argv.indexOf("--out");
  const outDir = outIndex !== -1 ? argv[outIndex + 1] : undefined;
  if (!env.OPENCODE_API_KEY) throw new Error("OPENCODE_API_KEY is required (set the env var before running).");
  if (!outDir) throw new Error("--out <dir> is required.");
  const result = await runStatusCheck({ fetchImpl, writeFile, outDir, apiKey: env.OPENCODE_API_KEY, now });

  log(formatProbeLine("gateway", result.gateway));
  log(formatProbeLine("flash", result.flash));

  const summaryPath = env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    try {
      await summaryWriteFile(summaryPath, buildSummaryTable([
        ["gateway", result.gateway],
        ["flash", result.flash],
      ]), { flag: "a" });
    } catch {
      // A diagnostics/summary failure never blocks valid badge publication;
      // the fixed warning carries no exception text and exit stays 0.
      warn(SUMMARY_APPEND_FAILURE_WARNING);
    }
  }
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

export {
  SUMMARY_APPEND_FAILURE_WARNING,
  buildSummaryTable,
  checkFlash,
  checkGateway,
  formatProbeLine,
  main,
  runStatusCheck,
};
