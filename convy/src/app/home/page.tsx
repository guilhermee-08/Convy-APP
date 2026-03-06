"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";

export default function Home() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [canPractice, setCanPractice] = useState(true);
    const [streak, setStreak] = useState(0);
    const [lastScore, setLastScore] = useState<number | null>(null);

    useEffect(() => {
        const checkLimitAndHistory = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                router.push("/login");
                return;
            }

            // 1. Check Profile for Practice Limits
            const { data: profile } = await supabase
                .from("profiles")
                .select("is_premium, last_practice_date, practice_count_today")
                .eq("id", session.user.id)
                .single();

            if (profile) {
                if (!profile.is_premium) {
                    const today = new Date().toISOString().split("T")[0];
                    if (profile.last_practice_date === today && profile.practice_count_today >= 1) {
                        setCanPractice(false);
                    }
                }
            }

            // 2. Fetch Practice History for Streak & Last Score
            const { data: practices } = await supabase
                .from('practice_sessions')
                .select('created_at, score')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });

            if (practices && practices.length > 0) {
                console.log("latest practice session", practices[0]);
                setLastScore(practices[0].score);

                const dates = new Set(practices.map(p => p.created_at.split('T')[0]));
                const today = new Date();
                const todayStr = today.toISOString().split("T")[0];
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split("T")[0];

                let calculatedStreak = 0;
                if (dates.has(todayStr)) {
                    if (dates.has(yesterdayStr)) {
                        calculatedStreak = 2;
                    } else {
                        calculatedStreak = 1;
                    }
                }
                console.log("calculated streak", calculatedStreak);
                setStreak(calculatedStreak);
            }

            setIsLoading(false);
        };
        checkLimitAndHistory();
    }, [router]);

    return (
        <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <Card className="w-full max-w-xl text-center p-10 space-y-8 relative z-10 border-white/5 bg-card/60 animate-in fade-in zoom-in duration-500">
                <div className="space-y-3">
                    <h1 className="text-4xl font-extrabold tracking-tight text-text-main drop-shadow-sm">
                        Prática de hoje
                    </h1>
                    <p className="text-lg text-text-secondary leading-relaxed">
                        {!isLoading && !canPractice
                            ? "Você já completou sua prática gratuita de hoje."
                            : "Inicie sua conversa em inglês."}
                    </p>
                </div>

                {!isLoading && (
                    <div className="flex justify-center gap-8 py-4 border-y border-border/50">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-text-secondary uppercase tracking-wider">Streak atual</p>
                            <p className="text-2xl font-bold text-primary flex items-center justify-center gap-2">
                                🔥 {streak} <span className="text-lg font-normal text-text-secondary">dias</span>
                            </p>
                        </div>
                        <div className="w-px bg-border/50"></div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-text-secondary uppercase tracking-wider">Última nota</p>
                            <p className="text-2xl font-bold text-text-main">
                                {lastScore !== null ? `${lastScore}/10` : '-'}
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-4 pt-2">
                    {isLoading ? (
                        <div className="h-12 w-full animate-pulse bg-card rounded-xl border border-border"></div>
                    ) : canPractice ? (
                        <Button
                            variant="primary"
                            className="w-full text-lg h-12 rounded-xl"
                            onClick={() => router.push("/practice")}
                        >
                            Iniciar prática
                        </Button>
                    ) : (
                        <Button
                            variant="secondary"
                            className="w-full text-lg h-12 rounded-xl border-primary text-primary hover:bg-primary/10"
                            onClick={() => router.push("/paywall")}
                        >
                            Desbloquear ilimitado
                        </Button>
                    )}
                </div>
            </Card>
        </main>
    );
}
