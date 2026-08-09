import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { main, runStatusCheck } from "../scripts/check-ai-review-status.mjs";

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

    // Flash probe: exact endpoint, headers, and body shape.
    const flashRequest = requests.find((r) => r.url === CHAT_COMPLETIONS_URL);
    expect(flashRequest).toBeDefined();
    expect(flashRequest.init.method).toBe("POST");
    expect(flashRequest.init.headers["Content-Type"]).toBe("application/json");
    expect(flashRequest.init.headers.Authorization).toBe(`Bearer ${apiKey}`);
    expect(JSON.parse(flashRequest.init.body)).toEqual({
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: "Reply exactly with: OK" }],
      max_tokens: 1,
      stream: false,
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
