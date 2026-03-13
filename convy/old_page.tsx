"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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

import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";

type ConversationStep = {
    id: string;
    step_order: number;
    question: string;
    translation?: string;
    hint?: string;
};

type Message = {
    role: string;
    content: string;
    translation?: string;
    hint?: string;
    showTranslation?: boolean;
    showHint?: boolean;
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
    const [messages, setMessages] = useState<Message[]>([]);
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

    // Repetition State
    const [isRepeating, setIsRepeating] = useState(false);
    const [repeatedText, setRepeatedText] = useState("");

    // Streak Animation States
    const [showStreakAnimation, setShowStreakAnimation] = useState(false);
    const [oldStreak, setOldStreak] = useState(0);
    const [newStreak, setNewStreak] = useState(0);

    const [limitReached, setLimitReached] = useState(false);

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
            setRecognitionError("Reconhecimento de voz n├úo dispon├¡vel neste navegador.");
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
                setRecognitionError("Permiss├úo de microfone negada.");
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

    const toggleRepeating = () => {
        if (!recognitionSupported) {
            setRecognitionError("Reconhecimento de voz n├úo dispon├¡vel neste navegador.");
            setTimeout(() => setRecognitionError(""), 3000);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        if (isRepeating) {
            recognition.stop();
            setIsRepeating(false);
            return;
        }

        recognition.onstart = () => {
            setIsRepeating(true);
            setRepeatedText("");
            setRecognitionError("");
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setRepeatedText(transcript);
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error during repeat", event.error);
            setIsRepeating(false);
            if (event.error === 'not-allowed') {
                setRecognitionError("Permiss├úo de microfone negada.");
            } else {
                setRecognitionError("Erro ao reconhecer voz. Tente novamente.");
            }
            setTimeout(() => setRecognitionError(""), 3000);
        };

        recognition.onend = () => {
            setIsRepeating(false);
        };

        try {
            recognition.start();
        } catch (e) {
            console.error(e);
            setIsRepeating(false);
        }
    };

    const speakText = (text: string) => {
        if (!synthesisSupported) {
            setSynthesisError("├üudio n├úo dispon├¡vel neste navegador.");
            setTimeout(() => setSynthesisError(""), 3000);
            return;
        }

        window.speechSynthesis.cancel(); // Stop any ongoing speech

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';

        // Try to find a native English voice if possible
        const voices = window.speechSynthesis.getVoices();
        // Prefer a specific US English voice for better quality if available, fallback to any English voice
        const englishVoice = voices.find(v => v.lang === 'en-US') || voices.find(v => v.lang.startsWith('en'));
        if (englishVoice) {
            utterance.voice = englishVoice;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => {
            setIsSpeaking(false);
            setSynthesisError("Erro ao reproduzir ├íudio.");
            setTimeout(() => setSynthesisError(""), 3000);
        };

        window.speechSynthesis.speak(utterance);
    };

    const toggleTranslation = (idx: number) => {
        setMessages(prev => prev.map((msg, i) => i === idx ? { ...msg, showTranslation: !msg.showTranslation } : msg));
    };

    const toggleHint = (idx: number) => {
        setMessages(prev => prev.map((msg, i) => i === idx ? { ...msg, showHint: !msg.showHint } : msg));
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
                if (profile.last_practice_date === today && profile.practice_count_today >= 2) {
                    setLimitReached(true);
                    setIsPageLoading(false);
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
                    setMessages([{
                        role: 'ai',
                        content: steps[0].question,
                        translation: steps[0].translation,
                        hint: steps[0].hint
                    }]);
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
                setRepeatedText(""); // Reset repeat block for new feedback
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
                {
                    role: 'ai',
                    content: conversationSteps[nextStep].question,
                    translation: conversationSteps[nextStep].translation,
                    hint: conversationSteps[nextStep].hint
                }
            ]);
            setFeedbackData(null);
        } else {
            // Final step: update counter and save session before redirecting
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                // Update profile practice count and xp
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("last_practice_date, practice_count_today, xp")
                    .eq("id", session.user.id)
                    .single();

                if (profile) {
                    const today = new Date().toISOString().split("T")[0];
                    let earnedXp = 0;

                    if (feedbackData?.score) {
                        const parsed = parseInt(feedbackData.score.split('/')[0]);
                        if (!isNaN(parsed)) {
                            if (parsed >= 9) earnedXp = 20;
                            else if (parsed >= 7) earnedXp = 15;
                            else if (parsed >= 5) earnedXp = 10;
                            else earnedXp = 5;
                        }
                    }

                    const updates = {
                        last_practice_date: today,
                        practice_count_today: profile.last_practice_date === today ? profile.practice_count_today + 1 : 1,
                        xp: (profile.xp || 0) + earnedXp
                    };
                    await supabase.from("profiles").update(updates).eq("id", session.user.id);
                }

                // Calculate Streak
                const { data: practices } = await supabase
                    .from('practice_sessions')
                    .select('created_at')
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: false });

                let calculatedOldStreak = 0;
                if (practices && practices.length > 0) {
                    const dates = new Set(practices.map(p => p.created_at.split('T')[0]));
                    const todayObj = new Date();
                    const yesterday = new Date(todayObj);
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayStr = yesterday.toISOString().split("T")[0];

                    // If they practiced yesterday, their old streak is at least 1. Note: This is an approximation
                    // for the animation, assuming they haven't practiced yet today.
                    if (dates.has(yesterdayStr)) {
                        calculatedOldStreak = 1; // Simplified for animation purposes to show an increment
                        // In a real app we'd calculate the full unbroken chain backwards. For this UI, we just need a baseline.
                        // Let's do a basic backwards loop:
                        let checkDate = new Date(yesterday);
                        let streakLoops = 0;
                        while (dates.has(checkDate.toISOString().split("T")[0])) {
                            streakLoops++;
                            checkDate.setDate(checkDate.getDate() - 1);
                        }
                        calculatedOldStreak = streakLoops;
                    }
                }

                const profilePracticeCountToday = profile?.last_practice_date === new Date().toISOString().split("T")[0] ? profile.practice_count_today : 0;

                // If this is their first practice today, increment streak. Otherwise, streak remains the same.
                const wasFirstPracticeToday = profilePracticeCountToday === 0;
                const finalOldStreak = wasFirstPracticeToday ? calculatedOldStreak : Math.max(1, calculatedOldStreak + 1);
                const finalNewStreak = wasFirstPracticeToday ? calculatedOldStreak + 1 : finalOldStreak;

                setOldStreak(finalOldStreak);
                setNewStreak(finalNewStreak);

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

            playSuccessSound();
            setShowStreakAnimation(true);
            setTimeout(() => {
                router.push('/result');
            }, 2500);
        }
    };

    if (showStreakAnimation) {
        // Quick local calculation of XP strictly for visual display on this transition screen
        let displayXp = 0;
        let finalScore = 0;
        if (feedbackData?.score) {
            const parsed = parseInt(feedbackData.score.split('/')[0]);
            if (!isNaN(parsed)) finalScore = parsed;
        }
        if (finalScore >= 9) displayXp = 20;
        else if (finalScore >= 7) displayXp = 15;
        else if (finalScore >= 5) displayXp = 10;
        else displayXp = 5;

        return (
            <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
                {/* Subtle Confetti / Celebration Background Effect */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary/20 rounded-full mix-blend-screen filter blur-[40px] animate-pulse"></div>
                    <div className="absolute top-1/3 right-1/4 w-40 h-40 bg-orange-500/20 rounded-full mix-blend-screen filter blur-[50px] animate-pulse delay-700"></div>
                </div>

                <div className="animate-in zoom-in slide-in-from-bottom-4 duration-500 fade-in flex flex-col items-center z-10 w-full max-w-sm">
                    <div className="bg-card/80 border border-white/10 p-10 rounded-[2rem] shadow-2xl flex flex-col items-center gap-6 animate-bounce-slight w-full text-center relative overflow-hidden backdrop-blur-xl">

                        <div className="text-7xl relative z-10 animate-bounce">­ƒÄë</div>

                        <div className="space-y-1 relative z-10">
                            <h2 className="text-3xl font-black text-text-main tracking-tight drop-shadow-sm">
                                Miss├úo conclu├¡da!
                            </h2>
                            <p className="text-text-secondary font-medium">Pr├ítica registrada com sucesso.</p>
                        </div>

                        <div className="w-full h-px bg-border/50 relative z-10 my-2"></div>

                        <div className="flex w-full justify-around items-center relative z-10">
                            {/* XP Display */}
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xs font-bold text-text-secondary uppercase tracking-widest text-center">XP Ganho</span>
                                <div className="flex items-center gap-1 text-orange-400 font-black text-3xl drop-shadow-[0_0_10px_rgba(249,115,22,0.4)] animate-in slide-in-from-bottom-2 fade-in duration-700 delay-300 fill-mode-both">
                                    +{displayXp}
                                </div>
                            </div>

                            <div className="w-px h-12 bg-border/50"></div>

                            {/* Streak Display */}
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xs font-bold text-text-secondary uppercase tracking-widest text-center">Streak</span>
                                <div className="flex items-center justify-center gap-1 text-text-main font-black text-3xl animate-in slide-in-from-bottom-2 fade-in duration-700 delay-500 fill-mode-both">
                                    <span className="text-primary mr-1">­ƒöÑ</span>
                                    {newStreak}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        );
    }

    if (limitReached) {
        return (
            <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/5 blur-[100px] pointer-events-none"></div>

                <Card className="w-full max-w-sm text-center p-10 space-y-6 relative z-10 border-white/5 bg-card/80 backdrop-blur-xl animate-in zoom-in slide-in-from-bottom-4 duration-500 shadow-2xl rounded-[2rem]">
                    <div className="text-6xl animate-bounce-slight drop-shadow-md">­ƒöÑ</div>

                    <div className="space-y-4">
                        <h2 className="text-2xl font-black tracking-tight text-text-main line-clamp-2">
                            Voc├¬ completou suas pr├íticas gratuitas hoje ­ƒÄë
                        </h2>

                        <div className="space-y-2">
                            <p className="text-[15px] text-text-secondary font-medium px-2">
                                Continue amanh├ú ou desbloqueie conversas ilimitadas.
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 flex flex-col gap-2 relative z-10">
                        <Button
                            variant="primary"
                            className="w-full text-lg h-14 rounded-xl font-bold shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-all"
                            onClick={() => router.push("/paywall")}
                        >
                            Desbloquear Premium
                        </Button>
                        <Button
                            variant="secondary"
                            className="w-full text-md h-12 rounded-xl bg-transparent border-0 text-text-secondary hover:text-white transition-colors hover:bg-white/5"
                            onClick={() => router.push("/home")}
                        >
                            Voltar ao dashboard
                        </Button>
                    </div>
                </Card>
            </main>
        );
    }

    if (isPageLoading) {
        return (
            <main className="min-h-screen bg-background flex flex-col items-center p-6 pt-12 relative overflow-hidden">
                <div className="w-full max-w-2xl space-y-8 relative z-10 animate-in fade-in duration-500">
                    {/* Header & Progress Skeleton */}
                    <div className="text-center space-y-4 mb-8">
                        <h1 className="text-3xl font-extrabold tracking-tight text-text-main drop-shadow-sm">
                            Pr├ítica de conversa
                        </h1>
                        <div className="w-full max-w-md mx-auto space-y-2">
                            <div className="h-2 w-full bg-card border border-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-border/30 rounded-full w-full animate-pulse" />
                            </div>
                            <div className="h-4 w-12 bg-border/30 rounded mx-auto animate-pulse" />
                        </div>
                    </div>

                    {/* Chat Area Skeleton */}
                    <div className="space-y-6 flex-1 min-h-[300px] pb-4">
                        <div className="flex justify-start">
                            <div className="w-[80%] bg-card border border-border rounded-2xl rounded-bl-sm p-5 space-y-3 animate-pulse shadow-sm">
                                <div className="h-4 bg-border/40 rounded w-3/4"></div>
                                <div className="h-4 bg-border/40 rounded w-full"></div>
                                <div className="h-4 bg-border/40 rounded w-5/6"></div>
                                <div className="pt-2 mt-2 border-t border-border/30 flex gap-4">
                                    <div className="h-3 bg-border/40 rounded w-20"></div>
                                    <div className="h-3 bg-border/40 rounded w-12"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-background flex flex-col items-center p-6 pt-12 relative overflow-hidden">
            <div className="w-full max-w-2xl space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header & Progress */}
                <div className="text-center space-y-4 mb-8">
                    <h1 className="text-3xl font-extrabold tracking-tight text-text-main drop-shadow-sm">
                        Pr├ítica de conversa
                    </h1>
                    <div className="w-full max-w-md mx-auto space-y-2">
                        <div className="h-2 w-full bg-card border border-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
                                style={{ width: `${Math.max(5, ((currentStep + 1) / (conversationSteps.length || 1)) * 100)}%` }}
                            />
                        </div>
                        <p className="text-sm font-medium text-text-secondary">
                            {currentStep + 1} / {conversationSteps.length || 1}
                        </p>
                    </div>
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
                                <div className="flex items-center gap-2">
                                    <div>{msg.content}</div>
                                    {msg.role === 'ai' && (
                                        <button
                                            onClick={() => speakText(msg.content)}
                                            className="p-1.5 rounded-full text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors flex items-center justify-center shrink-0"
                                            title="Ouvir pron├║ncia"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isSpeaking ? "animate-pulse text-primary" : ""}>
                                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                {msg.role === 'ai' && (msg.translation || msg.hint) && (
                                    <div className="flex flex-col gap-2 pt-1">
                                        {(msg.translation || msg.hint) && (
                                            <div className="flex items-center justify-between border-t border-border/30 pt-2">
                                                <div className="flex gap-4">
                                                    {msg.translation && (
                                                        <button onClick={() => toggleTranslation(idx)} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                                                            {msg.showTranslation ? "Ocultar tradu├º├úo" : "Ver tradu├º├úo"}
                                                        </button>
                                                    )}
                                                    {msg.hint && (
                                                        <button onClick={() => toggleHint(idx)} className="text-xs font-medium text-amber-500 hover:text-amber-500/80 transition-colors">
                                                            {msg.showHint ? "Ocultar dica" : "Hint"}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {(msg.showTranslation || msg.showHint) && (
                                            <div className="flex flex-col gap-2">
                                                {msg.showTranslation && (
                                                    <div className="text-sm text-text-secondary italic animate-in fade-in">
                                                        {msg.translation}
                                                    </div>
                                                )}
                                                {msg.showHint && (
                                                    <div className="text-sm text-text-main bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg animate-in fade-in">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="font-semibold text-amber-500">­ƒÆí Dica</span>
                                                            <button
                                                                onClick={() => {
                                                                    const textToSpeak = msg.hint ? (msg.hint.includes(":") ? msg.hint.split(":").slice(1).join(":").trim() : msg.hint) : "";
                                                                    speakText(textToSpeak);
                                                                }}
                                                                className="p-1 rounded-full text-amber-500 hover:bg-amber-500/20 transition-colors flex items-center justify-center -mr-1"
                                                                title="Ouvir dica"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                                                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                        <div className="text-text-main/90 leading-relaxed">{msg.hint}</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
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
                            <span className="text-xl">Ô£¿</span> Feedback
                        </h3>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <span className="text-sm font-medium text-text-secondary uppercase tracking-wider">Corre├º├úo</span>
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
                                <span className="text-sm font-medium text-text-secondary uppercase tracking-wider">Op├º├úo mais natural</span>
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
                                                if (scoreNum >= 9) return "Incr├¡vel! Sua resposta soou muito natural.";
                                                if (scoreNum >= 7) return "├ôtimo trabalho! Voc├¬ est├í ficando mais fluente.";
                                                if (scoreNum >= 5) return "Boa tentativa! Pequenos ajustes v├úo deixar sua resposta melhor.";
                                                return "Bom esfor├ºo! Continue praticando e voc├¬ vai melhorar r├ípido.";
                                            })()}
                                        </p>
                                    </div>
                                </div>

                                {/* Repeat Sentence Section */}
                                <div className="space-y-3 pt-4 border-t border-border/50">
                                    <h4 className="text-sm font-semibold text-text-main flex items-center gap-2">
                                        <span className="text-primary text-xl">­ƒÄÖ´©Å</span>
                                        Repeat the correct sentence
                                    </h4>

                                    <div className="bg-card/50 border border-border rounded-xl p-4 space-y-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <p className="text-text-main font-medium leading-relaxed">
                                                "{feedbackData.correction}"
                                            </p>
                                            <div className="flex gap-2 shrink-0">
                                                <button
                                                    onClick={() => speakText(feedbackData.correction)}
                                                    className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center"
                                                    title="Ouvir frase correta"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isSpeaking ? "animate-pulse" : ""}>
                                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={toggleRepeating}
                                                    className={`p-2 rounded-full transition-colors flex items-center justify-center ${isRepeating
                                                        ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                                                        : "bg-primary text-white hover:bg-primary/90 shadow-sm"
                                                        }`}
                                                    title="Repetir frase"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isRepeating ? "animate-pulse" : ""}>
                                                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                                        <line x1="12" x2="12" y1="19" y2="22" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>

                                        {repeatedText && (
                                            <div className="pt-3 border-t border-border/50 animate-in fade-in slide-in-from-top-2">
                                                <span className="text-xs uppercase font-bold text-text-secondary tracking-wider block mb-1">Voc├¬ disse:</span>
                                                <p className="text-text-main italic">"{repeatedText}"</p>
                                            </div>
                                        )}
                                        {isRepeating && !repeatedText && (
                                            <div className="pt-3 border-t border-border/50">
                                                <p className="text-primary text-sm animate-pulse italic">Ouvindo...</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                    <p className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
                                        Mantenha seu streak amanh├ú <span className="text-lg">­ƒöÑ</span>
                                    </p>
                                    <Button variant="primary" onClick={handleNextQuestion} className="px-6 rounded-xl">
                                        {currentStep < conversationSteps.length - 1 ? 'Pr├│xima pergunta' : 'Ver resultado'}
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
                                className={`px-4 rounded-xl shrink-0 transition-all duration-300 ${isListening
                                    ? "bg-red-500/20 text-red-500 border-red-500/50 hover:bg-red-500/30 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                                    : "text-text-secondary hover:text-text-main"
                                    }`}
                                onClick={toggleListening}
                                title="Falar em ingl├¬s"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isListening ? "scale-110 transition-transform" : "transition-transform"}>
                                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    <line x1="12" x2="12" y1="19" y2="22" />
                                </svg>
                            </Button>

                            <Input
                                placeholder={isListening ? "Ouvindo..." : "Digite sua resposta em ingl├¬s..."}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                className="flex-1"
                                autoFocus
                            />

                            <Button
                                type="submit"
                                variant="primary"
                                className="px-8 rounded-xl shrink-0 flex items-center justify-center min-w-[140px]"
                                disabled={!inputValue.trim() || isListening || isLoadingFeedback}
                            >
                                {isLoadingFeedback ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin mr-2"></div>
                                        Checking...
                                    </>
                                ) : (
                                    "Enviar"
                                )}
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
                                Reconhecimento de voz n├úo dispon├¡vel neste navegador.
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
