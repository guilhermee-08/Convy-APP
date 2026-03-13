"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const BENEFITS = [
    "Conversas ilimitadas",
    "Correções inteligentes",
    "Treinar quantas vezes quiser",
    "Todas as situações desbloqueadas"
];

export default function Paywall() {
    const router = useRouter();
    const [xp, setXp] = useState(0);
    const [streak, setStreak] = useState(0);
    const [lastScore, setLastScore] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    useEffect(() => {
        const fetchProgress = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                router.push('/login');
                return;
            }

            // Fetch profile stats
            const { data: profile } = await supabase
                .from('profiles')
                .select('xp, practice_count_today, last_practice_date')
                .eq('id', session.user.id)
                .single();

            if (profile) {
                setXp(profile.xp || 0);
            }

            // Fetch practice history for score and streak
            const { data: practices } = await supabase
                .from('practice_sessions')
                .select('created_at, score')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });

            if (practices && practices.length > 0) {
                setLastScore(practices[0].score);

                // Streak calculation
                const datesArray = Array.from(new Set(practices.map(p => p.created_at.split('T')[0]))).sort((a, b) => b.localeCompare(a));
                const datesSet = new Set(datesArray);

                const todayObj = new Date();
                todayObj.setHours(0, 0, 0, 0);
                const todayStr = todayObj.toISOString().split("T")[0];

                const yesterdayObj = new Date(todayObj);
                yesterdayObj.setDate(yesterdayObj.getDate() - 1);
                const yesterdayStr = yesterdayObj.toISOString().split("T")[0];

                let currentStreak = 0;
                const checkDate = new Date(todayObj);

                if (datesSet.has(todayStr) || datesSet.has(yesterdayStr)) {
                    if (!datesSet.has(todayStr)) {
                        checkDate.setDate(checkDate.getDate() - 1);
                    }
                    while (datesSet.has(checkDate.toISOString().split("T")[0])) {
                        currentStreak++;
                        checkDate.setDate(checkDate.getDate() - 1);
                    }
                }
                setStreak(currentStreak);
            }

            setIsLoading(false);
        };

        fetchProgress();
    }, [router]);

    const handleCheckout = async () => {
        setIsCheckingOut(true);
        try {
            const res = await fetch("/api/checkout", { method: "POST" });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (error) {
            console.error("Error redirecting to checkout:", error);
            setIsCheckingOut(false);
        }
    };

    return (
        <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden py-12">
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-full max-w-lg space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* 1. Progress Reminder Card */}
                {!isLoading && (lastScore !== null || streak > 0) && (
                    <Card className="p-6 border-orange-500/30 bg-orange-500/5 text-center flex flex-col items-center shadow-lg relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-50 z-0"></div>
                        <div className="relative z-10 w-full space-y-4">
                            <h2 className="text-xl font-bold text-text-main flex items-center justify-center gap-2 tracking-tight">
                                🔥 Você já começou muito bem!
                            </h2>

                            <div className="w-[80%] mx-auto h-px bg-border/50"></div>

                            <div className="flex justify-around items-center w-full">
                                {lastScore !== null && (
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs text-text-secondary font-semibold uppercase tracking-wider mb-1">Score da última conversa</span>
                                        <span className="text-2xl font-black text-white">{lastScore}/10</span>
                                    </div>
                                )}

                                <div className="flex flex-col items-center">
                                    <span className="text-xs text-text-secondary font-semibold uppercase tracking-wider mb-1">XP ganhos</span>
                                    <span className="text-2xl font-black text-orange-400 drop-shadow-[0_0_10px_rgba(249,115,22,0.4)]">+{xp}</span>
                                </div>
                            </div>

                            {streak > 0 && (
                                <div className="mt-2 bg-background/50 border border-border/50 px-4 py-2 rounded-full inline-block">
                                    <span className="text-sm font-bold text-primary flex items-center gap-1.5">
                                        🔥 Streak iniciada ({streak} {streak === 1 ? 'dia' : 'dias'})
                                    </span>
                                </div>
                            )}
                        </div>
                    </Card>
                )}

                {/* 2. Main Premium Offer Card */}
                <Card className="text-center p-8 md:p-10 space-y-8 border-white/10 bg-card/80 backdrop-blur-md shadow-2xl">
                    <div className="space-y-4">
                        <div className="inline-block rounded-full px-4 py-1.5 text-sm text-yellow-500 font-bold bg-yellow-500/10 border border-yellow-500/20 mb-1 tracking-widest uppercase flex items-center gap-1.5 mx-auto w-fit">
                            <span>⭐</span> Convy Premium
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white drop-shadow-md leading-tight text-balance">
                            Continue praticando inglês com IA.
                        </h1>
                    </div>

                    <div className="flex flex-col gap-3 text-left w-full max-w-sm mx-auto bg-background/30 p-5 rounded-2xl border border-white/5">
                        {BENEFITS.map((benefit, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 border border-green-500/30">
                                    <span className="text-green-400 text-xs font-bold leading-none">✓</span>
                                </div>
                                <span className="text-text-main font-medium text-[15px]">{benefit}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col items-center justify-center py-2 relative">
                        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent top-0"></div>
                        <div className="pt-4">
                            <div className="flex items-baseline justify-center gap-1 text-white">
                                <span className="text-2xl font-bold text-text-secondary">R$</span>
                                <span className="text-5xl font-black tracking-tighter">29,90</span>
                                <span className="text-lg text-text-secondary font-medium">/ mês</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                        <Button
                            variant="primary"
                            className="w-full text-xl h-16 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] transition-all font-bold"
                            onClick={handleCheckout}
                            disabled={isCheckingOut}
                        >
                            {isCheckingOut ? "Carregando..." : "Desbloquear Premium"}
                        </Button>
                        <p className="text-sm font-medium text-text-secondary/80 pt-1 flex justify-center items-center gap-1">
                            <span className="opacity-70">🔒</span> Cancele quando quiser.
                        </p>
                    </div>
                </Card>
            </div>
        </main>
    );
}
