"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Mail, Lock, User, ArrowRight, Loader2, Sparkles, AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const { signIn, signUp, supabaseReady } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const friendlyError = (msg: string): string => {
    const lower = msg.toLowerCase();
    if (lower.includes("invalid login credentials")) return "邮箱或密码错误，请检查后重试";
    if (lower.includes("email not confirmed")) return "邮箱尚未验证，请查看确认邮件";
    if (lower.includes("user not found")) return "该邮箱尚未注册";
    if (lower.includes("weak_password")) return "密码强度不足，请设置至少 6 位密码";
    if (lower.includes("email_exists")) return "该邮箱已注册，请直接登录";
    if (lower.includes("network")) return "网络连接失败，请检查网络后重试";
    return msg;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent double submission

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const result =
        mode === "login"
          ? await signIn(email, password)
          : await signUp(email, password, name);

      if (result.error) {
        setError(friendlyError(result.error));
        setLoading(false);
        return;
      }

      if (mode === "signup") {
        setSuccess("注册成功！请查看邮箱中的确认链接完成验证。");
        setLoading(false);
        return;
      }

      // Login success → redirect to home
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "发生未知错误，请重试";
      setError(friendlyError(msg));
      setLoading(false);
    }
  };

  if (!supabaseReady) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-gray-100">
          <Sparkles className="mx-auto mb-4 text-amber-400" size={40} />
          <h2 className="text-lg font-semibold text-gray-800">尚未连接 Supabase</h2>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            请在 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-blue-600 text-xs">.env.local</code>{" "}
            中配置 Supabase 项目信息后重启服务
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 sm:p-6 pb-24">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 sm:p-10 max-w-sm w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl mb-4">
            <Sparkles className="text-blue-600" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {mode === "login" ? "欢迎回来" : "创建账号"}
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            {mode === "login" ? "登录 Life Work Hub" : "开始构建您的 AI 工作台"}
          </p>
        </div>

        {/* Feedback */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 rounded-xl">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
            <p className="text-sm text-red-700 leading-relaxed">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-5 flex items-start gap-2.5 p-3 bg-green-50 border border-green-100 rounded-xl">
            <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={16} />
            <p className="text-sm text-green-700 leading-relaxed">{success}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                姓名
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="你的名字"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition disabled:opacity-60"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              邮箱
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                disabled={loading}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              密码
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位字符"
                minLength={6}
                required
                disabled={loading}
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                tabIndex={-1}
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-semibold text-sm transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>{mode === "login" ? "登录中..." : "注册中..."}</span>
                </>
              ) : (
                <>
                  <span>{mode === "login" ? "登录" : "创建账号"}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Toggle */}
        <p className="mt-6 text-center text-sm text-gray-500">
          {mode === "login" ? (
            <>
              还没有账号？{" "}
              <a href="/auth/signup" className="text-blue-600 hover:text-blue-700 font-medium transition">
                注册
              </a>
            </>
          ) : (
            <>
              已有账号？{" "}
              <a href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium transition">
                登录
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
