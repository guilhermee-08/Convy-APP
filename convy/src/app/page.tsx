"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const handleInitialAuth = async () => {
      // If there's an access token in the URL (from Magic Link landing on root instead of /login),
      // instantly route them to /login with the hash so the SDK consumes it securely and performs the onboarding checks.
      if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
        router.push("/auth/callback" + window.location.hash);
        return;
      }

      // If they simply hit the root page while already logged in, redirect them to their dashboard
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (typeof window !== "undefined" && localStorage.getItem('pendingOnboarding')) {
          router.push('/login'); // We need login page to sync the pending onboarding data
        } else {
          router.push('/home');
        }
      }
    };
    handleInitialAuth();
  }, [router]);

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-2xl text-center space-y-8 relative z-10">
        <div className="space-y-4">
          <div className="inline-block rounded-full px-3 py-1 text-xs text-primary font-bold bg-primary/10 border border-primary/20 mb-4 tracking-wide uppercase">
            CONVERSAÇÃO COM IA
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white drop-shadow-sm">
            Pare de travar em inglês
          </h1>
          <p className="text-base md:text-lg text-text-secondary max-w-lg mx-auto leading-relaxed">
            Pratique conversas reais com IA em 1 minuto
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-6 pt-6">
          <Link href="/onboarding" className="w-full sm:w-auto">
            <Button variant="primary" className="text-lg px-8 h-14 w-full sm:w-auto">
              Começar a falar agora
            </Button>
          </Link>
          <Link
            href="/login"
            className="text-text-secondary hover:text-white transition-colors text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/5 active:scale-95"
          >
            Já tenho conta — Entrar
          </Link>
        </div>
      </Card>

      {/* Floating Elements / Decoration */}
      <div className="absolute bottom-10 text-text-secondary/50 text-xs font-bold tracking-widest uppercase">
        PRATIQUE E FALE COM CONFIANÇA
      </div>
    </main>
  );
}
