"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";

const playSuccessSound = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        const playNote = (freq: number, startTime: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
            gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + 0.5);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime + startTime);
            osc.stop(ctx.currentTime + startTime + 0.6);
        };

        // Play subtle positive chime: E5 -> G#5
        playNote(659.25, 0);
        playNote(830.61, 0.15);
    } catch (e) {
        // Ignore audio errors
    }
};

const ONBOARDING_STEPS = [
    {
        question: "Qual é o seu nível de inglês?",
        field: "level",
        options: [
            "Nunca estudei",
            "Sei algumas palavras",
            "Entendo um pouco",
            "Consigo conversar um pouco"
        ]
    },
    {
        question: "O que você mais quer melhorar?",
        field: "goal",
        options: [
            "Falar sem travar",
            "Pronúncia",
            "Conversação",
            "Inglês para viagens",
            "Inglês para trabalho"
        ]
    },
    {
        question: "Em qual situação você mais trava?",
        field: "main_situation",
        options: [
            "Pedir comida",
            "Falar com estrangeiros",
            "Viagens",
            "Small talk",
            "Trabalho"
        ]
    },
    {
        question: "Quanto tempo por dia você quer treinar?",
        field: "daily_time",
        options: [
            "2 minutos",
            "5 minutos",
            "10 minutos"
        ]
    }
];

