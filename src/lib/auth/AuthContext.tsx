"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  supabaseReady: boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabaseReady = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabaseReady);
  // Prevent an older getSession() response from replacing a newer sign-in session.
  const sessionVersion = useRef(0);

  useEffect(() => {
    if (!supabaseReady) {
      return;
    }

    const supabase = getSupabase();

    let active = true;
    const initialVersion = sessionVersion.current;

    void supabase.auth.getSession().then(({ data: { session } }) => {
      // Password sign-in or an auth event can complete before this initial
      // request resolves. In that case this is stale state and must not
      // redirect the freshly authenticated user back to /auth/login.
      if (!active || initialVersion !== sessionVersion.current) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const subscriptionVersion = sessionVersion.current;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Supabase emits INITIAL_SESSION asynchronously. If password login
        // completed first, its stale null payload must not undo that session.
        if (event === "INITIAL_SESSION" && subscriptionVersion !== sessionVersion.current) return;
        sessionVersion.current += 1;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabaseReady]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error("[Auth] signIn error:", error.message);
        return { error: error.message };
      }
      // Immediately set session in state so redirect doesn't race with onAuthStateChange
      if (data.session) {
        sessionVersion.current += 1;
        setSession(data.session);
        setUser(data.session.user);
        setLoading(false);
        console.log("[Auth] signIn success, user:", data.session.user?.email);
      }
      return { error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "登录失败，请重试";
      console.error("[Auth] signIn exception:", msg);
      return { error: msg };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) {
        console.error("[Auth] signUp error:", error.message);
        return { error: error.message };
      }
      console.log("[Auth] signUp success, user:", data.user?.email);
      return { error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "注册失败，请重试";
      console.error("[Auth] signUp exception:", msg);
      return { error: msg };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[Auth] signOut error:", err);
    }
    sessionVersion.current += 1;
    setUser(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, supabaseReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
