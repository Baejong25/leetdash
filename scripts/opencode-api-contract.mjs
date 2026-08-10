// opencode-api-contract.mjs
//
// Zero-dependency contract for the OpenCode chat-completions path.
// Shared by the review client (scripts/opencode-review-clients.mjs)
// and the DeepSeek availability probe (scripts/check-ai-review-status.mjs).
// Keep this module free of imports and free of response content.

const openCodeChatCompletionsUrl = "https://opencode.ai/zen/go/v1/chat/completions";
const openCodeApiModel = "deepseek-v4-flash";
const openCodeRequestTimeoutMs = 300_000;

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || (Number.isInteger(status) && status >= 500 && status <= 599);
}

/**
 * Accepts a provider chat-completions body and returns { ok: true, content }
 * when it contains exactly one assistant choice with nonblank string content,
 * otherwise a fixed { ok: false }. Untrusted payload values are never
 * embedded in the returned result.
 */
function parseAssistantResponse(body) {
  const choices = body?.choices;
  const message = Array.isArray(choices) && choices.length === 1 ? choices[0]?.message : undefined;
  const content = message?.content;
  if (message?.role !== "assistant" || typeof content !== "string" || content.trim().length === 0) {
    return { ok: false };
  }
  return { ok: true, content };
}

export {
  isRetryableStatus,
  openCodeApiModel,
  openCodeChatCompletionsUrl,
  openCodeRequestTimeoutMs,
  parseAssistantResponse,
};
