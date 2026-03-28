"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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

        playNote(659.25, 0);
        playNote(830.61, 0.15);
    } catch {
        // Ignore audio errors
    }
};

type Message = {
    role: string;
    content: string;
    translation?: string;
    hint?: string;
    showTranslation?: boolean;
    showHint?: boolean;
};

export default function Demo() {
    const router = useRouter();

    const [practiceState, setPracticeState] = useState<"intro" | "question" | "success">("intro");
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "ai",
            content: "Hello! How are you doing today?",
            translation: "Olá! Como está indo o seu dia?",
            hint: "Você pode dizer: 'I am doing great!'"
        }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [practiceScore, setPracticeScore] = useState<number>(0);
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Voice Recognition State
    const [isListening, setIsListening] = useState(false);
    const [recognitionSupported, setRecognitionSupported] = useState(true);
    const [recognitionError, setRecognitionError] = useState("");
    const [isTypingMode, setIsTypingMode] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const lastSpokenMessageIndex = useRef<number>(-1);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (!SpeechRecognition) {
                setRecognitionSupported(false);
            }
        }
    }, []);

    const speakText = (text: string) => {
        try {
            if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
            const synth = window.speechSynthesis;
            if (!synth) return;
            try { synth.cancel(); } catch (e) { }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            try {
                const voices = synth.getVoices() || [];
                const englishVoice = voices.find(v => v.lang === 'en-US') || voices.find(v => v.lang.startsWith('en'));
                if (englishVoice) utterance.voice = englishVoice;
            } catch (e) { }

            utterance.onstart = () => setIsSpeaking(true);
            utterance.onerror = () => setIsSpeaking(false);
            utterance.onend = () => setIsSpeaking(false);

            synth.speak(utterance);
        } catch (error) {
            console.warn("Speech synthesis failed gracefully:", error);
            setIsSpeaking(false);
        }
    };

    useEffect(() => {
        if (practiceState === "question" && messages.length > 0) {
            const lastIndex = messages.length - 1;
            const lastMessage = messages[lastIndex];

            if (lastMessage.role === 'ai' && lastSpokenMessageIndex.current !== lastIndex) {
                lastSpokenMessageIndex.current = lastIndex;
                setTimeout(() => {
                    try {
                        speakText(lastMessage.content);
                    } catch (e) { }
                }, 300);
            }
        }
    }, [messages, practiceState]);

    useEffect(() => {
        if (practiceState === "intro") {
            const timer = setTimeout(() => {
                setPracticeState("question");
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [practiceState]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isEvaluating]);

    // Instant static toggles (No API calls!)
    const toggleTranslation = (idx: number) => {
        setMessages(prev => prev.map((m, i) => i === idx ? { ...m, showTranslation: !m.showTranslation } : m));
    };

    const toggleHint = (idx: number) => {
        setMessages(prev => prev.map((msg, i) => i === idx ? { ...msg, showHint: !msg.showHint } : msg));
    };

    const submitAnswer = async (userText: string) => {
        if (!userText.trim()) return;

        setMessages(prev => [...prev, { role: 'user', content: userText }]);
        setInputValue("");
        setIsEvaluating(true);

        try {
            const res = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: messages[0].content, // Evaluate against the first AI question
                    userAnswer: userText
                }),
            });
            const data = await res.json();

            let finalScore = 10;
            if (data?.score) {
                const parsed = parseInt(data.score.split('/')[0]);
                if (!isNaN(parsed)) finalScore = parsed;
            }
            setPracticeScore(finalScore);

            setTimeout(() => {
                playSuccessSound();
                setPracticeState("success");
            }, 1000);
        } catch (error) {
            console.error(error);
            setPracticeScore(10);
            setTimeout(() => {
                playSuccessSound();
                setPracticeState("success");
            }, 1000);
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        submitAnswer(inputValue);
    };

    const toggleListening = () => {
        if (!recognitionSupported) {
            setRecognitionError("Reconhecimento de voz não disponível.");
            setTimeout(() => setRecognitionError(""), 3000);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
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
            if (!transcript) return;
            setInputValue(transcript);
            submitAnswer(transcript); // Automatically submit on speech end
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
            if (event.error === 'not-allowed') {
                setRecognitionError("Permissão de microfone negada.");
            } else {
                setRecognitionError("Erro ao reconhecer voz. Tente digitar.");
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

    const handleFinish = () => {
        router.push('/onboarding');
    };

    if (practiceState === "intro") {
        return (
            <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden fade-out">
                <div className="absolute inset-0 bg-primary/5 blur-[100px] pointer-events-none"></div>
                <Card className="w-full max-w-md text-center p-10 space-y-8 relative z-10 border-white/5 bg-card/80 backdrop-blur-md animate-in zoom-in slide-in-from-bottom-4 duration-500">
                    <div className="space-y-6">
                        <h2 className="text-3xl font-extrabold tracking-tight text-text-main line-clamp-3 leading-snug">
                            ⚡ Sua prática vai começar agora
                        </h2>
                        <div className="flex flex-col items-center gap-4 pt-2">
                            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-lg text-text-secondary font-medium animate-pulse">
                                Preparando tudo...
                            </p>
                        </div>
                    </div>
                </Card>
            </main>
        );
    }

    if (practiceState === "question") {
        return (
            <main className="min-h-screen bg-background flex flex-col items-center p-4 md:p-6 relative">
                <div className="w-full max-w-2xl flex flex-col relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center space-y-2 mb-4 shrink-0 mt-2 md:mt-6">
                        <div className="flex bg-primary/10 w-fit px-4 py-1.5 rounded-full border border-primary/20 mx-auto mb-2">
                            <span className="text-primary font-bold text-sm tracking-wide uppercase">Demonstração</span>
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-text-main drop-shadow-sm">
                            Prática de conversa
                        </h1>
                    </div>

                    <div className="space-y-6 flex-1 px-1 md:px-2 pb-4 pt-4">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-sm flex flex-col gap-1.5 ${msg.role === 'user' ? 'bg-primary text-white rounded-br-sm' : 'bg-card border border-border text-text-main rounded-bl-sm'}`}>
                                    <div className="flex items-center gap-2">
                                        <div className="text-lg leading-relaxed">{msg.content}</div>
                                        {msg.role === 'ai' && (
                                            <button onClick={() => speakText(msg.content)} className="p-1.5 rounded-full text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors flex items-center justify-center shrink-0" title="Ouvir pronúncia">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isSpeaking ? "animate-pulse text-primary" : ""}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
                                            </button>
                                        )}
                                    </div>
                                    {msg.role === 'ai' && (msg.translation || msg.hint) && (
                                        <div className="flex flex-col gap-2 pt-1">
                                            <div className="flex items-center justify-between border-t border-border/30 pt-2 mt-1">
                                                <div className="flex gap-4">
                                                    <button onClick={() => toggleTranslation(idx)} className="text-xs font-semibold uppercase tracking-wide text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                                                        {msg.showTranslation ? "Ocultar tradução" : "Ver tradução"}
                                                    </button>
                                                    <button onClick={() => toggleHint(idx)} className="text-xs font-semibold uppercase tracking-wide text-amber-500 hover:text-amber-500/80 transition-colors">
                                                        {msg.showHint ? "Ocultar dica" : "Ver dica"}
                                                    </button>
                                                </div>
                                            </div>
                                            {(msg.showTranslation || msg.showHint) && (
                                                <div className="flex flex-col gap-2 pt-2">
                                                    {msg.showTranslation && (
                                                        <div className="flex flex-col gap-3 animate-in fade-in">
                                                            <div className="text-[15px] text-text-secondary italic">"{msg.translation}"</div>
                                                        </div>
                                                    )}
                                                    {msg.showHint && (
                                                        <div className="text-[15px] text-text-main bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg animate-in fade-in mt-1">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="font-bold text-amber-500 text-xs uppercase tracking-wide">💡 Dica</span>
                                                                <button
                                                                    onClick={() => {
                                                                        const textToSpeak = msg.hint ? (msg.hint.includes(":") ? msg.hint.split(":").slice(1).join(":").trim().replace(/['"]/g, '') : msg.hint) : "";
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
                                                            <div className="text-text-main/90 font-medium leading-relaxed">{msg.hint}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isEvaluating && (
                            <div className="flex justify-start opacity-70 mb-2">
                                <div className="text-xs text-text-secondary/60 italic px-2 flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 border-2 border-primary/50 border-t-transparent rounded-full animate-spin"></div>
                                    Analisando sua resposta...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="pt-4 border-t border-border/30 space-y-4 shrink-0 mb-2 px-1 md:px-2">
                        {!isTypingMode ? (
                            <div className="flex flex-col items-center gap-3 w-full animate-in fade-in slide-in-from-bottom-2 pt-2">
                                <Button
                                    type="button"
                                    onClick={toggleListening}
                                    variant="secondary"
                                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${isListening ? "bg-red-500/20 text-red-500 border-red-500/50 hover:bg-red-500/30 animate-pulse shadow-[0_0_25px_rgba(239,68,68,0.25)] scale-105" : "bg-primary text-white border-primary/50 hover:bg-primary/90 shadow-[0_0_15px_rgba(var(--primary),0.3)] hover:scale-105"}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isListening ? "scale-110 transition-transform" : "transition-transform"}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
                                </Button>

                                <span className="text-sm font-medium text-text-secondary/80 tracking-wide mt-1">
                                    {isListening ? "Ouvindo..." : "Toque no botão para falar"}
                                </span>

                                <button onClick={() => setIsTypingMode(true)} className="text-text-secondary hover:text-white transition-colors text-xs font-medium flex items-center gap-1.5 py-1.5 px-4 rounded-full hover:bg-white/5 mt-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" /></svg>
                                    Digitar resposta
                                </button>

                                {recognitionError && (
                                    <p className="text-red-400 text-xs text-center animate-in fade-in duration-300 uppercase tracking-widest font-bold mt-2">
                                        {recognitionError}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 w-full animate-in fade-in slide-in-from-bottom-2">
                                <form onSubmit={handleSendMessage} className="flex gap-3 relative w-full">
                                    <Input
                                        placeholder="Digite sua resposta em inglês..."
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        className="flex-1"
                                        autoFocus
                                    />
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        className="px-8 rounded-xl shrink-0 flex items-center justify-center min-w-[120px]"
                                        disabled={!inputValue.trim() || isEvaluating}
                                    >
                                        {isEvaluating ? (
                                            <div className="w-5 h-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            "Enviar"
                                        )}
                                    </Button>
                                </form>
                                <button onClick={() => setIsTypingMode(false)} className="text-text-secondary hover:text-white transition-colors text-sm font-medium self-center flex items-center gap-2 py-2 px-4 rounded-full hover:bg-white/5">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
                                    Voltar para voz
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        );
    }

    if (practiceState === "success") {
        return (
            <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary/20 rounded-full mix-blend-screen filter blur-[40px] animate-pulse"></div>
                    <div className="absolute top-1/3 right-1/4 w-40 h-40 bg-orange-500/20 rounded-full mix-blend-screen filter blur-[50px] animate-pulse delay-700"></div>
                </div>

                <div className="animate-in zoom-in slide-in-from-bottom-4 duration-500 fade-in flex flex-col items-center z-10 w-full max-w-sm">
                    <div className="bg-card/80 border border-white/10 p-10 rounded-[2rem] shadow-2xl flex flex-col items-center gap-6 animate-bounce-slight w-full text-center relative overflow-hidden backdrop-blur-xl">
                        <div className="text-7xl relative z-10 animate-bounce">🎉</div>

                        <div className="space-y-1 relative z-10">
                            <h2 className="text-3xl font-black text-text-main tracking-tight drop-shadow-sm">
                                Você já consegue se comunicar em inglês!
                            </h2>
                            <p className="text-text-secondary font-medium">Bom trabalho!</p>
                        </div>

                        <div className="w-full h-px bg-border/50 relative z-10 my-2"></div>

                        <div className="flex w-full justify-around items-center relative z-10">
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xs font-bold text-text-secondary uppercase tracking-widest text-center">Nota Final</span>
                                <div className="flex items-center gap-1 text-text-main font-black text-4xl animate-in slide-in-from-bottom-2 fade-in duration-700 delay-200 fill-mode-both">
                                    {practiceScore}/10
                                </div>
                            </div>
                        </div>

                        <Button
                            variant="primary"
                            className="w-full mt-2 rounded-xl h-14 font-bold text-lg relative z-10 shadow-[0_0_20px_rgba(99,102,241,0.25)]"
                            onClick={handleFinish}
                        >
                            Continuar
                        </Button>
                    </div>
                </div>
            </main>
        );
    }

    return null;
}
