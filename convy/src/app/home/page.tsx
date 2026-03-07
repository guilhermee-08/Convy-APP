"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";

type Situation = {
    id: string;
    title: string;
    description: string;
    level: string;
};

export default function Home() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [canPractice, setCanPractice] = useState(true);
    const [streak, setStreak] = useState(0);
    const [lastScore, setLastScore] = useState<number | null>(null);
    const [situations, setSituations] = useState<Situation[]>([]);

    const [recommendedSituation, setRecommendedSituation] = useState<Situation | null>(null);
    const [lastPracticedSituationTitle, setLastPracticedSituationTitle] = useState<string | null>(null);

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
                .select('created_at, score, situation_id')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });

            let lastPracticedSituationId: string | null = null;
            if (practices && practices.length > 0) {
                setLastScore(practices[0].score);
                lastPracticedSituationId = practices[0].situation_id;

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
                setStreak(calculatedStreak);
            }

            // 3. Fetch Situations List
            const { data: allSituations, error } = await supabase
                .from('situations')
                .select('*')
                .order('title', { ascending: true });

            if (!error && allSituations && allSituations.length > 0) {
                setSituations(allSituations);

                // 4. Recommendation Logic
                if (lastPracticedSituationId) {
                    const diffSituation = allSituations.find(s => s.id !== lastPracticedSituationId);
                    setRecommendedSituation(diffSituation || allSituations[0]);

                    const lastPracticed = allSituations.find(s => s.id === lastPracticedSituationId);
                    if (lastPracticed) {
                        setLastPracticedSituationTitle(lastPracticed.title);
                    }
                } else {
                    setRecommendedSituation(allSituations[0]);
                }
            }

            setIsLoading(false);
        };
        checkLimitAndHistory();
    }, [router]);

    return (
        <main className="min-h-screen bg-background flex flex-col items-center p-6 pt-12 relative overflow-hidden">
            <div className="w-full max-w-2xl space-y-8 relative z-10 animate-in fade-in zoom-in duration-500">
                <div className="text-center space-y-3 mb-8">
                    <h1 className="text-4xl font-extrabold tracking-tight text-text-main drop-shadow-sm">
                        Escolha uma conversa
                    </h1>
                    <p className="text-lg text-text-secondary leading-relaxed">
                        {!isLoading && !canPractice
                            ? "Você já completou sua prática gratuita de hoje."
                            : "Selecione um cenário para praticar:"}
                    </p>
                </div>

                {/* Section 1: Recommendation Section */}
                {!isLoading && recommendedSituation && (
                    <div className="space-y-4">
                        {/* Recommendation Card Header */}
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-text-main pl-2 border-l-4 border-primary">
                                Próxima recomendação
                            </h2>
                            {lastPracticedSituationTitle && (
                                <div className="pl-3 space-y-0.5">
                                    <h3 className="text-lg font-semibold text-primary">Continue praticando</h3>
                                    <p className="text-sm text-text-secondary">Você praticou: <span className="text-text-main">{lastPracticedSituationTitle}</span></p>
                                </div>
                            )}
                        </div>

                        <Card className="w-full p-6 border-primary/20 bg-primary/5 flex flex-col md:flex-row gap-6 md:items-center justify-between">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-xl text-text-main">{recommendedSituation.title}</h3>
                                    <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary whitespace-nowrap">
                                        {recommendedSituation.level}
                                    </span>
                                </div>
                                <p className="text-sm text-text-secondary line-clamp-2 pr-4">
                                    {recommendedSituation.description}
                                </p>
                            </div>
                            <div className={!canPractice ? "opacity-50 pointer-events-none shrink-0" : "shrink-0"}>
                                <Button
                                    variant="primary"
                                    className="w-full md:w-auto px-8 rounded-xl"
                                    onClick={() => router.push(`/practice?situation_id=${recommendedSituation.id}`)}
                                >
                                    Continuar
                                </Button>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Section 2: Outras conversas */}
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-text-main pl-2 border-l-4 border-primary">
                        Outras conversas
                    </h2>

                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[1, 2].map(i => (
                                <div key={i} className="h-40 w-full animate-pulse bg-card rounded-2xl border border-border"></div>
                            ))}
                        </div>
                    ) : situations.length === 0 ? (
                        <div className="w-full text-center p-8 bg-card/60 border border-white/5 rounded-2xl">
                            <p className="text-text-secondary text-lg">Nenhuma conversa encontrada.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {situations.map((scenario) => (
                                <div key={scenario.id} className={!canPractice ? "opacity-50 pointer-events-none" : ""}>
                                    <Link href={`/practice?situation_id=${scenario.id}`} className="block h-full">
                                        <Card className="h-full p-6 flex flex-col justify-between border-white/5 bg-card/60 hover:bg-card/80 transition-all hover:scale-[1.02] cursor-pointer">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <h3 className="font-bold text-lg text-text-main">{scenario.title}</h3>
                                                    <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary whitespace-nowrap">
                                                        {scenario.level}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-text-secondary line-clamp-2">
                                                    {scenario.description}
                                                </p>
                                            </div>
                                        </Card>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Section 3: Seu progresso */}
                <div className="space-y-4 pt-4">
                    <h2 className="text-2xl font-bold text-text-main pl-2 border-l-4 border-primary">
                        Seu progresso
                    </h2>

                    <Card className="w-full text-center p-8 space-y-6 border-white/5 bg-card/60">
                        {!isLoading && (
                            <div className="flex justify-center gap-8">
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

                        {!isLoading && !canPractice && (
                            <div className="pt-4 border-t border-border/50">
                                <Button
                                    variant="secondary"
                                    className="w-full text-lg h-12 rounded-xl border-primary text-primary hover:bg-primary/10"
                                    onClick={() => router.push("/paywall")}
                                >
                                    Desbloquear ilimitado
                                </Button>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </main>
    );
}
