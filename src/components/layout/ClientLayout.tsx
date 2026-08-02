"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { ServiceWorkerRegistration } from "@/components/layout/ServiceWorkerRegistration";
import { InstallPrompt } from "@/components/layout/InstallPrompt";

/**
 * Client-side layout wrapper.
 * Wraps the app with AuthProvider and handles PWA features.
 * Separated from the server layout to keep `layout.tsx` a Server Component.
 */
export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ServiceWorkerRegistration />
      <InstallPrompt />
      {children}
    </AuthProvider>
  );
}
