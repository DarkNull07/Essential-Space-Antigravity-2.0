"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";

const supabase = createClient();

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          setMessage({ type: "error", text: "Passwords do not match." });
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          setMessage({ type: "error", text: error.message });
        } else {
          setMessage({
            type: "success",
            text: "Please check your email to confirm signing up to Essential Space.",
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setMessage({ type: "error", text: error.message });
        } else {
          router.push("/");
          router.refresh();
        }
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setMessage({ type: "error", text: error.message });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "An unexpected error occurred." });
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col justify-between p-8 md:p-16 text-foreground selection:bg-accent selection:text-white">
      {/* Top Navigation */}
      <header className="flex justify-between items-center border-b border-foreground pb-6">
        <div className="flex items-center space-x-3">
          <Logo size={28} className="text-foreground" />
          <span className="font-display font-semibold tracking-wider text-xl uppercase hidden sm:inline">
            Essential Space
          </span>
        </div>
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground bg-muted px-2.5 py-1 border border-foreground/10">
          v2.0.0 // Antigravity
        </span>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 py-12">
        {/* Left Side: Art Statement */}
        <div className="flex-1 max-w-lg space-y-6">
          <span className="font-mono text-xs text-accent uppercase tracking-widest block font-semibold">
            * 01. THE MANIFESTO
          </span>
          <h2 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl leading-[1.1] uppercase tracking-tighter">
            Digital Canvas for Structured Minds.
          </h2>
          <p className="font-sans text-muted-foreground text-sm leading-relaxed max-w-md">
            Essential Space replaces chaotic clutter with a rigid, neo-brutalist gallery layout. Drop files from your desktop, capture inspirations, compile snippets, and preserve spatial focus.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-foreground/10">
            <div>
              <span className="font-mono text-xs text-muted-foreground block">01 / CAPTURE</span>
              <span className="font-sans text-xs font-medium">Drag-and-drop anything</span>
            </div>
            <div>
              <span className="font-mono text-xs text-muted-foreground block">02 / ORGANIZE</span>
              <span className="font-sans text-xs font-medium">Asymmetric sorting grids</span>
            </div>
            <div>
              <span className="font-mono text-xs text-muted-foreground block">03 / PERSIST</span>
              <span className="font-sans text-xs font-medium">Monospaced metadata</span>
            </div>
          </div>
        </div>

        {/* Right Side: Login Card */}
        <div className="w-full max-w-md bg-white border-2 border-foreground shadow-[6px_6px_0px_0px_var(--foreground)] p-8 space-y-8">
          <div className="space-y-2">
            <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold block">
              * 02. AUTHENTICATION
            </span>
            <h3 className="font-display font-bold text-2xl uppercase tracking-tight">
              {isSignUp ? "Create an Account" : "Access the Workspace"}
            </h3>
            <p className="font-sans text-xs text-muted-foreground">
              {isSignUp
                ? "Sign up with your email and password, or your Google account."
                : "Sign in with your email and password, or your Google account."}
            </p>
          </div>

          {message && (
            <div
              className={`p-4 border-2 font-mono text-xs ${
                message.type === "success"
                  ? "bg-[#E6F4EA] border-[#137333] text-[#137333]"
                  : "bg-[#FCE8E6] border-[#C5221F] text-[#C5221F]"
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="font-mono text-xs uppercase tracking-wider block">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                required
                disabled={loading}
                className="w-full bg-background border-2 border-foreground px-4 py-3 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="font-mono text-xs uppercase tracking-wider block">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="w-full bg-background border-2 border-foreground px-4 py-3 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors"
              />
            </div>

            {isSignUp && (
              <div className="space-y-1">
                <label htmlFor="confirmPassword" className="font-mono text-xs uppercase tracking-wider block">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full bg-background border-2 border-foreground px-4 py-3 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-[#E04B28] text-white border-2 border-foreground shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[1px] hover:translate-y-[1px] py-3.5 px-4 font-display font-bold text-sm tracking-widest uppercase transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer"
            >
              {isSignUp
                ? (loading ? "Creating Account..." : "Create Account")
                : (loading ? "Signing In..." : "Sign In")}
            </button>
          </form>

          <div className="text-center font-mono text-[11px] uppercase tracking-wider pt-2 text-muted-foreground">
            {isSignUp ? (
              <span>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setMessage(null);
                  }}
                  className="text-accent font-bold hover:underline focus:outline-none ml-1 uppercase"
                >
                  Sign In
                </button>
              </span>
            ) : (
              <span>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setMessage(null);
                  }}
                  className="text-accent font-bold hover:underline focus:outline-none ml-1 uppercase"
                >
                  Sign Up
                </button>
              </span>
            )}
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-foreground/10"></div>
            <span className="flex-shrink mx-4 font-mono text-[10px] text-muted-foreground uppercase">
              OR CONNECT WITH
            </span>
            <div className="flex-grow border-t border-foreground/10"></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-background hover:bg-muted text-foreground border-2 border-foreground shadow-[2px_2px_0px_0px_var(--foreground)] hover:shadow-[1px_1px_0px_0px_var(--foreground)] hover:translate-x-[1px] hover:translate-y-[1px] py-3.5 px-4 font-display font-bold text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
          >
            {/* Google Icon SVG */}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Google OAuth
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-foreground/10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono text-muted-foreground">
        <span>© 2026 ESSENTIAL SPACE. ALL RIGHTS RESERVED.</span>
        <div className="flex gap-6">
          <a href="#" className="hover:text-accent transition-colors">SECURITY</a>
          <a href="#" className="hover:text-accent transition-colors">API DOCS</a>
          <a href="#" className="hover:text-accent transition-colors">STATUS</a>
        </div>
      </footer>
    </main>
  );
}
