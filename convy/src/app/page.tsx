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

      <Card className="w-full max-w-2xl text-center p-12 space-y-8 relative z-10 border-white/5 bg-card/40">
        <div className="space-y-4">
          <div className="inline-block rounded-full px-3 py-1 text-sm text-primary font-medium bg-primary/10 border border-primary/20 mb-4 tracking-wide">
            CONVERSAÇÃO COM IA
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-text-main drop-shadow-sm">
            Convy
          </h1>
          <p className="text-xl md:text-2xl text-text-secondary max-w-lg mx-auto leading-relaxed">
            Fale inglês de verdade com IA
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 pt-6">
          <Link href="/demo" className="w-full sm:w-auto">
            <Button variant="primary" className="w-full sm:w-auto text-lg px-8 h-14 rounded-xl">
              Começar a falar agora (1 min)
            </Button>
          </Link>
          <Link
            href="/login"
            className="text-text-secondary hover:text-text-main transition-colors text-[15px] font-medium px-4 py-2 rounded-lg hover:bg-white/5 active:scale-95"
          >
            Já tenho conta — Entrar
          </Link>
        </div>
      </Card>

      {/* Floating Elements / Decoration (optional aesthetic touch) */}
      <div className="absolute bottom-10 text-text-secondary/50 text-sm font-medium tracking-widest uppercase">
        PRATIQUE E FALE COM CONFIANÇA
      </div>
    </main>
  );
}
