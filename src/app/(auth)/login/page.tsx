"use client";

import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthIllustration } from "@/components/auth/AuthIllustration";
import { motion } from "framer-motion";

export default function LoginPage() {
  return (
    <AuthLayout illustration={<AuthIllustration />}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <header className="mb-6">
          <Link href="/" className="inline-flex items-center">
            <img
              src="/maleehouse Logo.png"
              alt="Malee House"
              className="h-10 w-auto object-contain dark:brightness-0 dark:invert"
            />
          </Link>
        </header>

        <div className="flex flex-col w-full">
          <div className="mb-10 space-y-3">
            <h1 className="text-[42px] font-bold leading-[1.1] tracking-[-0.02em] text-slate-900">
              Welcome back.
            </h1>
            <p className="text-[17px] font-medium leading-[1.5] text-slate-500">
              Log in to coordinate your field operations and project workflows.
            </p>
          </div>

          <LoginForm />
        </div>
      </motion.div>
    </AuthLayout>
  );
}