export default function Onboarding() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Quick Practice states
    const [practiceState, setPracticeState] = useState<"onboarding" | "intro" | "question" | "success">("onboarding");
    const [practiceQuestion, setPracticeQuestion] = useState("");
    const [userAnswer, setUserAnswer] = useState("");
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [practiceScore, setPracticeScore] = useState<number>(0);

    const handleOptionSelect = async (option: string) => {
        const currentField = ONBOARDING_STEPS[currentStep].field;
        const newAnswers = { ...answers, [currentField]: option };
        setAnswers(newAnswers);

        if (currentStep < ONBOARDING_STEPS.length - 1) {
            setCurrentStep((prev) => prev + 1);
        } else {
            await finishOnboarding(newAnswers);
        }
    };

    const finishOnboarding = async (finalAnswers: Record<string, string>) => {
        setIsSubmitting(true);

        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
            const { error } = await supabase
                .from('profiles')
                .update({
                    level: finalAnswers.level,
                    goal: finalAnswers.goal,
                    main_situation: finalAnswers.main_situation,
                    daily_time: finalAnswers.daily_time,
                    onboarding_completed: true
                })
                .eq('id', session.user.id);

            if (!error) {
                // Determine practice question based on level
                let q = "Hello! What's your name?";
                if (finalAnswers.level === "Entendo um pouco") {
                    q = "Where are you from?";
                } else if (finalAnswers.level === "Consigo conversar um pouco") {
                    q = "What do you usually do in your free time?";
                }
                setPracticeQuestion(q);
                setPracticeState("intro");
            } else {
                console.error("Error saving onboarding data:", error);
                router.push('/home'); // Fallback route
            }
        } else {
            router.push('/login');
        }

        setIsSubmitting(false);
    };

    const handleStartPractice = () => {
        setPracticeState("question");
    };

    const handleSubmitPractice = async () => {
        if (!userAnswer.trim()) return;
        setIsEvaluating(true);

        try {
            // 1. Evaluate with AI
            const res = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: practiceQuestion,
                    userAnswer: userAnswer
                }),
            });
            const data = await res.json();

            let finalScore = 10; // Default if parsing fails for this quick practice
            if (data?.score) {
                const parsed = parseInt(data.score.split('/')[0]);
                if (!isNaN(parsed)) finalScore = parsed;
            }
            setPracticeScore(finalScore);

            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                // 2. Insert Practice Session
                await supabase.from("practice_sessions").insert({
                    user_id: session.user.id,
                    score: finalScore,
                    created_at: new Date().toISOString()
                });

                // 3. Update Profile (XP + Streak)
                const today = new Date().toISOString().split("T")[0];
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("xp, practice_count_today, last_practice_date")
                    .eq("id", session.user.id)
                    .single();

                if (profile) {
                    await supabase.from("profiles").update({
                        xp: (profile.xp || 0) + 10,
                        last_practice_date: today,
                        practice_count_today: profile.last_practice_date === today ? profile.practice_count_today + 1 : 1
                    }).eq("id", session.user.id);
                }
            }

            playSuccessSound();
            setPracticeState("success");
        } catch (error) {
            console.error(error);
            // Fallback to dashboard if error
            router.push('/home');
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleFinish = () => {
        router.push('/home');
    };

    const stepData = ONBOARDING_STEPS[currentStep];

    // Render Quick Practice Flows
    if (practiceState === "intro") {
        return (
            <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/5 blur-[100px] pointer-events-none"></div>
                <Card className="w-full max-w-md text-center p-10 space-y-8 relative z-10 border-white/5 bg-card/80 backdrop-blur-md animate-in zoom-in slide-in-from-bottom-4 duration-500">
                    <div className="text-6xl animate-bounce-slight">⚡</div>
                    <div className="space-y-4">
                        <h2 className="text-3xl font-extrabold tracking-tight text-text-main line-clamp-3">
                            Agora vamos fazer uma prática rápida.
                        </h2>
                        <p className="text-lg text-text-secondary font-medium">
                            Leva menos de 60 segundos.
                        </p>
                    </div>
                    <Button
                        variant="primary"
                        className="w-full text-lg h-14 rounded-xl mt-4 font-bold shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-all"
                        onClick={handleStartPractice}
                    >
                        Começar
                    </Button>
                </Card>
            </main>
        );
    }

    if (practiceState === "question") {
        return (
            <main className="min-h-screen bg-background flex flex-col items-center p-6 pt-12 md:pt-24 relative overflow-hidden">
                <div className="w-full max-w-2xl space-y-6 relative z-10 animate-in fade-in zoom-in duration-500">
                    <div className="flex bg-primary/10 w-fit px-4 py-1.5 rounded-full border border-primary/20 mx-auto mb-4">
                        <span className="text-primary font-bold text-sm tracking-wide uppercase">Primeira Prática</span>
                    </div>

                    <Card className="w-full p-6 space-y-6 border-white/5 bg-card/60 rounded-3xl">
                        {/* Question Bubble */}
                        <div className="flex flex-col items-start gap-2 max-w-[85%]">
                            <span className="text-sm font-semibold text-primary ml-2 tracking-wider">Tutor AI</span>
                            <div className="bg-card border border-white/10 p-5 rounded-2xl rounded-tl-sm text-text-main text-lg shadow-sm">
                                {practiceQuestion}
                            </div>
                        </div>

                        {/* User Answer Area */}
                        <div className="flex flex-col items-end gap-2 w-full pt-4">
                            <span className="text-sm font-semibold text-text-secondary mr-2 tracking-wider">Você</span>
                            <textarea
                                className="w-full bg-background/50 border border-white/10 rounded-2xl p-5 text-text-main min-h-[120px] focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all resize-none shadow-inner"
                                placeholder="Digite sua resposta em inglês..."
                                value={userAnswer}
                                onChange={(e) => setUserAnswer(e.target.value)}
                                disabled={isEvaluating}
                            />
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button
                                variant="primary"
                                className="px-8 py-6 rounded-xl font-bold text-lg shadow-[0_0_15px_rgba(99,102,241,0.2)] disabled:opacity-50"
                                onClick={handleSubmitPractice}
                                disabled={isEvaluating || !userAnswer.trim()}
                            >
                                {isEvaluating ? "Avaliando..." : "Enviar"}
                            </Button>
                        </div>
                    </Card>
                </div>
            </main>
        );
    }

    if (practiceState === "success") {
        return (
            <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
                {/* Subtle Confetti Background Effect */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary/20 rounded-full mix-blend-screen filter blur-[40px] animate-pulse"></div>
                    <div className="absolute top-1/3 right-1/4 w-40 h-40 bg-orange-500/20 rounded-full mix-blend-screen filter blur-[50px] animate-pulse delay-700"></div>
                </div>

                <div className="animate-in zoom-in slide-in-from-bottom-4 duration-500 fade-in flex flex-col items-center z-10 w-full max-w-sm">
                    <div className="bg-card/80 border border-white/10 p-10 rounded-[2rem] shadow-2xl flex flex-col items-center gap-6 animate-bounce-slight w-full text-center relative overflow-hidden backdrop-blur-xl">
                        <div className="text-7xl relative z-10 animate-bounce">🎉</div>

                        <div className="space-y-1 relative z-10">
                            <h2 className="text-3xl font-black text-text-main tracking-tight drop-shadow-sm">
                                Great start!
                            </h2>
                            <p className="text-text-secondary font-medium">Practice completed.</p>
                        </div>

                        <div className="w-full h-px bg-border/50 relative z-10 my-2"></div>

                        <div className="flex w-full justify-around items-center relative z-10">
                            {/* Score Display */}
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xs font-bold text-text-secondary uppercase tracking-widest text-center">Score</span>
                                <div className="flex items-center gap-1 text-text-main font-black text-3xl animate-in slide-in-from-bottom-2 fade-in duration-700 delay-200 fill-mode-both">
                                    {practiceScore}/10
                                </div>
                            </div>

                            <div className="w-px h-12 bg-border/50"></div>

                            {/* XP Display */}
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xs font-bold text-text-secondary uppercase tracking-widest text-center">XP</span>
                                <div className="flex items-center gap-1 text-orange-400 font-black text-3xl drop-shadow-[0_0_10px_rgba(249,115,22,0.4)] animate-in slide-in-from-bottom-2 fade-in duration-700 delay-400 fill-mode-both">
                                    +10
                                </div>
                            </div>
                        </div>

                        <div className="w-full bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center justify-center gap-2 animate-in slide-in-from-bottom-2 fade-in duration-700 delay-500 fill-mode-both relative z-10">
                            <span className="text-xl">🔥</span>
                            <span className="text-sm font-bold text-primary">Your streak has started.</span>
                        </div>

                        <Button
                            variant="primary"
                            className="w-full mt-2 rounded-xl h-14 font-bold text-lg relative z-10 shadow-[0_0_20px_rgba(99,102,241,0.25)]"
                            onClick={handleFinish}
                        >
                            Ir para o Dashboard
                        </Button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <Card className="w-full max-w-lg text-center p-10 space-y-8 relative z-10 border-white/5 bg-card/60">
                <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm font-medium text-text-secondary mb-2">
                        <span>Passo {currentStep + 1} de {ONBOARDING_STEPS.length}</span>
                        <div className="flex gap-1">
                            {ONBOARDING_STEPS.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-2 w-8 rounded-full transition-colors duration-300 ${idx <= currentStep ? 'bg-primary' : 'bg-border/50'}`}
                                />
                            ))}
                        </div>
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-text-main drop-shadow-sm leading-tight min-h-[5rem] flex items-center justify-center">
                        {stepData.question}
                    </h1>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                    {stepData.options.map((option) => (
                        <Button
                            key={option}
                            variant="secondary"
                            className="w-full text-lg min-h-14 py-3 h-auto rounded-xl text-left justify-start px-6 bg-background/50 border hover:border-primary/50 transition-all active:scale-[0.98] leading-tight"
                            onClick={() => handleOptionSelect(option)}
                            disabled={isSubmitting}
                        >
                            {option}
                        </Button>
                    ))}
                </div>

                {isSubmitting && (
                    <p className="text-primary animate-pulse text-sm mt-4 font-medium">Salvando seu perfil...</p>
                )}
            </Card>
        </main>
    );
}
