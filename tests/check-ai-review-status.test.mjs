import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  SUMMARY_APPEND_FAILURE_WARNING,
  buildSummaryTable,
  checkFlash,
  checkGateway,
  formatProbeLine,
  main,
  runStatusCheck,
} from "../scripts/check-ai-review-status.mjs";

const GATEWAY_URL = "https://opencode.ai/zen/go/v1/models";
const CHAT_COMPLETIONS_URL = "https://opencode.ai/zen/go/v1/chat/completions";
const FIXED_NOW = "2026-08-07T00:00:00.000Z";

function jsonResponse(body, { status = 200 } = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Capture every writeFile call into an in-memory map keyed by absolute path. */
function makeWriteCapture() {
  const files = new Map();
  const writeFile = async (file, contents) => {
    files.set(String(file), String(contents));
  };
  return { files, writeFile };
}

function parseStatus(raw) {
  return JSON.parse(raw);
}

/** A manually-advanced clock so elapsedMs is deterministic. */
function makeClock(initialMs = 0) {
  let ms = initialMs;
  return { now: () => new Date(ms), advance: (delta) => { ms += delta; } };
}

const BADGE_KEYS = ["color", "label", "lastChecked", "message", "schemaVersion"];

function successFetch(url) {
  if (String(url) === GATEWAY_URL) return jsonResponse({ data: [{ id: "deepseek-v4-flash" }] });
  return jsonResponse({ choices: [{ message: { role: "assistant", content: "OK" } }] });
}

describe("runStatusCheck", () => {
  let tmpDir;
  let writeCapture;
  let apiKey;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "ai-status-test-"));
    writeCapture = makeWriteCapture();
    apiKey = "test-secret-api-key";
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("classifies both probes up and never embeds the api key in the output files", async () => {
    const requests = [];
    const fetchImpl = async (url, init) => {
      requests.push({ url: String(url), init });
      if (String(url) === GATEWAY_URL) {
        return jsonResponse({ data: [{ id: "deepseek-v4-flash" }] });
      }
      return jsonResponse({ choices: [{ message: { role: "assistant", content: "OK" } }] });
    };

    const result = await runStatusCheck({
      fetchImpl,
      writeFile: writeCapture.writeFile,
      outDir: tmpDir,
      apiKey,
      now: () => new Date(FIXED_NOW),
    });

    expect(result).toEqual({
      gateway: { message: "up", color: "brightgreen", reason: "ok", attempts: 1, elapsedMs: 0, status: 200 },
      flash: { message: "up", color: "brightgreen", reason: "ok", attempts: 1, elapsedMs: 0, status: 200 },
      lastChecked: FIXED_NOW,
    });

    // Gateway probe: exact endpoint, headers, and AbortSignal wiring.
    const gatewayRequest = requests.find((r) => r.url === GATEWAY_URL);
    expect(gatewayRequest).toBeDefined();
    expect(gatewayRequest.init.method).toBe("GET");
    expect(gatewayRequest.init.headers.Authorization).toBe(`Bearer ${apiKey}`);
    expect(gatewayRequest.init.headers.Accept).toBe("application/json");
    expect(gatewayRequest.init.signal).toBeInstanceOf(AbortSignal);

    // Flash probe: exact endpoint, headers, and body shape — only the
    // shared model plus the fixed short availability prompt (no
    // max_tokens/stream overrides), mirroring the review client request.
    const flashRequest = requests.find((r) => r.url === CHAT_COMPLETIONS_URL);
    expect(flashRequest).toBeDefined();
    expect(flashRequest.init.method).toBe("POST");
    expect(flashRequest.init.headers["Content-Type"]).toBe("application/json");
    expect(flashRequest.init.headers.Authorization).toBe(`Bearer ${apiKey}`);
    expect(JSON.parse(flashRequest.init.body)).toEqual({
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: "Reply exactly with: OK" }],
    });
    expect(flashRequest.init.signal).toBeInstanceOf(AbortSignal);

    // Exactly the two expected files are written.
    expect([...writeCapture.files.keys()].sort()).toEqual([
      path.join(tmpDir, "deepseek-flash-status.json"),
      path.join(tmpDir, "gateway-status.json"),
    ]);

    const gatewayStatus = parseStatus(writeCapture.files.get(path.join(tmpDir, "gateway-status.json")));
    expect(gatewayStatus).toEqual({
      schemaVersion: 1,
      label: "OpenCode Go Gateway",
      message: "up",
      color: "brightgreen",
      lastChecked: FIXED_NOW,
    });

    const flashStatus = parseStatus(writeCapture.files.get(path.join(tmpDir, "deepseek-flash-status.json")));
    expect(flashStatus).toEqual({
      schemaVersion: 1,
      label: "DeepSeek V4 Flash (AI Review)",
      message: "up",
      color: "brightgreen",
      lastChecked: FIXED_NOW,
    });

    // The api key must never leak into badge output.
    const allContents = [...writeCapture.files.values()].join("\n");
    expect(allContents).not.toContain(apiKey);
  });

  it("keeps public badge JSON keys exactly schemaVersion, label, message, color, lastChecked when up and down", async () => {
    const fetchImpl = async (url) => {
      if (String(url) === GATEWAY_URL) return jsonResponse({ error: "boom" }, { status: 500 });
      return jsonResponse({ choices: [{ message: { role: "assistant", content: "" } }] });
    };

    await runStatusCheck({
      fetchImpl,
      writeFile: writeCapture.writeFile,
      outDir: tmpDir,
      apiKey,
      now: () => new Date(FIXED_NOW),
    });

    expect(writeCapture.files.size).toBe(2);
    for (const raw of writeCapture.files.values()) {
      const parsed = parseStatus(raw);
      expect(Object.keys(parsed).sort()).toEqual(BADGE_KEYS);
      expect(parsed.schemaVersion).toBe(1);
    }
    const gatewayStatus = parseStatus(writeCapture.files.get(path.join(tmpDir, "gateway-status.json")));
    expect(gatewayStatus).toEqual({
      schemaVersion: 1,
      label: "OpenCode Go Gateway",
      message: "down",
      color: "red",
      lastChecked: FIXED_NOW,
    });
  });

  it("classifies gateway down on HTTP 500 without affecting the flash probe (independence)", async () => {
    const fetchImpl = async (url) => {
      if (String(url) === GATEWAY_URL) return jsonResponse({ error: "boom" }, { status: 500 });
      return jsonResponse({ choices: [{ message: { role: "assistant", content: "OK" } }] });
    };

    await runStatusCheck({
      fetchImpl,
      writeFile: writeCapture.writeFile,
      outDir: tmpDir,
      apiKey,
      now: () => new Date(FIXED_NOW),
    });

    const gatewayStatus = parseStatus(writeCapture.files.get(path.join(tmpDir, "gateway-status.json")));
    expect(gatewayStatus).toMatchObject({ message: "down", color: "red" });

    const flashStatus = parseStatus(writeCapture.files.get(path.join(tmpDir, "deepseek-flash-status.json")));
    expect(flashStatus).toMatchObject({ message: "up", color: "brightgreen" });
  });

  it("classifies flash down when its fetch rejects with AbortError (transport path) without affecting the gateway probe", async () => {
    const fetchImpl = async (url) => {
      if (String(url) === GATEWAY_URL) {
        return jsonResponse({ data: [{ id: "deepseek-v4-flash" }] });
      }
      throw new DOMException("Aborted", "AbortError");
    };

    const result = await runStatusCheck({
      fetchImpl,
      writeFile: writeCapture.writeFile,
      outDir: tmpDir,
      apiKey,
      now: () => new Date(FIXED_NOW),
    });

    expect(result.gateway).toEqual({ message: "up", color: "brightgreen", reason: "ok", attempts: 1, elapsedMs: 0, status: 200 });
    expect(result.flash).toEqual({ message: "down", color: "red", reason: "transport_error", attempts: 2, elapsedMs: 0 });

    const flashStatus = parseStatus(writeCapture.files.get(path.join(tmpDir, "deepseek-flash-status.json")));
    expect(flashStatus).toMatchObject({ message: "down", color: "red" });
  });

  it("classifies flash down when assistant content is empty", async () => {
    const fetchImpl = async (url) => {
      if (String(url) === GATEWAY_URL) {
        return jsonResponse({ data: [{ id: "deepseek-v4-flash" }] });
      }
      return jsonResponse({ choices: [{ message: { role: "assistant", content: "" } }] });
    };

    await runStatusCheck({
      fetchImpl,
      writeFile: writeCapture.writeFile,
      outDir: tmpDir,
      apiKey,
      now: () => new Date(FIXED_NOW),
    });

    const flashStatus = parseStatus(writeCapture.files.get(path.join(tmpDir, "deepseek-flash-status.json")));
    expect(flashStatus).toMatchObject({ message: "down", color: "red" });
  });

  it("classifies flash down when choices is an empty array", async () => {
    const fetchImpl = async (url) => {
      if (String(url) === GATEWAY_URL) {
        return jsonResponse({ data: [{ id: "deepseek-v4-flash" }] });
      }
      return jsonResponse({ choices: [] });
    };

    await runStatusCheck({
      fetchImpl,
      writeFile: writeCapture.writeFile,
      outDir: tmpDir,
      apiKey,
      now: () => new Date(FIXED_NOW),
    });

    const flashStatus = parseStatus(writeCapture.files.get(path.join(tmpDir, "deepseek-flash-status.json")));
    expect(flashStatus).toMatchObject({ message: "down", color: "red" });
  });

  it("classifies flash down when the response is not valid JSON", async () => {
    const fetchImpl = async (url) => {
      if (String(url) === GATEWAY_URL) {
        return jsonResponse({ data: [{ id: "deepseek-v4-flash" }] });
      }
      return new Response("<html>gateway error page</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    };

    await runStatusCheck({
      fetchImpl,
      writeFile: writeCapture.writeFile,
      outDir: tmpDir,
      apiKey,
      now: () => new Date(FIXED_NOW),
    });

    const flashStatus = parseStatus(writeCapture.files.get(path.join(tmpDir, "deepseek-flash-status.json")));
    expect(flashStatus).toMatchObject({ message: "down", color: "red" });
  });

  it("imports the shared completion contract without redeclaring request policy", async () => {
    const source = await readFile(new URL("../scripts/check-ai-review-status.mjs", import.meta.url), "utf8");
    expect(source).toContain('from "./opencode-api-contract.mjs"');
    expect(source).not.toMatch(/const CHAT_COMPLETIONS_URL\s*=/);
    expect(source).not.toMatch(/const FLASH_MODEL\s*=/);
    expect(source).not.toMatch(/const FLASH_TIMEOUT_MS\s*=/);
    expect(source).not.toMatch(/function isRetryableStatus\s*\(/);
    expect(source).not.toMatch(/function parseAssistantResponse\s*\(/);
  });

  it("recovers flash to up after one retryable HTTP 429 with exactly two attempts", async () => {
    let flashCalls = 0;
    const fetchImpl = async (url) => {
      if (String(url) === GATEWAY_URL) {
        return jsonResponse({ data: [{ id: "deepseek-v4-flash" }] });
      }
      flashCalls += 1;
      if (flashCalls === 1) return jsonResponse({ error: "rate limited" }, { status: 429 });
      return jsonResponse({ choices: [{ message: { role: "assistant", content: "OK" } }] });
    };

    const result = await runStatusCheck({
      fetchImpl,
      writeFile: writeCapture.writeFile,
      outDir: tmpDir,
      apiKey,
      now: () => new Date(FIXED_NOW),
    });

    expect(result.gateway).toEqual({ message: "up", color: "brightgreen", reason: "ok", attempts: 1, elapsedMs: 0, status: 200 });
    expect(result.flash).toEqual({ message: "up", color: "brightgreen", reason: "ok", attempts: 2, elapsedMs: 0, status: 200 });
    expect(flashCalls).toBe(2);

    const flashStatus = parseStatus(writeCapture.files.get(path.join(tmpDir, "deepseek-flash-status.json")));
    expect(flashStatus).toMatchObject({ message: "up", color: "brightgreen" });
  });

  it("classifies flash down on HTTP 401 with exactly one attempt (no retry for auth failures)", async () => {
    let flashCalls = 0;
    const fetchImpl = async (url) => {
      if (String(url) === GATEWAY_URL) {
        return jsonResponse({ data: [{ id: "deepseek-v4-flash" }] });
      }
      flashCalls += 1;
      return jsonResponse({ error: "unauthorized" }, { status: 401 });
    };

    const result = await runStatusCheck({
      fetchImpl,
      writeFile: writeCapture.writeFile,
      outDir: tmpDir,
      apiKey,
      now: () => new Date(FIXED_NOW),
    });

    expect(result.flash).toEqual({ message: "down", color: "red", reason: "http_error", attempts: 1, elapsedMs: 0, status: 401 });
    expect(flashCalls).toBe(1);
  });

  it("rejects multiple assistant choices as flash down with exactly one attempt", async () => {
    let flashCalls = 0;
    const fetchImpl = async (url) => {
      if (String(url) === GATEWAY_URL) {
        return jsonResponse({ data: [{ id: "deepseek-v4-flash" }] });
      }
      flashCalls += 1;
      return jsonResponse({
        choices: [
          { message: { role: "assistant", content: "first" } },
          { message: { role: "assistant", content: "second" } },
        ],
      });
    };

    const result = await runStatusCheck({
      fetchImpl,
      writeFile: writeCapture.writeFile,
      outDir: tmpDir,
      apiKey,
      now: () => new Date(FIXED_NOW),
    });

    expect(result.flash).toEqual({ message: "down", color: "red", reason: "invalid_response", attempts: 1, elapsedMs: 0, status: 200 });
    expect(flashCalls).toBe(1);
  });

  it("retries once and classifies flash down after two consecutive timeouts", async () => {
    vi.useFakeTimers();
    try {
      let flashCalls = 0;
      const fetchImpl = (_url, init) => {
        flashCalls += 1;
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        });
      };

      const clock = makeClock();
      const pending = checkFlash({ fetchImpl, apiKey, now: clock.now });
      clock.advance(300_000);
      await vi.advanceTimersByTimeAsync(300_000);
      clock.advance(300_000);
      await vi.advanceTimersByTimeAsync(300_000);
      const result = await pending;

      expect(result).toEqual({ message: "down", color: "red", reason: "timeout", attempts: 2, elapsedMs: 600_000 });
      expect(flashCalls).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts the flash attempt only after the shared 300,000ms timeout, not the old 30s", async () => {
    vi.useFakeTimers();
    try {
      let abortCount = 0;
      const fetchImpl = (_url, init) => {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            abortCount += 1;
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      };

      const clock = makeClock();
      const pending = checkFlash({ fetchImpl, apiKey, now: clock.now });
      clock.advance(30_000);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(abortCount).toBe(0);

      clock.advance(270_000);
      await vi.advanceTimersByTimeAsync(270_000);
      expect(abortCount).toBe(1);

      clock.advance(300_000);
      await vi.advanceTimersByTimeAsync(300_000);
      expect(abortCount).toBe(2);

      const result = await pending;
      expect(result).toEqual({ message: "down", color: "red", reason: "timeout", attempts: 2, elapsedMs: 600_000 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("times out a stalled response body per attempt, retries once, and settles flash down with exactly two calls", async () => {
    vi.useFakeTimers();
    try {
      let flashCalls = 0;
      const fetchImpl = () => {
        flashCalls += 1;
        // HTTP 200 whose body parse never settles — the stalled json()
        // must time out per attempt instead of hanging the probe.
        return Promise.resolve({ status: 200, json: () => new Promise(() => {}) });
      };

      const clock = makeClock();
      const pending = checkFlash({ fetchImpl, apiKey, now: clock.now });

      // First 300,000ms attempt: the stalled body times out (retryable),
      // so the single retry is already in flight with its own timer.
      clock.advance(300_000);
      await vi.advanceTimersByTimeAsync(300_000);
      expect(flashCalls).toBe(2);
      expect(vi.getTimerCount()).toBe(1);

      // Second 300,000ms attempt: the body stalls again; the probe settles
      // down with every attempt timer cleared and no unhandled rejection.
      clock.advance(300_000);
      await vi.advanceTimersByTimeAsync(300_000);
      const result = await pending;
      expect(result).toEqual({ message: "down", color: "red", reason: "timeout", attempts: 2, elapsedMs: 600_000 });
      expect(flashCalls).toBe(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("classifies a normal JSON parse rejection as final with exactly one attempt (no retry)", async () => {
    let flashCalls = 0;
    const fetchImpl = () => {
      flashCalls += 1;
      return Promise.resolve({
        status: 200,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      });
    };

    const result = await checkFlash({ fetchImpl, apiKey, now: () => new Date(FIXED_NOW) });
    expect(result).toEqual({ message: "down", color: "red", reason: "invalid_json", attempts: 1, elapsedMs: 0, status: 200 });
    expect(flashCalls).toBe(1);
  });

  it("rejects without writing anything when OPENCODE_API_KEY is missing", async () => {
    await expect(runStatusCheck({
      fetchImpl: async () => jsonResponse({ data: [] }),
      writeFile: writeCapture.writeFile,
      outDir: tmpDir,
      apiKey: undefined,
      now: () => new Date(FIXED_NOW),
    })).rejects.toThrow(/OPENCODE_API_KEY/);

    expect(writeCapture.files.size).toBe(0);
  });

  it("rejects when the injected writeFile fails", async () => {
    const writeFile = async () => {
      throw new Error("disk full");
    };

    await expect(runStatusCheck({
      fetchImpl: async (url) => {
        if (String(url) === GATEWAY_URL) return jsonResponse({ data: [{ id: "deepseek-v4-flash" }] });
        return jsonResponse({ choices: [{ message: { role: "assistant", content: "OK" } }] });
      },
      writeFile,
      outDir: tmpDir,
      apiKey,
      now: () => new Date(FIXED_NOW),
    })).rejects.toThrow("disk full");
  });
});

describe("checkFlash reason classification", () => {
  const apiKey = "test-secret-api-key";
  const fixedNow = () => new Date(FIXED_NOW);

  it("classifies ok with attempts 1, HTTP 200, and zero elapsed under a fixed clock", async () => {
    const result = await checkFlash({
      fetchImpl: async () => jsonResponse({ choices: [{ message: { role: "assistant", content: "OK" } }] }),
      apiKey,
      now: fixedNow,
    });
    expect(result).toEqual({ message: "up", color: "brightgreen", reason: "ok", attempts: 1, elapsedMs: 0, status: 200 });
  });

  it("classifies transport_error with no status after two rejected attempts", async () => {
    let calls = 0;
    const result = await checkFlash({
      fetchImpl: async () => { calls += 1; throw new Error("ECONNRESET"); },
      apiKey,
      now: fixedNow,
    });
    expect(result).toEqual({ message: "down", color: "red", reason: "transport_error", attempts: 2, elapsedMs: 0 });
    expect(calls).toBe(2);
  });

  it("classifies http_error with status 429 after exhausting two retryable attempts", async () => {
    let calls = 0;
    const result = await checkFlash({
      fetchImpl: async () => { calls += 1; return jsonResponse({ error: "rate limited" }, { status: 429 }); },
      apiKey,
      now: fixedNow,
    });
    expect(result).toEqual({ message: "down", color: "red", reason: "http_error", attempts: 2, elapsedMs: 0, status: 429 });
    expect(calls).toBe(2);
  });

  it("classifies invalid_response for blank assistant content with status 200", async () => {
    const result = await checkFlash({
      fetchImpl: async () => jsonResponse({ choices: [{ message: { role: "assistant", content: "" } }] }),
      apiKey,
      now: fixedNow,
    });
    expect(result).toEqual({ message: "down", color: "red", reason: "invalid_response", attempts: 1, elapsedMs: 0, status: 200 });
  });

  it("classifies invalid_response for multiple assistant choices with status 200", async () => {
    const result = await checkFlash({
      fetchImpl: async () => jsonResponse({
        choices: [
          { message: { role: "assistant", content: "first" } },
          { message: { role: "assistant", content: "second" } },
        ],
      }),
      apiKey,
      now: fixedNow,
    });
    expect(result).toEqual({ message: "down", color: "red", reason: "invalid_response", attempts: 1, elapsedMs: 0, status: 200 });
  });
});

describe("checkGateway reason classification", () => {
  const apiKey = "test-secret-api-key";
  const fixedNow = () => new Date(FIXED_NOW);

  it("classifies ok with attempts 1 and HTTP 200", async () => {
    const result = await checkGateway({
      fetchImpl: async (url) => {
        expect(String(url)).toBe(GATEWAY_URL);
        return jsonResponse({ data: [{ id: "deepseek-v4-flash" }] });
      },
      apiKey,
      now: fixedNow,
    });
    expect(result).toEqual({ message: "up", color: "brightgreen", reason: "ok", attempts: 1, elapsedMs: 0, status: 200 });
  });

  it("classifies http_error with the integer status on HTTP 500", async () => {
    const result = await checkGateway({
      fetchImpl: async () => jsonResponse({ error: "boom" }, { status: 500 }),
      apiKey,
      now: fixedNow,
    });
    expect(result).toEqual({ message: "down", color: "red", reason: "http_error", attempts: 1, elapsedMs: 0, status: 500 });
  });

  it("classifies invalid_response when a 200 body fails validation", async () => {
    const result = await checkGateway({
      fetchImpl: async () => jsonResponse({ data: [] }),
      apiKey,
      now: fixedNow,
    });
    expect(result).toEqual({ message: "down", color: "red", reason: "invalid_response", attempts: 1, elapsedMs: 0, status: 200 });
  });

  it("classifies invalid_json when a 200 body is not JSON", async () => {
    const result = await checkGateway({
      fetchImpl: async () => new Response("<html>upstream error</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
      apiKey,
      now: fixedNow,
    });
    expect(result).toEqual({ message: "down", color: "red", reason: "invalid_json", attempts: 1, elapsedMs: 0, status: 200 });
  });

  it("classifies timeout when the fetch aborts", async () => {
    const result = await checkGateway({
      fetchImpl: async () => { throw new DOMException("Aborted", "AbortError"); },
      apiKey,
      now: fixedNow,
    });
    expect(result).toEqual({ message: "down", color: "red", reason: "timeout", attempts: 1, elapsedMs: 0 });
  });

  it("classifies transport_error on a network failure", async () => {
    const result = await checkGateway({
      fetchImpl: async () => { throw new Error("ECONNRESET"); },
      apiKey,
      now: fixedNow,
    });
    expect(result).toEqual({ message: "down", color: "red", reason: "transport_error", attempts: 1, elapsedMs: 0 });
  });
});

describe("formatProbeLine and buildSummaryTable", () => {
  it("formats a probe line including the optional HTTP status when present", () => {
    expect(formatProbeLine("gateway", { reason: "ok", attempts: 1, elapsedMs: 12, status: 200 }))
      .toBe("gateway: reason=ok attempts=1 elapsedMs=12 status=200");
  });

  it("formats a probe line omitting the status when absent", () => {
    expect(formatProbeLine("flash", { reason: "timeout", attempts: 2, elapsedMs: 600000 }))
      .toBe("flash: reason=timeout attempts=2 elapsedMs=600000");
  });

  it("builds a Markdown table with an empty status cell when the status is absent", () => {
    const table = buildSummaryTable([
      ["gateway", { reason: "http_error", attempts: 1, elapsedMs: 12, status: 500 }],
      ["flash", { reason: "timeout", attempts: 2, elapsedMs: 600000 }],
    ]);
    expect(table).toContain("| probe | reason | attempts | elapsedMs | status |");
    expect(table).toContain("| gateway | http_error | 1 | 12 | 500 |");
    expect(table).toContain("| flash | timeout | 2 | 600000 |  |");
  });
});

describe("main diagnostics and redaction", () => {
  let tmpDir;
  let writeCapture;
  let apiKey;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "ai-status-main-"));
    writeCapture = makeWriteCapture();
    apiKey = "test-secret-api-key";
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  function captureIo() {
    const stdout = [];
    const stderr = [];
    const summaryWrites = [];
    return {
      stdout,
      stderr,
      summaryWrites,
      log: (line) => stdout.push(String(line)),
      warn: (line) => stderr.push(String(line)),
      summaryWriteFile: async (file, contents, options) => {
        summaryWrites.push({ file: String(file), contents: String(contents), options });
      },
    };
  }

  function mainArgs(outDir, env, io) {
    return {
      argv: ["node", "scripts/check-ai-review-status.mjs", "--out", outDir],
      env,
      fetchImpl: successFetch,
      writeFile: writeCapture.writeFile,
      summaryWriteFile: io.summaryWriteFile,
      log: io.log,
      warn: io.warn,
      now: () => new Date(FIXED_NOW),
    };
  }

  it("emits exactly one safe gateway line and one safe flash line to stdout and nothing else", async () => {
    const io = captureIo();
    const outDir = path.join(tmpDir, "out");
    const result = await main(mainArgs(outDir, { OPENCODE_API_KEY: apiKey }, io));

    expect(result).toEqual({ exitCode: 0 });
    expect(io.stdout).toEqual([
      "gateway: reason=ok attempts=1 elapsedMs=0 status=200",
      "flash: reason=ok attempts=1 elapsedMs=0 status=200",
    ]);
    expect(io.stderr).toHaveLength(0);
    expect(io.summaryWrites).toHaveLength(0);
  });

  it("appends a safe Markdown table to GITHUB_STEP_SUMMARY when that environment path exists", async () => {
    const io = captureIo();
    const outDir = path.join(tmpDir, "out");
    const summaryPath = path.join(tmpDir, "step-summary.md");
    const result = await main(mainArgs(outDir, { OPENCODE_API_KEY: apiKey, GITHUB_STEP_SUMMARY: summaryPath }, io));

    expect(result).toEqual({ exitCode: 0 });
    expect(io.summaryWrites).toHaveLength(1);
    expect(io.summaryWrites[0].file).toBe(summaryPath);
    expect(io.summaryWrites[0].options).toEqual({ flag: "a" });
    expect(io.summaryWrites[0].contents).toContain("| probe | reason | attempts | elapsedMs | status |");
    expect(io.summaryWrites[0].contents).toContain("| gateway | ok | 1 | 0 | 200 |");
    expect(io.summaryWrites[0].contents).toContain("| flash | ok | 1 | 0 | 200 |");
    expect(io.summaryWrites[0].contents).not.toContain(apiKey);
    expect(io.stderr).toHaveLength(0);
  });

  it("warns with a fixed safe message and still exits 0 when the Step Summary append fails after badge writes", async () => {
    const io = captureIo();
    const outDir = path.join(tmpDir, "out");
    const summarySentinel = "summary-write-failed-sentinel";
    const failingSummaryWrite = async () => {
      throw new Error(summarySentinel);
    };

    const result = await main({
      ...mainArgs(outDir, { OPENCODE_API_KEY: apiKey, GITHUB_STEP_SUMMARY: path.join(tmpDir, "summary.md") }, io),
      summaryWriteFile: failingSummaryWrite,
    });

    expect(result).toEqual({ exitCode: 0 });
    expect(writeCapture.files.size).toBe(2);
    expect(io.stderr).toEqual([SUMMARY_APPEND_FAILURE_WARNING]);
    expect(io.stderr.join("\n")).not.toContain(summarySentinel);
    expect(io.stdout).toHaveLength(2);
  });

  it("rejects when a badge write fails even though diagnostics would be emitted", async () => {
    const io = captureIo();
    await expect(main({
      ...mainArgs(path.join(tmpDir, "out"), { OPENCODE_API_KEY: apiKey }, io),
      writeFile: async () => { throw new Error("disk full"); },
    })).rejects.toThrow("disk full");
  });

  it("never leaks API key, Authorization value, provider body, or request ID for an http_error", async () => {
    const io = captureIo();
    const outDir = path.join(tmpDir, "out");
    const bodySentinel = "provider-body-sentinel-xyz";
    const reqIdSentinel = "request-id-sentinel-999";
    const authSentinel = `Bearer ${apiKey}`;
    let flashCalls = 0;

    const fetchImpl = async (url) => {
      if (String(url) === GATEWAY_URL) return jsonResponse({ data: [{ id: "deepseek-v4-flash" }] });
      flashCalls += 1;
      return new Response(JSON.stringify({ error: bodySentinel, api_key: apiKey }), {
        status: 429,
        headers: { "content-type": "application/json", "x-request-id": reqIdSentinel },
      });
    };

    const result = await main({
      argv: ["node", "scripts/check-ai-review-status.mjs", "--out", outDir],
      env: { OPENCODE_API_KEY: apiKey, GITHUB_STEP_SUMMARY: path.join(tmpDir, "step-summary.md") },
      fetchImpl,
      writeFile: writeCapture.writeFile,
      summaryWriteFile: io.summaryWriteFile,
      log: io.log,
      warn: io.warn,
      now: () => new Date(FIXED_NOW),
    });

    expect(result).toEqual({ exitCode: 0 });
    expect(flashCalls).toBe(2);
    expect(io.stdout[1]).toBe("flash: reason=http_error attempts=2 elapsedMs=0 status=429");

    const allBadgeBytes = [...writeCapture.files.values()].join("\n");
    const combined = [
      allBadgeBytes,
      io.stdout.join("\n"),
      io.stderr.join("\n"),
      io.summaryWrites.map((w) => w.contents).join("\n"),
    ].join("\n");
    for (const sentinel of [apiKey, authSentinel, bodySentinel, reqIdSentinel]) {
      expect(combined).not.toContain(sentinel);
    }
  });

  it("never leaks thrown exception messages or assistant content for a transport_error", async () => {
    const io = captureIo();
    const outDir = path.join(tmpDir, "out");
    const errSentinel = "thrown-error-sentinel-abc";
    const contentSentinel = "assistant-content-sentinel";
    let flashCalls = 0;

    const fetchImpl = async (url) => {
      if (String(url) === GATEWAY_URL) return jsonResponse({ data: [{ id: "deepseek-v4-flash" }] });
      flashCalls += 1;
      if (flashCalls === 1) throw new Error(`${errSentinel}: connection reset`);
      // A successful second attempt carries an assistant-content sentinel that
      // must never reach diagnostics either (probe recovers to up).
      return jsonResponse({ choices: [{ message: { role: "assistant", content: `OK ${contentSentinel}` } }] });
    };

    const result = await main({
      argv: ["node", "scripts/check-ai-review-status.mjs", "--out", outDir],
      env: { OPENCODE_API_KEY: apiKey, GITHUB_STEP_SUMMARY: path.join(tmpDir, "step-summary.md") },
      fetchImpl,
      writeFile: writeCapture.writeFile,
      summaryWriteFile: io.summaryWriteFile,
      log: io.log,
      warn: io.warn,
      now: () => new Date(FIXED_NOW),
    });

    expect(result).toEqual({ exitCode: 0 });
    expect(flashCalls).toBe(2);
    expect(io.stdout[1]).toBe("flash: reason=ok attempts=2 elapsedMs=0 status=200");

    const allBadgeBytes = [...writeCapture.files.values()].join("\n");
    const combined = [
      allBadgeBytes,
      io.stdout.join("\n"),
      io.stderr.join("\n"),
      io.summaryWrites.map((w) => w.contents).join("\n"),
    ].join("\n");
    for (const sentinel of [apiKey, `Bearer ${apiKey}`, errSentinel, contentSentinel]) {
      expect(combined).not.toContain(sentinel);
    }
  });
});

describe("main", () => {
  it("rejects when OPENCODE_API_KEY is not set in the environment", async () => {
    await expect(main({
      argv: ["node", "scripts/check-ai-review-status.mjs", "--out", "/tmp/unused-out"],
      env: {},
    })).rejects.toThrow(/OPENCODE_API_KEY/);
  });

  it("rejects when --out is missing or empty", async () => {
    await expect(main({
      argv: ["node", "scripts/check-ai-review-status.mjs"],
      env: { OPENCODE_API_KEY: "test-secret-api-key" },
    })).rejects.toThrow(/--out/);
  });
});
