// ================================================================
// /api/ai —— LLM 调用的唯一服务端出口
// ----------------------------------------------------------------
// 环境变量（.env.local，不要用 NEXT_PUBLIC_ 前缀，key 绝不能进浏览器）：
//   AI_PROVIDER = anthropic | openai | deepseek        (默认 anthropic)
//   AI_API_KEY  = sk-...
//   AI_MODEL    = claude-sonnet-5 / gpt-4o-mini / deepseek-chat
//   AI_BASE_URL = 可选，自建网关或兼容 OpenAI 协议的服务
//
// 未配置 AI_API_KEY 时：GET 返回 { enabled:false }，POST 返回
// { ok:false, reason:"not_configured" }，前端自动使用本地引擎，页面照常可用。
// 刻意不引入任何 SDK 依赖，直接 fetch，保持 package.json 干净。
// ================================================================

// Next.js 16：`dynamic` 段配置在 Cache Components 下已移除，这里改用 no-store 响应头。
export const runtime = "nodejs";

type Provider = "anthropic" | "openai" | "deepseek";

const PROVIDER = (process.env.AI_PROVIDER ?? "anthropic") as Provider;
const API_KEY = process.env.AI_API_KEY ?? "";
const MODEL =
  process.env.AI_MODEL ??
  (PROVIDER === "anthropic" ? "claude-sonnet-5" : PROVIDER === "deepseek" ? "deepseek-chat" : "gpt-4o-mini");

const BASE: Record<Provider, string> = {
  anthropic: process.env.AI_BASE_URL ?? "https://api.anthropic.com/v1/messages",
  openai: process.env.AI_BASE_URL ?? "https://api.openai.com/v1/chat/completions",
  deepseek: process.env.AI_BASE_URL ?? "https://api.deepseek.com/chat/completions",
};

function configured() {
  return API_KEY.length > 10;
}

export async function GET() {
  return Response.json(
    { enabled: configured(), provider: configured() ? PROVIDER : null, model: configured() ? MODEL : null },
    { headers: { "Cache-Control": "no-store" } }
  );
}

interface Body {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  promptId?: string;
}

export async function POST(request: Request) {
  if (!configured()) {
    return Response.json({ ok: false, reason: "not_configured" }, { status: 200 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }
  if (!body?.system || !body?.user) {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const temperature = body.temperature ?? 0.3;
  const maxTokens = Math.min(body.maxTokens ?? 1000, 4000);

  try {
    let text = "";

    if (PROVIDER === "anthropic") {
      const res = await fetch(BASE.anthropic, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          temperature,
          system: body.system,
          messages: [{ role: "user", content: body.user }],
        }),
      });
      if (!res.ok) {
        return Response.json({ ok: false, reason: `upstream_${res.status}` }, { status: 200 });
      }
      const json = (await res.json()) as { content?: { type: string; text?: string }[] };
      text = (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    } else {
      // OpenAI / DeepSeek 共用 chat/completions 协议
      const res = await fetch(BASE[PROVIDER], {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: body.system },
            { role: "user", content: body.user },
          ],
        }),
      });
      if (!res.ok) {
        return Response.json({ ok: false, reason: `upstream_${res.status}` }, { status: 200 });
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      text = json.choices?.[0]?.message?.content ?? "";
    }

    if (!text) return Response.json({ ok: false, reason: "empty" }, { status: 200 });
    return Response.json({ ok: true, text, provider: PROVIDER, model: MODEL });
  } catch (e) {
    console.error("[api/ai]", e);
    return Response.json({ ok: false, reason: "network" }, { status: 200 });
  }
}
