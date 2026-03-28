"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";

export default function Login() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isFromOnboarding, setIsFromOnboarding] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (typeof window !== "undefined") {
            // Intercept magic link payloads returning to the old allowed URL, and forward them to our robust callback:
            if (window.location.hash.includes("access_token")) {
                router.push("/auth/callback" + window.location.hash);
                return;
            }

            const params = new URLSearchParams(window.location.search);
            if (params.get("from") === "onboarding") {
                setIsFromOnboarding(true);
            }
        }
    }, [router]);

    const handleMagicLinkLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                // Reverted to /login because Supabase dashboard security settings reject unrecognized Redirect URLs
                emailRedirectTo: `${window.location.origin}/login`,
            },
        });

        if (error) {
            setMessage({ type: 'error', text: "Ocorreu um erro ao enviar o link. Tente novamente." });
        } else {
            setMessage({ type: 'success', text: "Verifique seu e-mail para entrar no Convy." });
        }

        setIsLoading(false);
    };

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user) {
                const user = session.user;

                // Sync onboarding data if exists
                if (typeof window !== "undefined") {
                    const pendingOnboardingStr = localStorage.getItem('pendingOnboarding');
                    if (pendingOnboardingStr) {
                        try {
                            const answers = JSON.parse(pendingOnboardingStr);
                            await supabase.from('profiles').upsert({
                                id: user.id,
                                email: user.email,
                                level: answers.level,
                                main_situation: answers.main_situation,
                                onboarding_completed: true
                            });
                            localStorage.removeItem('pendingOnboarding');
                            router.push('/home');
                            return;
                        } catch (e) {
                            console.error("Erro ao salvar onboarding", e);
                        }
                    }
                }

                // Check if profile exists
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('onboarding_completed')
                    .eq('id', user.id)
                    .single();

                if (profileError || !profile) {
                    // Create profile if it doesn't exist
                    const { error: insertError } = await supabase
                        .from('profiles')
                        .insert([
                            {
                                id: user.id,
                                email: user.email,
                                onboarding_completed: false
                            }
                        ]);

                    if (!insertError) {
                        router.push('/onboarding');
                    }
                } else {
                    // Profile exists, check onboarding status
                    if (profile.onboarding_completed) {
                        router.push('/home');
                    } else {
                        router.push('/onboarding');
                    }
                }
            }
        };

        checkUser();

        // Listen for auth state changes (e.g., when the magic link is clicked)
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                checkUser();
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [router]);

    return (
        <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-1/4 max-md:hidden left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
            <Card className="w-full max-w-md text-center p-10 space-y-8 relative z-10 border-white/5 bg-card/60">
                <div className="space-y-3">
                    <h1 className="text-4xl font-extrabold tracking-tight text-text-main drop-shadow-sm">
                        {isFromOnboarding ? "Conta" : "Entrar"}
                    </h1>
                    <p className="text-lg text-text-secondary leading-relaxed">
                        {isFromOnboarding ? "Crie sua conta para continuar praticando" : "Acesse sua conta para continuar praticando inglês."}
                    </p>
                </div>

                <form onSubmit={handleMagicLinkLogin} className="flex flex-col gap-4 pt-4">
                    <div className="space-y-2 text-left">
                        <Input
                            type="email"
                            placeholder="Seu e-mail"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        className="w-full text-lg h-12 rounded-xl"
                        disabled={isLoading}
                    >
                        {isLoading ? "Enviando..." : "Entrar com link mágico"}
                    </Button>

                    {message && (
                        <p className={`text-sm mt-2 font-medium ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                            {message.text}
                        </p>
                    )}
                </form>
            </Card>
        </main>
    );
}
