"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const ONBOARDING_STEPS = [
    {
        title: "Você trava na hora de falar inglês?",
        field: "emotional",
        options: [
            "Sim 😐",
            "Às vezes 😕",
            "Muito 😩"
        ]
    },
    {
        title: "Onde você mais precisa falar inglês?",
        field: "main_situation",
        options: [
            "Falar em conversas reais",
            "Entender quando falam rápido",
            "Formar frases",
            "Pronúncia"
        ]
    },
    {
        title: "Quanto tempo por dia você pode praticar?",
        field: "practice_time",
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
        if (typeof window !== "undefined") {
            localStorage.setItem("pendingOnboarding", JSON.stringify(finalAnswers));
        }
        
        // Mock loading state before demo
        setTimeout(() => {
            router.push('/demo');
        }, 1500);
    };

    if (isSubmitting) {
        return (
            <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden fade-in">
                <Card className="w-full max-w-md text-center p-12 space-y-6 relative z-10">
                    <div className="flex flex-col items-center gap-6">
                        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(147,51,234,0.5)]"></div>
                        <h2 className="text-xl font-semibold text-white leading-snug animate-pulse">
                            Criando uma situação real para você praticar...
                        </h2>
                    </div>
                </Card>
            </main>
        );
    }

    const stepData = ONBOARDING_STEPS[currentStep];

    return (
        <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden animate-in fade-in duration-500">
            <Card className="w-full max-w-xl text-center p-8 md:p-12 space-y-10 relative z-10">
                <div className="space-y-6">
                    <div className="flex justify-between items-center text-sm font-medium text-text-secondary mb-4 px-1">
                        <span className="uppercase tracking-widest text-xs">Passo {currentStep + 1} de {ONBOARDING_STEPS.length}</span>
                        <div className="flex gap-2">
                            {ONBOARDING_STEPS.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-2 w-8 rounded-full transition-colors duration-500 ${idx <= currentStep ? 'bg-primary shadow-[0_0_8px_rgba(147,51,234,0.5)]' : 'bg-white/10'}`}
                                />
                            ))}
                        </div>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white drop-shadow-sm min-h-[5rem] flex items-center justify-center">
                        {stepData.title}
                    </h1>
                </div>

                <div className="flex flex-col gap-4 pt-2">
                    {stepData.options.map((option) => {
                        let icon = null;
                        if (option.includes("Sim")) icon = "😐";
                        if (option.includes("Às vezes")) icon = "😕";
                        if (option.includes("Muito")) icon = "😩";
                        if (option.includes("conversas reais")) icon = "💬";
                        if (option.includes("quando falam rápido")) icon = "👂";
                        if (option.includes("Formar frases")) icon = "✍️";
                        if (option.includes("Pronúncia")) icon = "🗣️";
                        if (option.includes("2 minutos")) icon = "⚡";
                        if (option.includes("5 minutos")) icon = "⏱️";
                        if (option.includes("10 minutos")) icon = "🔥";
                        
                        return (
                            <button
                                key={option}
                                className="group relative flex items-center justify-between w-full text-base font-medium py-4 px-5 rounded-2xl bg-card border border-white/5 hover:border-primary/50 hover:bg-white/5 transition-all text-text-main disabled:opacity-50"
                                onClick={() => handleOptionSelect(option)}
                                disabled={isSubmitting}
                            >
                                <div className="flex items-center gap-4 text-left">
                                    {icon && (
                                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 shrink-0 text-xl group-hover:bg-primary/20 transition-colors">
                                            {icon}
                                        </div>
                                    )}
                                    <span className="flex-1">{option.replace(/[😐😕😩]/g, '').trim()}</span>
                                </div>
                                <div className="w-6 h-6 rounded border border-white/20 flex items-center justify-center bg-transparent group-hover:bg-primary group-hover:border-primary transition-all ml-4">
                                    <svg className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </Card>
        </main>
    );
}
