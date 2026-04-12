"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { ensureProfileExists } from "@/lib/profile";

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
    const [bestStreak, setBestStreak] = useState(0);
    const [lastScore, setLastScore] = useState<number | null>(null);
    const [situations, setSituations] = useState<Situation[]>([]);
    const [isPremium, setIsPremium] = useState(false);

    // XP and Leveling
    const [xp, setXp] = useState(0);
    const [level, setLevel] = useState(1);

    const [recommendedSituation, setRecommendedSituation] = useState<Situation | null>(null);
    const [lastPracticedSituationTitle, setLastPracticedSituationTitle] = useState<string | null>(null);
    const [dailyChallenge, setDailyChallenge] = useState<Situation | null>(null);

    // Add local state tracker for the button condition
    const [profilePracticeCountToday, setProfilePracticeCountToday] = useState(0);

    useEffect(() => {
        const checkLimitAndHistory = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                router.push("/login");
                return;
            }

            await ensureProfileExists(session.user);

            // 1. Check Profile for Practice Limits and fetch XP
            const { data: profile } = await supabase
                .from("profiles")
                .select("is_premium, last_practice_date, practice_count_today, xp")
                .eq("id", session.user.id)
                .single();

            if (profile) {
                const currentXp = profile.xp || 0;
                setXp(currentXp);
                setLevel(Math.floor(currentXp / 50) + 1);

                const today = new Date().toISOString().split("T")[0];
                const countToday = profile.last_practice_date === today ? profile.practice_count_today : 0;
                setProfilePracticeCountToday(countToday);
                setIsPremium(profile.is_premium);

                if (!profile.is_premium) {
                    if (countToday >= 2) {
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

                // Ensure local timezone dates are used instead of UTC string split
                const datesArray = Array.from(new Set(practices.map(p => {
                    const localDate = new Date(p.created_at);
                    localDate.setHours(0, 0, 0, 0);
                    // Avoid timezone shift formatting by doing manual local YYYY-MM-DD
                    const year = localDate.getFullYear();
                    const month = String(localDate.getMonth() + 1).padStart(2, '0');
                    const day = String(localDate.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }))).sort((a, b) => b.localeCompare(a)); // chronological descending

                const todayObj = new Date();
                todayObj.setHours(0, 0, 0, 0);

                // Calculate Best Streak and Current Streak from history
                let maxStreak = 0;
                let currentRun = 0;
                let lastDateInRun: Date | null = null;

                // Array is sorted newest to oldest. We iterate oldest to newest by reversing or just traversing from end.
                for (let i = datesArray.length - 1; i >= 0; i--) {
                    const d = new Date(datesArray[i] + 'T00:00:00');
                    if (!lastDateInRun) {
                        currentRun = 1;
                    } else {
                        const diffDays = Math.round(Math.abs(d.getTime() - lastDateInRun.getTime()) / (1000 * 3600 * 24));
                        if (diffDays === 1) {
                            currentRun++;
                        } else if (diffDays > 1) {
                            currentRun = 1;
                        }
                    }
                    if (currentRun > maxStreak) maxStreak = currentRun;
                    lastDateInRun = d;
                }

                // If user missed practicing yesterday and today, current streak resets to 0 visually
                let finalCurrentStreak = currentRun;
                if (lastDateInRun) {
                    const diffFromToday = Math.round(Math.abs(todayObj.getTime() - lastDateInRun.getTime()) / (1000 * 3600 * 24));
                    if (diffFromToday > 1) {
                        finalCurrentStreak = 0;
                    }
                }

                setStreak(finalCurrentStreak);
                setBestStreak(maxStreak);
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

                // 5. Daily Challenge Logic
                const today = new Date();
                const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
                const dailyIndex = dayOfYear % allSituations.length;
                setDailyChallenge(allSituations[dailyIndex]);
            }

            setIsLoading(false);
        };
        checkLimitAndHistory();
    }, [router]);

    return (
        <main className="min-h-screen bg-background flex flex-col items-center p-6 pt-12 relative overflow-hidden">
            <div className="w-full max-w-2xl space-y-8 relative z-10 animate-in fade-in zoom-in duration-500">
                <div className="text-center space-y-3 mb-6 relative">
                    <button
                        onClick={() => router.push('/account')}
                        className="absolute right-0 top-0 z-20 p-2 rounded-xl text-text-secondary hover:text-text-main hover:bg-card/60 transition-colors"
                        title="Conta"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                        </svg>
                    </button>
                    <h1 className="text-4xl font-black tracking-tight text-white">
                        Dashboard
                    </h1>
                    <p className="text-[16px] font-medium text-text-secondary leading-relaxed max-w-sm mx-auto">
                        {!isLoading && !canPractice
                            ? "Você já completou sua prática gratuita de hoje."
                            : "Acompanhe seu progresso e continue praticando:"}
                    </p>
                </div>

                {/* Account Status Badge */}
                {!isLoading && (
                    <div className="flex justify-center -mt-2 mb-6 relative z-10 w-full animate-in fade-in zoom-in duration-500 delay-100 fill-mode-both">
                        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border backdrop-blur-sm shadow-sm transition-all ${isPremium
                            ? 'bg-orange-500/10 border-orange-500/20'
                            : 'bg-card/60 border-white/5'
                            }`}>
                            {isPremium ? (
                                <>
                                    <div className="p-1.5 bg-orange-500/20 rounded-xl flex items-center justify-center text-orange-400">
                                        <span className="text-lg">🔥</span>
                                    </div>
                                    <div className="text-left">
                                        <div className="text-sm font-black text-text-main tracking-tight leading-tight">Premium ativo</div>
                                        <div className="text-xs font-semibold text-orange-400">Conversas ilimitadas</div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="p-1.5 bg-card border border-border/50 rounded-xl flex items-center justify-center grayscale opacity-80">
                                        <span className="text-lg">🌱</span>
                                    </div>
                                    <div className="text-left">
                                        <div className="text-sm font-bold text-text-main tracking-tight leading-tight">Plano Free</div>
                                        <div className="text-xs font-medium text-text-secondary">3 conversas por dia</div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Daily Mission Progress Indicator */}
                <Card className="w-full relative group">
                    <div className="flex flex-col gap-5 relative z-10">
                        {/* Header & Rewards */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                            <div className="space-y-1">
                                <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                                    Missão do dia
                                </h3>
                                <p className="text-xs text-text-secondary">
                                    Complete 2 conversas
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-background/50 rounded-lg text-xs font-semibold text-text-secondary border border-border/50 shadow-sm">
                                    <span className="text-sm">⏱</span> 60 segundos
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 rounded-lg text-xs font-bold text-orange-400 border border-orange-500/20 shadow-sm">
                                    +20 XP
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar Area */}
                        <div className="space-y-2 pt-2 border-t border-white/5">
                            <div className="flex justify-between items-end">
                                <p className="text-sm font-medium text-text-secondary">
                                    <span className={profilePracticeCountToday >= 2 ? "text-primary font-bold text-base" : "text-text-main font-bold text-base"}>
                                        {Math.min(profilePracticeCountToday, 2)}
                                    </span>
                                    {' '}/ 2 conversas concluídas
                                </p>
                                {profilePracticeCountToday >= 2 && (
                                    <span className="text-xs font-bold text-green-400 animate-pulse">
                                        Concluída ✅
                                    </span>
                                )}
                            </div>
                            <div className="w-full h-3 bg-background/50 border border-border/50 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-1000 ease-out rounded-full ${profilePracticeCountToday >= 2
                                        ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                                        : "bg-primary"
                                        }`}
                                    style={{ width: `${Math.min((profilePracticeCountToday / 2) * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Section 2: Daily Challenge */}
                <div className="space-y-4 pt-4">
                    <h2 className="text-xl font-semibold text-text-main">
                        Desafio de hoje
                    </h2>

                    {!isLoading && dailyChallenge && (
                        <Card className="w-full relative overflow-hidden group">
                            <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-center justify-between">
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-bold text-xl text-text-main">{dailyChallenge.title}</h3>
                                        <span className="text-xs px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 font-bold tracking-wide whitespace-nowrap">
                                            +20 XP
                                        </span>
                                    </div>
                                    <p className="text-sm text-text-secondary line-clamp-2 pr-4">{dailyChallenge.description}</p>
                                </div>

                                <div className="shrink-0 pt-2 md:pt-0">
                                    {(!canPractice || profilePracticeCountToday >= 2) ? (
                                        <div className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-medium text-center">
                                            Concluído ✅
                                        </div>
                                    ) : (
                                        <Button
                                            variant="secondary"
                                            className="w-full md:w-auto px-6 py-3 rounded-xl font-semibold text-sm"
                                            onClick={() => router.push(`/practice?situation_id=${dailyChallenge.id}`)}
                                        >
                                            Começar desafio
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    )}
                </div>

                {/* Section 1: Seu progresso */}
                <div className="space-y-4 pt-6">
                    <Card className="w-full text-center space-y-6">
                        {!isLoading && (
                            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                                <div className="w-full md:w-auto flex flex-col items-center">
                                    <p className="text-2xl font-bold text-primary tracking-tight">
                                        Level {level} <span className="text-xl">⭐</span>
                                    </p>
                                    <p className="text-sm font-medium text-text-secondary mt-1 mb-3">
                                        {level === 1 ? 'English Beginner' :
                                            level === 2 ? 'English Explorer' :
                                                level === 3 ? 'Conversation Starter' :
                                                    level === 4 ? 'Fluent Builder' :
                                                        'Confident Speaker'}
                                    </p>
                                    <div className="w-full max-w-[200px] mx-auto space-y-2">
                                        <div className="h-2 w-full bg-background border border-border/50 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
                                                style={{ width: `${((xp % 50) / 50) * 100}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-text-secondary font-medium tracking-wide">
                                            {xp % 50} / 50 XP
                                        </p>
                                    </div>
                                </div>
                                <div className="hidden md:block w-px h-24 bg-border/50"></div>
                                <div className="w-full md:hidden h-px bg-border/50 my-2"></div>
                                <div className="flex justify-center gap-8 w-full md:w-auto">
                                    <div className="space-y-2 flex flex-col items-center justify-center p-4 border border-white/5 rounded-2xl bg-[#1A1F2B] w-full md:w-auto min-w-[200px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
                                        <p className="text-xs font-semibold text-text-secondary uppercase tracking-widest">Streak atual</p>
                                        <p className="text-4xl font-bold text-white flex items-center justify-center gap-2">
                                            🔥 {streak} <span className="text-lg font-medium text-text-secondary tracking-normal">dias</span>
                                        </p>

                                        <div className="mt-2 flex flex-col items-center gap-2">
                                            <p className="text-xs text-text-secondary/80 font-medium italic text-center max-w-[180px]">
                                                &quot;Treine hoje para não perder sua sequência.&quot;
                                            </p>

                                            <div className="w-[80%] h-px bg-border/50 my-1"></div>

                                            <div className="flex flex-col items-center">
                                                <span className="text-xs font-bold text-text-main">
                                                    Seu recorde: <span className="text-orange-400">{bestStreak}</span> dias
                                                </span>

                                                {streak > 0 && bestStreak > 0 && (bestStreak - streak) === 1 && (
                                                    <span className="text-[10px] text-primary font-bold animate-pulse mt-1 text-center">
                                                        Você está a 1 dia de bater seu recorde.
                                                    </span>
                                                )}
                                                {streak > 0 && streak === bestStreak && bestStreak > 1 && (
                                                    <span className="text-[10px] text-green-400 font-bold mt-1 text-center flex items-center gap-1">
                                                        🌟 Novo recorde!
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-px bg-border/50"></div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-text-secondary uppercase tracking-wider">Última nota</p>
                                        <p className="text-2xl font-bold text-text-main">
                                            {lastScore !== null ? `${lastScore}/10` : '-'}
                                        </p>
                                    </div>
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

                <div className="space-y-4 pt-6">
                    <h2 className="text-xl font-bold tracking-tight text-white">
                        Escolha uma conversa
                    </h2>

                    {/* Recommendation Card */}
                    {!isLoading && recommendedSituation && (
                        <div className="space-y-4 pb-4">
                            {lastPracticedSituationTitle && (
                                <div className="pl-3 space-y-0.5">
                                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Próxima recomendação</h3>
                                    <p className="text-sm text-text-secondary">Baseada na sua última prática: <span className="text-text-main">{lastPracticedSituationTitle}</span></p>
                                </div>
                            )}

                            <Card className="w-full border-t-primary/20 flex flex-col md:flex-row gap-6 md:items-center justify-between relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
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

                    <div className="space-y-4 pt-4">
                        <h2 className="text-xl font-bold tracking-tight text-white">
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
                                            <Card className="h-full flex flex-col justify-between hover:border-text-secondary/20 transition-all hover:-translate-y-1 cursor-pointer">
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
                </div>
            </div>
        </main>
    );
}
