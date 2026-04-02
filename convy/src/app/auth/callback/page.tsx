"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const handleAuthCallback = async () => {
            try {
                if (typeof window !== "undefined") {
                    if (window.location.hash.includes('error=')) {
                        if (isMounted) setError("Ocorreu um erro na autenticação. O link pode ter expirado.");
                        setTimeout(() => router.push('/login'), 2000);
                        return;
                    }
                }

                // Requesting the session forces the Supabase client to parse and consume
                // any #access_token= or ?code= parameter currently in the URL.
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError || !session) {
                    if (isMounted) setError("Link de autenticação expirado ou inválido.");
                    setTimeout(() => router.push('/login'), 2000);
                    return;
                }

                // Auth successful, handle synchronization
                const user = session.user;

                // Identify if this is a password reset recovery link
                const isRecovery = typeof window !== "undefined" && window.location.hash.includes("type=recovery");

                if (isRecovery) {
                    router.push('/reset-password');
                    return;
                }

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
                            console.error("Erro ao sincronizar onboarding", e);
                        }
                    }
                }

                // Standard profile check
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('onboarding_completed')
                    .eq('id', user.id)
                    .single();

                if (!profile) {
                    await supabase.from('profiles').insert([{
                        id: user.id,
                        email: user.email,
                        onboarding_completed: false
                    }]);
                    router.push('/onboarding');
                } else if (profile.onboarding_completed) {
                    router.push('/home');
                } else {
                    router.push('/onboarding');
                }

            } catch (err) {
                console.error("Auth callback falhou:", err);
                if (isMounted) setError("Ocorreu um erro inesperado.");
                setTimeout(() => router.push('/login'), 2000);
            }
        };

        handleAuthCallback();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                handleAuthCallback();
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };

    }, [router]);

    return (
        <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
            <div className="flex flex-col items-center gap-4 text-center animate-in zoom-in duration-500">
                {error ? (
                    <>
                        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center text-3xl mb-2">
                            ⚠️
                        </div>
                        <h2 className="text-xl font-bold text-text-main">{error}</h2>
                        <p className="text-sm text-text-secondary">Redirecionando de volta ao login...</p>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                        <h2 className="text-2xl font-bold text-text-main animate-pulse">
                            Confirmando acesso...
                        </h2>
                        <p className="text-text-secondary">
                            Preparando seu ambiente seguro.
                        </p>
                    </>
                )}
            </div>
        </main>
    );
}
