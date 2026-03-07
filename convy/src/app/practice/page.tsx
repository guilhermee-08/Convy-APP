"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";

type ConversationStep = {
    id: string;
    step_order: number;
    question: string;
};

type FeedbackData = {
    correction: string;
    natural: string;
    score: string;
    shortFeedback: string;
} | null;

function PracticeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const situationId = searchParams.get('situation_id');

    const [currentStep, setCurrentStep] = useState(0);
    const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [feedbackData, setFeedbackData] = useState<FeedbackData>(null);
    const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(true);

    const [conversationSteps, setConversationSteps] = useState<ConversationStep[]>([]);
    const [situationTitle, setSituationTitle] = useState("Conversa");

    const [scores, setScores] = useState<number[]>([]);

    // Speech Recognition State
    const [isListening, setIsListening] = useState(false);
    const [recognitionSupported, setRecognitionSupported] = useState(true);
    const [recognitionError, setRecognitionError] = useState("");

    // Speech Synthesis State
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [synthesisSupported, setSynthesisSupported] = useState(true);
    const [synthesisError, setSynthesisError] = useState("");

    // Initialize Speech APIs
    useEffect(() => {
        if (typeof window !== "undefined") {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (!SpeechRecognition) {
                setRecognitionSupported(false);
            }
            if (!("speechSynthesis" in window)) {
                setSynthesisSupported(false);
            }
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionSupported) {
            setRecognitionError("Reconhecimento de voz não disponível neste navegador.");
            setTimeout(() => setRecognitionError(""), 3000);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        // Configure for English recognition
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        if (isListening) {
            recognition.stop();
            setIsListening(false);
            return;
        }

        recognition.onstart = () => {
            setIsListening(true);
            setRecognitionError("");
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            // Append to existing input, or replace if empty
            setInputValue((prev) => prev ? `${prev} ${transcript}` : transcript);
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
            if (event.error === 'not-allowed') {
                setRecognitionError("Permissão de microfone negada.");
            } else {
                setRecognitionError("Erro ao reconhecer voz. Tente novamente.");
            }
            setTimeout(() => setRecognitionError(""), 3000);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        try {
            recognition.start();
        } catch (e) {
            console.error(e);
            setIsListening(false);
        }
    };

    const speakText = (text: string) => {
        if (!synthesisSupported) {
            setSynthesisError("Áudio não disponível neste navegador.");
            setTimeout(() => setSynthesisError(""), 3000);
            return;
        }

        window.speechSynthesis.cancel(); // Stop any ongoing speech

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';

        // Try to find a native English voice if possible
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(v => v.lang.startsWith('en'));
        if (englishVoice) {
            utterance.voice = englishVoice;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => {
            setIsSpeaking(false);
            setSynthesisError("Erro ao reproduzir áudio.");
            setTimeout(() => setSynthesisError(""), 3000);
        };

        window.speechSynthesis.speak(utterance);
    };

    // Initial limit check & load data
    useEffect(() => {
        const loadData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                router.push("/login");
                return;
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("is_premium, last_practice_date, practice_count_today")
                .eq("id", session.user.id)
                .single();

            if (profile && !profile.is_premium) {
                const today = new Date().toISOString().split("T")[0];
                if (profile.last_practice_date === today && profile.practice_count_today >= 1) {
                    router.push("/paywall");
                    return;
                }
            }

            if (situationId) {
                const { data: situation } = await supabase
                    .from('situations')
                    .select('title')
                    .eq('id', situationId)
                    .single();
                if (situation) {
                    setSituationTitle(situation.title);
                }

                const { data: steps } = await supabase
                    .from('conversation_steps')
                    .select('*')
                    .eq('situation_id', situationId)
                    .order('step_order', { ascending: true });

                console.log("conversation steps:", steps);

                if (steps && steps.length > 0) {
                    setConversationSteps(steps);
                    setMessages([{ role: 'ai', content: steps[0].question }]);
                } else {
                    const fallbackStep = { id: 'fallback', step_order: 1, question: "Nenhuma pergunta encontrada para esta conversa." };
                    setConversationSteps([fallbackStep as ConversationStep]);
                    setMessages([{ role: 'ai', content: fallbackStep.question }]);
                }
            } else {
                router.push("/home");
                return;
            }

            setIsPageLoading(false);
        };
        loadData();
    }, [router, situationId]);

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
                    question: conversationSteps[currentStep].question,
                    userAnswer: userText
                })
            });
            const data = await response.json();
            if (response.ok) {
                setFeedbackData(data);
                const numericScore = parseInt(data.score.split('/')[0]) || 0;
                setScores(prev => [...prev, numericScore]);
            } else {
                console.error("Feedback error:", data.error);
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

    const handleNextQuestion = async () => {
        if (currentStep < conversationSteps.length - 1) {
            const nextStep = currentStep + 1;
            setCurrentStep(nextStep);
            setMessages((prev) => [
                ...prev,
                { role: 'ai', content: conversationSteps[nextStep].question }
            ]);
            setFeedbackData(null);
        } else {
            // Final step: update counter and save session before redirecting
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                // Update profile practice count
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("last_practice_date, practice_count_today")
                    .eq("id", session.user.id)
                    .single();

                if (profile) {
                    const today = new Date().toISOString().split("T")[0];
                    const updates = {
                        last_practice_date: today,
                        practice_count_today: profile.last_practice_date === today ? profile.practice_count_today + 1 : 1
                    };
                    await supabase.from("profiles").update(updates).eq("id", session.user.id);
                }

                // Save practice session
                console.log("saving practice session");
                try {
                    let finalScore = 0;
                    if (feedbackData?.score) {
                        const parsed = parseInt(feedbackData.score.split('/')[0]);
                        if (!isNaN(parsed)) finalScore = parsed;
                    }

                    const { error: insertError } = await supabase.from("practice_sessions").insert({
                        user_id: session.user.id,
                        situation_id: situationId,
                        score: finalScore,
                        created_at: new Date().toISOString()
                    });

                    if (insertError) {
                        console.log("practice session save error", insertError);
                    } else {
                        console.log("practice session saved");
                    }
                } catch (e) {
                    console.log("practice session save error", e);
                }
            }
            router.push('/result');
        }
    };

    if (isPageLoading) {
        return (
            <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative">
                <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-background flex flex-col items-center p-6 pt-12 relative overflow-hidden">
            <div className="w-full max-w-2xl space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header */}
                <div className="text-center space-y-2 mb-8">
                    <h1 className="text-3xl font-extrabold tracking-tight text-text-main drop-shadow-sm">
                        Prática de conversa
                    </h1>
                    <p className="text-text-secondary">
                        {situationTitle} - Passo {currentStep + 1} de {conversationSteps.length || 1}
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
                                className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-sm flex flex-col gap-1.5 ${msg.role === 'user'
                                    ? 'bg-primary text-white rounded-br-sm'
                                    : 'bg-card border border-border text-text-main rounded-bl-sm'
                                    }`}
                            >
                                <div>{msg.content}</div>
                                {msg.role === 'ai' && (
                                    <div className="flex justify-end pt-1">
                                        <button
                                            onClick={() => speakText(msg.content)}
                                            className="p-1.5 rounded-full text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors flex items-center justify-center"
                                            title="Ouvir pronúncia"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isSpeaking ? "animate-pulse text-primary" : ""}>
                                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                                            </svg>
                                        </button>
                                    </div>
                                )}
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

                            <div className="flex flex-col gap-4 border-t border-border/50 pt-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <span className="text-sm font-medium text-text-secondary uppercase tracking-wider">Nota</span>
                                        <div className="text-2xl font-bold text-text-main">
                                            {feedbackData.score}
                                        </div>
                                    </div>

                                    <div className="text-right max-w-[60%]">
                                        <p className="text-sm font-medium text-primary">
                                            {(() => {
                                                const scoreNum = parseInt(feedbackData.score.split('/')[0]) || 0;
                                                if (scoreNum >= 9) return "Incrível! Sua resposta soou muito natural.";
                                                if (scoreNum >= 7) return "Ótimo trabalho! Você está ficando mais fluente.";
                                                if (scoreNum >= 5) return "Boa tentativa! Pequenos ajustes vão deixar sua resposta melhor.";
                                                return "Bom esforço! Continue praticando e você vai melhorar rápido.";
                                            })()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <p className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
                                        Mantenha seu streak amanhã <span className="text-lg">🔥</span>
                                    </p>
                                    <Button variant="primary" onClick={handleNextQuestion} className="px-6 rounded-xl">
                                        {currentStep < conversationSteps.length - 1 ? 'Próxima pergunta' : 'Ver resultado'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Input Area */}
                {!feedbackData && !isLoadingFeedback && (
                    <div className="pt-4 border-t border-border/30 space-y-2">
                        <form onSubmit={handleSendMessage} className="flex gap-3 relative">
                            <Button
                                type="button"
                                variant="secondary"
                                className={`px-4 rounded-xl shrink-0 transition-colors ${isListening
                                    ? "bg-red-500/20 text-red-500 border-red-500/50 hover:bg-red-500/30 hover:text-red-400"
                                    : "text-text-secondary hover:text-text-main"
                                    }`}
                                onClick={toggleListening}
                                title="Falar em inglês"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isListening ? "animate-pulse" : ""}>
                                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    <line x1="12" x2="12" y1="19" y2="22" />
                                </svg>
                            </Button>

                            <Input
                                placeholder={isListening ? "Ouvindo..." : "Digite sua resposta em inglês..."}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                className="flex-1"
                                autoFocus
                            />

                            <Button type="submit" variant="primary" className="px-8 rounded-xl shrink-0" disabled={!inputValue.trim() || isListening}>
                                Enviar
                            </Button>
                        </form>

                        {/* Error Message for Speech Recognition / Synthesis */}
                        {(recognitionError || synthesisError) && (
                            <p className="text-red-400 text-xs pl-2 animate-in fade-in duration-300">
                                {recognitionError || synthesisError}
                            </p>
                        )}
                        {!recognitionSupported && !recognitionError && (
                            <p className="text-text-secondary/50 text-xs pl-2">
                                Reconhecimento de voz não disponível neste navegador.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}

export default function Practice() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex flex-col items-center justify-center">
                <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        }>
            <PracticeContent />
        </Suspense>
    );
}
