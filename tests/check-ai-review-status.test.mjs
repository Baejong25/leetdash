import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { checkFlash, main, runStatusCheck } from "../scripts/check-ai-review-status.mjs";

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
      gateway: { message: "up", color: "brightgreen" },
      flash: { message: "up", color: "brightgreen" },
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

  it("classifies flash down when its request aborts (timeout path) without affecting the gateway probe", async () => {
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

    expect(result.gateway).toEqual({ message: "up", color: "brightgreen" });
    expect(result.flash).toEqual({ message: "down", color: "red" });

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

    expect(result.gateway).toEqual({ message: "up", color: "brightgreen" });
    expect(result.flash).toEqual({ message: "up", color: "brightgreen" });
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

    expect(result.flash).toEqual({ message: "down", color: "red" });
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

    expect(result.flash).toEqual({ message: "down", color: "red" });
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

      const pending = checkFlash({ fetchImpl, apiKey });
      await vi.advanceTimersByTimeAsync(600_000);
      const result = await pending;

      expect(result).toEqual({ message: "down", color: "red" });
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

      const pending = checkFlash({ fetchImpl, apiKey });
      await vi.advanceTimersByTimeAsync(30_000);
      expect(abortCount).toBe(0);

      await vi.advanceTimersByTimeAsync(270_000);
      expect(abortCount).toBe(1);

      await vi.advanceTimersByTimeAsync(300_000);
      expect(abortCount).toBe(2);

      const result = await pending;
      expect(result).toEqual({ message: "down", color: "red" });
    } finally {
      vi.useRealTimers();
    }
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
