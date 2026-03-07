"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface SessionData {
    score: number;
    created_at: string;
    situation_id?: string | null;
    situations?: {
        title: string;
    } | { title: string }[] | null;
}

export default function Result() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isPremium, setIsPremium] = useState(false);

    // Result Metrics
    const [lastScore, setLastScore] = useState<number | null>(null);
    const [earnedXp, setEarnedXp] = useState(0);
    const [displayXp, setDisplayXp] = useState(0);
    const [isXpAnimating, setIsXpAnimating] = useState(false);
    const [streak, setStreak] = useState(0);
    const [situationTitle, setSituationTitle] = useState<string | null>(null);
    const [hasSession, setHasSession] = useState<boolean>(true); // assume true until checked

    const [practiceCountToday, setPracticeCountToday] = useState(0);

    useEffect(() => {
        const fetchResultData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                router.push("/login");
                return;
            }

            // Fetch profile for premium status and limit check
            const { data: profile } = await supabase
                .from("profiles")
                .select("is_premium, last_practice_date, practice_count_today, xp")
                .eq("id", session.user.id)
                .single();

            if (profile) {
                setIsPremium(profile.is_premium);
                const today = new Date().toISOString().split("T")[0];
                if (profile.last_practice_date === today) {
                    setPracticeCountToday(profile.practice_count_today);
                }
            }

            // Fetch the most recent practice sessions (no join to avoid FK errors)
            const { data: recentSessions, error } = await supabase
                .from("practice_sessions")
                .select("score, created_at, situation_id")
                .eq("user_id", session.user.id)
                .order("created_at", { ascending: false })
                .limit(1); // Fetch only the latest session

            if (!error && recentSessions && recentSessions.length > 0) {
                const latest = recentSessions[0] as SessionData;
                const score = latest.score;

                if (score === null || score === undefined) {
                    setHasSession(false);
                } else {
                    setHasSession(true);
                    setLastScore(score);

                    // Fetch Title separately if situation_id exists
                    if (latest.situation_id) {
                        const { data: situation } = await supabase
                            .from("situations")
                            .select("title")
                            .eq("id", latest.situation_id)
                            .single();

                        if (situation?.title) {
                            setSituationTitle(situation.title);
                        }
                    }

                    // Reverse Calculate XP earned based on our standard logic
                    let xp = 0;
                    if (score >= 9) xp = 20;
                    else if (score >= 7) xp = 15;
                    else if (score >= 5) xp = 10;
                    else xp = 5;
                    setEarnedXp(xp);

                    // Calculate Streak based on history (this part still needs all sessions)
                    // Re-fetch all sessions for streak calculation, as the above was limited to 1
                    const { data: allRecentSessions } = await supabase
                        .from("practice_sessions")
                        .select("created_at")
                        .eq("user_id", session.user.id)
                        .order("created_at", { ascending: false });

                    if (allRecentSessions) {
                        let currentStreak = 0;
                        const dates = new Set(allRecentSessions.map(p => p.created_at.split('T')[0]));
                        const todayStr = new Date().toISOString().split("T")[0];

                        let checkDate = new Date();
                        // If they haven't practiced today, but practiced yesterday, start checking from yesterday
                        if (!dates.has(todayStr)) {
                            checkDate.setDate(checkDate.getDate() - 1);
                        }

                        while (dates.has(checkDate.toISOString().split("T")[0])) {
                            currentStreak++;
                            checkDate.setDate(checkDate.getDate() - 1);
                        }
                        setStreak(Math.max(1, currentStreak)); // minimum 1 since they just finished a practice to be here
                    }
                }
            } else {
                setHasSession(false);
            }

            setIsLoading(false);
        };

        fetchResultData();
    }, [router]);

    // Handle Redirect if no valid session data is found
    useEffect(() => {
        if (!isLoading && !hasSession) {
            router.push('/home');
        }
    }, [isLoading, hasSession, router]);

    // XP Counter Animation
    useEffect(() => {
        if (!isLoading && earnedXp > 0) {
            setIsXpAnimating(true);
            const duration = 1000; // 1 second
            const steps = 20; // 50ms per step
            const stepTime = duration / steps;
            const xpIncrement = earnedXp / steps;

            let currentXp = 0;
            const timer = setInterval(() => {
                currentXp += xpIncrement;
                if (currentXp >= earnedXp) {
                    setDisplayXp(earnedXp);
                    setIsXpAnimating(false);
                    clearInterval(timer);
                } else {
                    setDisplayXp(Math.floor(currentXp));
                }
            }, stepTime);

            return () => clearInterval(timer);
        }
    }, [isLoading, earnedXp]);

    // Motivational Message logic
    const getMotivationalMessage = (score: number | null) => {
        if (score === null) return "Bom trabalho! A prática leva à perfeição.";
        if (score >= 9) return "Incrível! Sua resposta soou muito natural.";
        if (score >= 7) return "Ótimo trabalho! Você está ficando mais fluente.";
        if (score >= 5) return "Boa tentativa! Pequenos ajustes vão melhorar sua resposta.";
        return "Bom esforço! Continue praticando e você vai evoluir rápido.";
    };

    if (isLoading) {
        return (
            <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative">
                <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </main>
        );
    }

    const showPremiumUpsell = !isPremium && practiceCountToday >= 1;

    return (
        <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="w-full max-w-md animate-in fade-in zoom-in slide-in-from-bottom-4 duration-500">
                <Card className="text-center p-8 space-y-6 border-white/5 bg-card/60 relative z-10 shadow-2xl">
                    <div className="space-y-2">
                        <div className="text-6xl mb-4 animate-bounce-slight">🎉</div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-text-main drop-shadow-sm">
                            Resultado da conversa
                        </h1>
                        {situationTitle && (
                            <p className="text-primary font-medium tracking-wide relative inline-block">
                                {situationTitle}
                                <span className="absolute -bottom-1 left-1/4 right-1/4 h-px bg-primary/30"></span>
                            </p>
                        )}
                    </div>

                    {/* Primary Score Loop */}
                    <div className="py-6 px-4 bg-primary/5 border border-primary/20 rounded-3xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                        <div className="flex flex-col gap-1 items-center relative z-10">
                            <span className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1">Nota Final</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-6xl font-black text-primary drop-shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                                    {lastScore !== null ? lastScore : '-'}
                                </span>
                                <span className="text-2xl text-text-secondary font-medium">/10</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-card border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 shadow-sm relative overflow-hidden">
                            {isXpAnimating && (
                                <div className="absolute inset-0 bg-orange-500/10 animate-pulse transition-opacity duration-300"></div>
                            )}
                            <span className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1 relative z-10">XP Ganho</span>
                            <div className={`flex items-center gap-1.5 relative z-10 transition-all duration-300 ${isXpAnimating
                                ? "text-orange-300 scale-110 drop-shadow-[0_0_20px_rgba(253,186,116,0.8)]"
                                : "text-orange-400 drop-shadow-[0_0_10px_rgba(249,115,22,0.3)]"
                                }`}>
                                <span className="text-2xl font-black">+{displayXp}</span>
                                <span className="text-sm font-bold">XP</span>
                            </div>
                        </div>
                        <div className="bg-card border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 shadow-sm">
                            <span className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1">Streak</span>
                            <div className="flex items-center gap-1.5 text-text-main">
                                <span className="text-2xl font-black">{streak}</span>
                                <span className="text-lg">🔥</span>
                            </div>
                        </div>
                    </div>

                    <p className="text-[15px] font-medium text-text-secondary leading-relaxed px-4 pt-2">
                        {getMotivationalMessage(lastScore)}
                    </p>

                    <div className="flex flex-col gap-3 pt-6 pb-2 border-t border-border/50">
                        {showPremiumUpsell ? (
                            <>
                                <Button
                                    variant="secondary"
                                    onClick={() => router.push('/home')}
                                    className="w-full text-text-main border-white/10 bg-white/5 hover:bg-white/10 h-14 rounded-xl font-semibold"
                                >
                                    Voltar ao dashboard
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={() => router.push('/paywall')}
                                    className="w-full text-lg h-14 rounded-xl bg-gradient-to-r from-primary to-indigo-500 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all border-none font-bold mt-2"
                                >
                                    Desbloquear ilimitado 🔓
                                </Button>
                            </>
                        ) : (
                            <Button
                                variant="primary"
                                onClick={() => router.push('/home')}
                                className="w-full text-lg h-14 rounded-xl shadow-lg font-bold"
                            >
                                Voltar ao dashboard
                            </Button>
                        )}
                    </div>
                </Card>
            </div>
        </main>
    );
}
