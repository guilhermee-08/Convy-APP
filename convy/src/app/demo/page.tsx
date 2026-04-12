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
            }, 1000); // Shorter intro delay
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
        router.push('/signup?from=onboarding');
    };

    if (practiceState === "intro") {
        return (
            <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden fade-out">
                <div className="absolute inset-0 bg-primary/5 blur-[100px] pointer-events-none"></div>
                <Card className="w-full max-w-md text-center p-10 space-y-8 relative z-10">
                    <div className="space-y-6">
                        <h2 className="text-3xl font-semibold tracking-tight text-white leading-snug">
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
                    <div className="text-center space-y-3 mb-6 shrink-0 mt-2 md:mt-6">
                        <div className="flex bg-primary/10 w-fit px-4 py-1 rounded-full border border-primary/20 mx-auto mb-2">
                            <span className="text-primary font-bold text-xs tracking-wider uppercase">Demonstração</span>
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight text-white drop-shadow-sm">
                            Prática de conversa
                        </h1>
                        <p className="text-sm font-medium text-text-secondary/70 max-w-sm mx-auto italic">
                            "You're at a busy coffee shop. The cashier is waiting for your order."
                        </p>
                    </div>

                    <div className="space-y-6 flex-1 px-1 md:px-2 pb-4">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl p-5 flex flex-col gap-2 ${msg.role === 'user' ? 'bg-primary text-white rounded-br-sm shadow-[0_0_15px_rgba(147,51,234,0.15)]' : 'bg-slate-800/80 border border-white/5 text-white rounded-bl-sm shadow-md'}`}>
                                    <div className="flex items-center gap-2">
                                        <div className="text-lg leading-relaxed">{msg.content}</div>
                                        {msg.role === 'ai' && (
                                            <button onClick={() => speakText(msg.content)} className="p-1.5 rounded-full text-text-secondary hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center shrink-0" title="Ouvir pronúncia">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isSpeaking ? "animate-pulse text-white" : ""}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
                                            </button>
                                        )}
                                    </div>
                                    {msg.role === 'ai' && (msg.translation || msg.hint) && (
                                        <div className="flex flex-col gap-2 pt-1 border-t border-white/10 mt-2">
                                            <div className="flex items-center justify-between pt-2">
                                                <div className="flex gap-4">
                                                    <button onClick={() => toggleTranslation(idx)} className="text-[11px] font-bold uppercase tracking-widest text-text-secondary hover:text-white transition-colors">
                                                        {msg.showTranslation ? "Ocultar tradução" : "Ver tradução"}
                                                    </button>
                                                    <button onClick={() => toggleHint(idx)} className="text-[11px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">
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
                                                        <div className="text-[15px] text-white bg-primary/10 border border-primary/20 p-4 rounded-xl animate-in fade-in mt-2">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="font-bold text-primary text-[11px] uppercase tracking-widest">💡 Dica</span>
                                                                <button
                                                                    onClick={() => {
                                                                        const textToSpeak = msg.hint ? (msg.hint.includes(":") ? msg.hint.split(":").slice(1).join(":").trim().replace(/['"]/g, '') : msg.hint) : "";
                                                                        speakText(textToSpeak);
                                                                    }}
                                                                    className="p-1 rounded-full text-primary hover:bg-primary/20 transition-colors flex items-center justify-center -mr-1"
                                                                    title="Ouvir dica"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                                                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                                                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                            <div className="font-medium leading-relaxed">{msg.hint}</div>
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
                                <div className="text-xs text-text-secondary/60 italic px-2 flex items-center gap-2">
                                    <div className="w-3 h-3 border-2 border-primary/50 border-t-transparent rounded-full animate-spin"></div>
                                    Analisando sua resposta...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="w-full shrink-0 sticky bottom-6 z-20 mt-4 pb-2 px-1 md:px-2">
                        {!isTypingMode ? (
                            <div className="flex flex-col items-center gap-3 w-full animate-in fade-in slide-in-from-bottom-2">
                                <button
                                    type="button"
                                    onClick={toggleListening}
                                    className={`w-[84px] h-[84px] rounded-[24px] flex items-center justify-center transition-all duration-300 active:scale-[0.96] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] ${isListening
                                        ? "bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                                        : "bg-primary text-white border border-white/10 shadow-[0_8px_30px_rgba(124,58,237,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-primary-hover hover:shadow-[0_10px_40px_rgba(124,58,237,0.5),inset_0_1px_0_rgba(255,255,255,0.3)]"
                                        }`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isListening ? "scale-110 transition-transform animate-pulse text-red-500" : "transition-transform"}>
                                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                        <line x1="12" x2="12" y1="19" y2="22" />
                                    </svg>
                                </button>

                                <button
                                    onClick={() => setIsTypingMode(true)}
                                    className="text-text-secondary hover:text-white transition-colors text-[11px] uppercase tracking-widest font-bold flex items-center gap-1.5 py-2 px-5 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10 backdrop-blur-sm"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" /></svg>
                                    DIGITAR RESPOSTA
                                </button>

                                {recognitionError && (
                                    <p className="text-red-400 text-xs text-center animate-in fade-in duration-300 uppercase tracking-widest font-bold mt-2">
                                        {recognitionError}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 w-full max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-2 bg-[#1A1F2B]/95 backdrop-blur-md p-4 rounded-[24px] border border-white/5 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)]">
                                <form onSubmit={handleSendMessage} className="flex gap-3 relative w-full">
                                    <Input
                                        placeholder="Digite sua resposta em inglês..."
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        className="flex-1 rounded-xl bg-black/20 border-white/10 focus:border-primary/50 text-[15px] placeholder:text-white/30"
                                        autoFocus
                                    />
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        className="px-6 rounded-xl shrink-0 flex items-center justify-center min-w-[100px]"
                                        disabled={!inputValue.trim() || isEvaluating}
                                    >
                                        {isEvaluating ? (
                                            <div className="w-5 h-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            "Enviar"
                                        )}
                                    </Button>
                                </form>
                                <button onClick={() => setIsTypingMode(false)} className="text-text-secondary hover:text-white transition-colors text-[11px] uppercase tracking-widest font-bold self-center flex items-center gap-2 py-2 px-4 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
                                    VOLTAR PARA FALA
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
                </div>

                <div className="animate-in zoom-in slide-in-from-bottom-4 duration-500 fade-in flex flex-col items-center z-10 w-full max-w-sm">
                    <Card className="w-full text-center p-10 space-y-6 flex flex-col items-center relative overflow-hidden border-white/10 shadow-2xl">
                        <div className="text-7xl relative z-10 animate-bounce pt-2">👏</div>

                        <div className="space-y-3 relative z-10 px-2">
                            <h2 className="text-2xl font-semibold text-white tracking-tight drop-shadow-sm leading-snug">
                                Você conseguiu se virar nessa situação!
                            </h2>
                        </div>

                        <div className="w-full h-px bg-white/10 relative z-10 my-4"></div>

                        <div className="flex w-full justify-around items-center relative z-10 pb-4">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-[11px] font-bold text-text-secondary uppercase tracking-widest text-center">Desempenho</span>
                                <div className="flex items-center gap-1 text-white font-black text-5xl animate-in slide-in-from-bottom-2 fade-in duration-700 delay-200 fill-mode-both drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                                    {practiceScore}/10
                                </div>
                            </div>
                        </div>

                        <Button
                            variant="primary"
                            className="w-full h-14 font-bold text-lg relative z-10 shadow-[0_0_20px_rgba(147,51,234,0.3)]"
                            onClick={handleFinish}
                        >
                            Continuar
                        </Button>
                    </Card>
                </div>
            </main>
        );
    }

    return null;
}
