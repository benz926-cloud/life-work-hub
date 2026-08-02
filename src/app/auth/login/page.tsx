"use client";

import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      }
    >
      <AuthForm mode="login" />
    </Suspense>
  );
}
