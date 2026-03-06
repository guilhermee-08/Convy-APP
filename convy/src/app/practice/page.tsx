"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const CONVERSATION_STEPS = [
    "Hello! What would you like to drink?",
    "What size would you like?",
    "Anything else?"
];

type FeedbackData = {
    correction: string;
    natural: string;
    score: string;
    shortFeedback: string;
} | null;

export default function Practice() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0);
    const [messages, setMessages] = useState([
        { role: 'ai', content: CONVERSATION_STEPS[0] }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [feedbackData, setFeedbackData] = useState<FeedbackData>(null);
    const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const userText = inputValue.trim();
        if (!userText) return;

        const newMessages = [...messages, { role: 'user', content: userText }];
        setMessages(newMessages);
        setInputValue("");
        setIsLoadingFeedback(true);

        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: CONVERSATION_STEPS[currentStep],
                    userAnswer: userText
                })
            });
            const data = await response.json();
            if (response.ok) {
                setFeedbackData(data);
            } else {
                console.error("Feedback error:", data.error);
                // Simple fallback so the user can continue even if AI fails
                setFeedbackData({
                    correction: userText,
                    natural: userText,
                    score: "N/A",
                    shortFeedback: "There was an error generating feedback. Please continue."
                });
            }
        } catch (error) {
            console.error("Networking error:", error);
            setFeedbackData({
                correction: userText,
                natural: userText,
                score: "N/A",
                shortFeedback: "Network error occurred."
            });
        } finally {
            setIsLoadingFeedback(false);
        }
    };

    const handleNextQuestion = () => {
        if (currentStep < CONVERSATION_STEPS.length - 1) {
            const nextStep = currentStep + 1;
            setCurrentStep(nextStep);
            setMessages((prev) => [
                ...prev,
                { role: 'ai', content: CONVERSATION_STEPS[nextStep] }
            ]);
            setFeedbackData(null);
        } else {
            router.push('/result');
        }
    };

    return (
        <main className="min-h-screen bg-background flex flex-col items-center p-6 pt-12 relative overflow-hidden">
            <div className="w-full max-w-2xl space-y-8 relative z-10">
                {/* Header */}
                <div className="text-center space-y-2 mb-8">
                    <h1 className="text-3xl font-extrabold tracking-tight text-text-main drop-shadow-sm">
                        Prática de conversa
                    </h1>
                    <p className="text-text-secondary">
                        Cafeteria - Passo {currentStep + 1} de {CONVERSATION_STEPS.length}
                    </p>
                </div>

                {/* Chat Area */}
                <div className="space-y-6 flex-1 min-h-[300px] overflow-y-auto pb-4">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-sm ${msg.role === 'user'
                                    ? 'bg-primary text-white rounded-br-sm'
                                    : 'bg-card border border-border text-text-main rounded-bl-sm'
                                    }`}
                            >
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isLoadingFeedback && (
                        <div className="flex justify-end animate-pulse opacity-50">
                            <div className="bg-primary text-white px-5 py-3 rounded-2xl rounded-br-sm shadow-sm">
                                Analisando resposta...
                            </div>
                        </div>
                    )}
                </div>

                {/* Feedback Card */}
                {feedbackData && (
                    <Card className="w-full p-6 space-y-4 border-primary/30 bg-primary/5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                            <span className="text-xl">✨</span> Feedback
                        </h3>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <span className="text-sm font-medium text-text-secondary uppercase tracking-wider">Correção</span>
                                <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
                                    <span className="text-red-400 line-through decoration-red-400/50">
                                        "{messages[messages.length - 1].content}"
                                    </span>
                                    <span className="text-green-400 font-medium">
                                        "{feedbackData.correction}"
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <span className="text-sm font-medium text-text-secondary uppercase tracking-wider">Opção mais natural</span>
                                <div className="bg-card border border-border rounded-lg p-4 text-text-main italic">
                                    "{feedbackData.natural}"
                                </div>
                            </div>

                            <div className="bg-primary/10 rounded-lg p-3 text-sm text-text-main border border-primary/20">
                                {feedbackData.shortFeedback}
                            </div>

                            <div className="flex items-center justify-between border-t border-border/50 pt-4">
                                <div className="space-y-0.5">
                                    <span className="text-sm font-medium text-text-secondary uppercase tracking-wider">Nota</span>
                                    <div className="text-2xl font-bold text-text-main">
                                        {feedbackData.score}
                                    </div>
                                </div>

                                <Button variant="primary" onClick={handleNextQuestion} className="px-6 rounded-xl">
                                    {currentStep < CONVERSATION_STEPS.length - 1 ? 'Próxima pergunta' : 'Ver resultado'}
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Input Area */}
                {!feedbackData && !isLoadingFeedback && (
                    <form onSubmit={handleSendMessage} className="flex gap-3 pt-4 border-t border-border/30">
                        <Input
                            placeholder="Digite sua resposta em inglês..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            className="flex-1"
                            autoFocus
                        />
                        <Button type="submit" variant="primary" className="px-8 rounded-xl shrink-0" disabled={!inputValue.trim()}>
                            Enviar
                        </Button>
                    </form>
                )}
            </div>
        </main>
    );
}
