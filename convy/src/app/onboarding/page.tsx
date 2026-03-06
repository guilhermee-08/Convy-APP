"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";

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
                router.push('/home');
            } else {
                console.error("Error saving onboarding data:", error);
            }
        } else {
            router.push('/login');
        }

        setIsSubmitting(false);
    };

    const stepData = ONBOARDING_STEPS[currentStep];

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
