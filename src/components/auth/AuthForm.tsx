"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Mail, Lock, User, ArrowRight, Loader2, Sparkles } from "lucide-react";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const { signIn, signUp, supabaseReady } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const result = mode === "login"
      ? await signIn(email, password)
      : await signUp(email, password, name);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (mode === "signup") {
      setSuccess("注册成功！请查看邮箱中的确认链接完成验证。");
      return;
    }

    // Login success → redirect to dashboard
    const next = searchParams.get("next") ?? "/";
    router.push(next);
  };

  if (!supabaseReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <Sparkles className="mx-auto mb-4 text-blue-500" size={40} />
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Supabase 未配置</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            请在 <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-blue-600">.env.local</code> 中填入
            NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY
          </p>
          <p className="mt-3 text-sm text-gray-400">
            目前使用 Mock 数据模式运行
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6 pb-24">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mb-3 sm:mb-4">
            <Sparkles className="text-blue-600 dark:text-blue-400" size={26} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
            {mode === "login" ? "欢迎回来" : "创建账号"}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {mode === "login" ? "登录您的 Life Work Hub" : "开始构建您的 AI 生活工作台"}
          </p>
        </div>

        {/* Error / Success */}
        {error && (
          <div className="mb-4 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs sm:text-sm text-red-700 dark:text-red-400 break-words">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-xs sm:text-sm text-green-700 dark:text-green-400 break-words">
            {success}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                姓名
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center justify-center pointer-events-none">
                  <User className="text-gray-400 shrink-0" size={18} />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="你的名字"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
              邮箱
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 flex items-center justify-center pointer-events-none">
                <Mail className="text-gray-400 shrink-0" size={18} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
              密码
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 flex items-center justify-center pointer-events-none">
                <Lock className="text-gray-400 shrink-0" size={18} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位字符"
                minLength={6}
                required
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  {mode === "login" ? "登录" : "创建账号"}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Toggle mode */}
        <p className="mt-6 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          {mode === "login" ? (
            <>
              还没有账号？{" "}
              <a href="/auth/signup" className="text-blue-600 hover:underline font-medium">
                注册
              </a>
            </>
          ) : (
            <>
              已有账号？{" "}
              <a href="/auth/login" className="text-blue-600 hover:underline font-medium">
                登录
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
