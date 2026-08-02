// ================================================================
// Provider 无关的 LLM 调用适配器（客户端侧）
// ----------------------------------------------------------------
// - 不引入任何 SDK 依赖，走 /api/ai 服务端路由（key 只在服务端）。
// - 未配置 key 时 callAI 直接返回 null，调用方回落到本地引擎。
// - 内置超时、单次重试、JSON 容错解析、内存级缓存。
// ================================================================

import { renderPrompt, type PromptTemplate } from "./prompts";

export interface AIEnvelope<R> {
  reasoning: string[];
  result: R;
}

export interface CallOptions {
  /** 毫秒，默认 20000 */
  timeoutMs?: number;
  /** 失败重试次数，默认 1 */
  retries?: number;
  /** 传入相同 key 时复用结果，默认按 prompt 内容哈希 */
  cacheKey?: string;
  signal?: AbortSignal;
}

const memo = new Map<string, unknown>();

/** 客户端能感知的开关：服务端有没有配 key 由 /api/ai 的 GET 探测 */
let _enabled: boolean | null = null;

export async function isAIEnabled(): Promise<boolean> {
  if (_enabled !== null) return _enabled;
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch("/api/ai", { method: "GET" });
    const json = (await res.json()) as { enabled?: boolean };
    _enabled = Boolean(json.enabled);
  } catch {
    _enabled = false;
  }
  return _enabled;
}

/** 测试或强制降级时使用 */
export function setAIEnabled(v: boolean | null) {
  _enabled = v;
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

/**
 * 从模型回复中稳健地抽取 JSON：
 * 处理 ```json 包裹、前后废话、以及尾随逗号三种最常见的脏输出。
 */
export function extractJSON<T>(text: string): T | null {
  if (!text) return null;
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  s = s.slice(start, end + 1);
  const attempts = [s, s.replace(/,\s*([}\]])/g, "$1")];
  for (const a of attempts) {
    try {
      return JSON.parse(a) as T;
    } catch {
      /* next */
    }
  }
  return null;
}

/**
 * 调用 LLM。返回 null 代表"不可用或失败"，调用方必须有本地兜底。
 */
export async function callAI<TInput, TResult>(
  tpl: PromptTemplate<TInput>,
  input: TInput,
  opts: CallOptions = {}
): Promise<AIEnvelope<TResult> | null> {
  if (!(await isAIEnabled())) return null;

  const payload = renderPrompt(tpl, input);
  const key = opts.cacheKey ?? `${payload.id}@${payload.version}:${hash(payload.user)}`;
  if (memo.has(key)) return memo.get(key) as AIEnvelope<TResult>;

  const retries = opts.retries ?? 1;
  const timeoutMs = opts.timeoutMs ?? 20000;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    if (opts.signal) opts.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: payload.system,
          user: payload.user,
          temperature: payload.temperature,
          maxTokens: payload.maxTokens,
          promptId: payload.id,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = (await res.json()) as { ok: boolean; text?: string };
      if (!json.ok || !json.text) continue;

      const parsed = extractJSON<AIEnvelope<TResult>>(json.text);
      if (!parsed || !("result" in parsed)) continue;
      if (!Array.isArray(parsed.reasoning)) parsed.reasoning = [];

      memo.set(key, parsed);
      return parsed;
    } catch {
      clearTimeout(timer);
      // 继续重试
    }
  }
  return null;
}

export function clearAICache() {
  memo.clear();
}
