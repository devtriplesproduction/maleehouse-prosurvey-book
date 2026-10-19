"use client";

import { loginAction } from "@/actions/auth.actions";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { useToast } from "@/hooks/use-toast";

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const result = await loginAction(email, password);

        if (result && !result.success) {
          setError(result.error || "Unable to sign in.");
          toast({
            title: "Authentication Failed",
            description: result.error || "Please verify your credentials and try again.",
            variant: "error"
          });
        } else if (result && result.success && result.redirectTo) {
          window.location.assign(result.redirectTo);
        }
      } catch (err: any) {
        setError("An unexpected error occurred.");
        console.error(err);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Work Email
          </label>
          <div className="relative group">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-blue-500" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-[14px] font-medium text-slate-900 shadow-[0_2px_10px_rgba(15,23,42,0.02)] outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="name@company.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Password
          </label>
          <div className="relative group">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-blue-500" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-[14px] font-medium text-slate-900 shadow-[0_2px_10px_rgba(15,23,42,0.02)] outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors hover:text-slate-500"
            >
              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-blue-600 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(0,100,224,0.25)] transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 mt-1"
        >
          {isPending ? (
            <>
              <span className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
