"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Account() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isPremium, setIsPremium] = useState(false);
    const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [isPortalLoading, setIsPortalLoading] = useState(false);
    const [portalError, setPortalError] = useState<string | null>(null);

    useEffect(() => {
        const loadAccount = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                router.push("/login");
                return;
            }

            setUserEmail(session.user.email || null);

            const { data: profile } = await supabase
                .from("profiles")
                .select("is_premium, subscription_status")
                .eq("id", session.user.id)
                .single();

            if (profile) {
                setIsPremium(profile.is_premium);
                setSubscriptionStatus(profile.subscription_status);
            }

            setIsLoading(false);
        };
        loadAccount();
    }, [router]);

    const handleManageSubscription = async () => {
        setIsPortalLoading(true);
        setPortalError(null);
        try {
            const res = await fetch("/api/stripe/portal", { method: "POST" });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                setPortalError(data.error || "Erro ao abrir portal.");
                setIsPortalLoading(false);
            }
        } catch {
            setPortalError("Erro de conexão. Tente novamente.");
            setIsPortalLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    if (isLoading) {
        return (
            <main className="min-h-screen bg-background flex items-center justify-center p-6">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-background flex flex-col items-center p-6 pt-10 relative">
            <div className="w-full max-w-md space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <button
                        onClick={() => router.push("/home")}
                        className="text-text-secondary hover:text-text-main transition-colors text-sm font-medium flex items-center gap-1"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        Voltar
                    </button>
                    <h1 className="text-lg font-bold text-text-main">Conta</h1>
                    <div className="w-14"></div>
                </div>

                {/* Email */}
                <div className="bg-card/60 border border-white/5 rounded-xl px-4 py-3">
                    <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Email</div>
                    <div className="text-sm font-medium text-text-main truncate">{userEmail}</div>
                </div>

                {/* Plan Status */}
                <div className={`rounded-xl px-4 py-4 border ${isPremium
                    ? 'bg-orange-500/5 border-orange-500/20'
                    : 'bg-card/60 border-white/5'
                    }`}>
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{isPremium ? '🔥' : '🌱'}</span>
                        <div>
                            <div className="text-sm font-bold text-text-main">
                                {isPremium ? 'Premium ativo' : 'Plano Free'}
                            </div>
                            <div className={`text-xs font-medium ${isPremium ? 'text-orange-400' : 'text-text-secondary'}`}>
                                {isPremium ? 'Conversas ilimitadas' : '3 conversas por dia'}
                            </div>
                        </div>
                        {isPremium && subscriptionStatus && (
                            <div className="ml-auto flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                                <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">
                                    {subscriptionStatus === 'active' ? 'Ativa' :
                                        subscriptionStatus === 'trialing' ? 'Teste' :
                                            subscriptionStatus === 'canceled' ? 'Cancelada' : subscriptionStatus}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    {isPremium && (
                        <button
                            className="w-full flex items-center justify-between px-4 py-3 bg-card/60 border border-white/5 rounded-xl text-sm font-medium text-text-main hover:bg-card/80 transition-colors disabled:opacity-50"
                            onClick={handleManageSubscription}
                            disabled={isPortalLoading}
                        >
                            <span>{isPortalLoading ? 'Abrindo portal...' : 'Gerenciar assinatura'}</span>
                            {isPortalLoading ? (
                                <div className="w-4 h-4 border-2 border-text-secondary/30 border-t-text-main rounded-full animate-spin"></div>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            )}
                        </button>
                    )}

                    {portalError && (
                        <div className="text-xs text-red-400 text-center px-2">{portalError}</div>
                    )}

                    {!isPremium && (
                        <button
                            className="w-full flex items-center justify-between px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl text-sm font-bold text-primary hover:bg-primary/20 transition-colors"
                            onClick={() => router.push("/paywall")}
                        >
                            <span>Desbloquear Premium</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </button>
                    )}

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center px-4 py-3 rounded-xl text-sm font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                    >
                        Sair da conta
                    </button>
                </div>
            </div>
        </main>
    );
}
