"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail, Sparkles, UserRound } from "lucide-react";

interface AuthFormProps { mode: "login" | "signup"; }
type FieldName = "name" | "email" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;

const friendlyError = (message: string) => {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) return "邮箱或密码错误，请检查后重试。";
  if (lower.includes("email not confirmed")) return "邮箱尚未验证，请查看确认邮件。";
  if (lower.includes("user not found")) return "该邮箱尚未注册。";
  if (lower.includes("weak_password")) return "密码强度不足，请设置至少 6 位密码。";
  if (lower.includes("email_exists") || lower.includes("already registered")) return "该邮箱已注册，请直接登录。";
  if (lower.includes("network") || lower.includes("fetch")) return "网络连接失败，请检查网络后重试。";
  return message;
};

export function AuthForm({ mode }: AuthFormProps) {
  const { signIn, signUp, supabaseReady } = useAuth();
  const router = useRouter();
  const id = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const fieldIds = useMemo(() => ({ name: `${id}-name`, email: `${id}-email`, password: `${id}-password` }), [id]);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (mode === "signup" && name.trim().length < 2) next.name = "请输入至少 2 个字符的姓名。";
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "请输入有效的邮箱地址。";
    if (password.length < 6) next.password = "密码至少需要 6 位字符。";
    return next;
  };
  const validateField = (field: FieldName) => {
    const next = validate();
    setErrors((current) => ({ ...current, [field]: next[field] }));
  };
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    const nextErrors = validate();
    setErrors(nextErrors); setFormError(""); setSuccess("");
    if (Object.keys(nextErrors).length > 0) return;
    setLoading(true);
    try {
      const result = mode === "login" ? await signIn(email, password) : await signUp(email, password, name.trim());
      if (result.error) { setFormError(friendlyError(result.error)); return; }
      if (mode === "signup") { setSuccess("注册成功。请在邮箱中打开确认链接后再登录。"); return; }
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next?.startsWith("/") ? next : "/");
    } catch (error: unknown) {
      setFormError(friendlyError(error instanceof Error ? error.message : "发生未知错误，请重试。"));
    } finally { setLoading(false); }
  };

  if (!supabaseReady) return (
    <main className="auth-surface min-h-dvh grid place-items-center px-5 py-10">
      <section className="auth-panel max-w-md p-7 text-center sm:p-9" aria-labelledby="offline-title">
        <div className="auth-mark mx-auto mb-5"><Sparkles size={22} aria-hidden="true" /></div>
        <h1 id="offline-title" className="text-xl font-semibold text-slate-950 dark:text-white">尚未连接 Supabase</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">请在 <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-sky-700 dark:bg-slate-800 dark:text-sky-300">.env.local</code> 中配置项目凭据后重启服务。</p>
      </section>
    </main>
  );

  const isSignup = mode === "signup";
  const inputClass = (field: FieldName) => `auth-input ${errors[field] ? "auth-input-error" : ""}`;
  return (
    <main className="auth-surface min-h-dvh grid place-items-center px-5 py-10 sm:px-8">
      <section className="auth-panel w-full max-w-md p-6 sm:p-9" aria-labelledby="auth-title">
        <header className="mb-8 text-center">
          <div className="auth-mark mx-auto mb-5"><Sparkles size={22} aria-hidden="true" /></div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Life Work Hub</p>
          <h1 id="auth-title" className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{isSignup ? "创建你的工作中枢" : "欢迎回来"}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{isSignup ? "从一个清晰、有节奏的日常开始。" : "继续处理今天最重要的事。"}</p>
        </header>
        <div aria-live="polite" aria-atomic="true">{formError && <Feedback type="error" message={formError} />}{success && <Feedback type="success" message={success} />}</div>
        <form noValidate onSubmit={handleSubmit} className="space-y-5">
          {isSignup && <Field label="姓名" htmlFor={fieldIds.name} error={errors.name}><UserRound className="auth-input-icon" size={18} aria-hidden="true" /><input id={fieldIds.name} value={name} onChange={(event) => setName(event.target.value)} onBlur={() => validateField("name")} className={inputClass("name")} placeholder="例如：林涛" autoComplete="name" disabled={loading} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${fieldIds.name}-error` : undefined} /></Field>}
          <Field label="邮箱" htmlFor={fieldIds.email} error={errors.email}><Mail className="auth-input-icon" size={18} aria-hidden="true" /><input id={fieldIds.email} type="email" value={email} onChange={(event) => setEmail(event.target.value)} onBlur={() => validateField("email")} className={inputClass("email")} placeholder="you@example.com" autoComplete="email" inputMode="email" disabled={loading} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${fieldIds.email}-error` : undefined} /></Field>
          <Field label="密码" htmlFor={fieldIds.password} error={errors.password} hint={isSignup ? "至少 6 位字符" : undefined}><KeyRound className="auth-input-icon" size={18} aria-hidden="true" /><input id={fieldIds.password} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} onBlur={() => validateField("password")} className={`${inputClass("password")} pr-12`} placeholder="输入你的密码" autoComplete={isSignup ? "new-password" : "current-password"} disabled={loading} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? `${fieldIds.password}-error` : undefined} /><button type="button" className="auth-password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "隐藏密码" : "显示密码"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></Field>
          <button type="submit" disabled={loading} className="auth-submit group">{loading ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <ArrowRight className="transition-transform group-hover:translate-x-0.5" size={18} aria-hidden="true" />}<span>{loading ? (isSignup ? "正在创建…" : "正在登录…") : isSignup ? "创建账号" : "登录"}</span></button>
        </form>
        <p className="mt-7 text-center text-sm text-slate-500 dark:text-slate-400">{isSignup ? "已经有账号？" : "还没有账号？"}<Link href={isSignup ? "/auth/login" : "/auth/signup"} className="ml-1.5 font-semibold text-sky-700 underline-offset-4 hover:underline dark:text-sky-300">{isSignup ? "去登录" : "创建账号"}</Link></p>
      </section>
    </main>
  );
}

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactNode }) {
  return <div><div className="mb-2 flex items-baseline justify-between gap-3"><label htmlFor={htmlFor} className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</label>{hint && <span className="text-xs text-slate-400">{hint}</span>}</div><div className="relative">{children}</div>{error && <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{error}</p>}</div>;
}
function Feedback({ type, message }: { type: "error" | "success"; message: string }) {
  const success = type === "success";
  return <div role={success ? "status" : "alert"} className={`mb-5 flex gap-2.5 rounded-xl border p-3 text-sm leading-5 ${success ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300"}`}>{success ? <CheckCircle2 size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> : <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />}<p>{message}</p></div>;
}
