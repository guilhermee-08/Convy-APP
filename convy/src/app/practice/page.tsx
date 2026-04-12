"use client";

import { useState, useEffect, Suspense, useRef } from "react";
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
    question_main?: string;
    question_alt_1?: string;
    question_alt_2?: string;
    translation_main?: string;
    translation_alt_1?: string;
    translation_alt_2?: string;
    hint_main?: string;
    hint_alt_1?: string;
    hint_alt_2?: string;
    help_1?: string;
    help_2?: string;
    help_3?: string;
    question: string; // The randomly selected variation
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
    vocabulary?: { word: string; translation: string }[];
    isLoadingTranslation?: boolean;
    helpLevel?: number;
};

type FeedbackData = {
    correction: string;
    natural?: string;
    score: number | string;
    feedback: string;
    tip: string;
    microFeedback?: string;
} | null;

function PracticeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const situationId = searchParams.get('situation_id');

    const [currentStep, setCurrentStep] = useState(0);
    const [messages, setMessages] = useState<Message[]>([]);
    const [helpLevel, setHelpLevel] = useState(0);
    const [inputValue, setInputValue] = useState("");
    const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

    // Feedback and conversation ending states
    const [turnFeedbacks, setTurnFeedbacks] = useState<any[]>([]);
    const [isConversationEnded, setIsConversationEnded] = useState(false);
    const [showFullReview, setShowFullReview] = useState(false);

    // Final result loading states
    type LoadingState = "idle" | "stage1" | "stage2";
    const [finalLoadingState, setFinalLoadingState] = useState<LoadingState>("idle");

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
    const [synthesisError, setSynthesisError] = useState<string | null>(null);
    const [isPreparingAudio, setIsPreparingAudio] = useState(false);

    // Determines if the user is typing or using the new voice-first interface
    const [isTypingMode, setIsTypingMode] = useState(false);

    // Repetition State
    const [isRepeating, setIsRepeating] = useState(false);
    const [repeatedText, setRepeatedText] = useState("");

    // Streak Animation States
    const [showStreakAnimation, setShowStreakAnimation] = useState(false);
    const [oldStreak, setOldStreak] = useState(0);
    const [newStreak, setNewStreak] = useState(0);
    const [currentStreak, setCurrentStreak] = useState(0);

    const [limitReached, setLimitReached] = useState(false);
    const [isVoiceResponse, setIsVoiceResponse] = useState(false);
    const [isPremium, setIsPremium] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioCacheRef = useRef<Record<string, string>>({});
    const activePlaybackTextRef = useRef<string | null>(null);
    const audioUnlockedRef = useRef(false);
    const hasSpokenRef = useRef(false);
    const [autoplayBlocked, setAutoplayBlocked] = useState(false);
    const [pendingAutoplayText, setPendingAutoplayText] = useState<string | null>(null);

    // Single persistent Audio element — iOS Safari requires reusing the same
    // element that was "unlocked" by a user gesture
    const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
    if (typeof window !== 'undefined' && !ttsAudioRef.current) {
        ttsAudioRef.current = new Audio();
    }

    const unlockAudio = () => {
        if (audioUnlockedRef.current) return;
        const el = ttsAudioRef.current;
        if (!el) return;
        // Play a tiny silent mp3 to unlock the element on iOS
        el.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYM6FMAAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYM6FMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
        el.volume = 0;
        el.play().then(() => {
            el.pause();
            el.volume = 1;
            audioUnlockedRef.current = true;
        }).catch(() => { /* Ignore — user hasn't tapped yet */ });
    };

    const lastSpokenMessageContent = useRef<string | null>(null);
    const dataLoadedRef = useRef(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoadingFeedback]);

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

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Voice Activity Detection (VAD) state refs
    const activeStreamRef = useRef<MediaStream | null>(null);
    const globalAudioContextRef = useRef<AudioContext | null>(null);
    const isRecordingProcessActiveRef = useRef(false);
    const animationFrameRef = useRef<number | null>(null);
    const maxDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
    const activeSessionIdRef = useRef<number | null>(null);

    const releaseStream = () => {
        if (activeStreamRef.current) {
            activeStreamRef.current.getTracks().forEach(track => track.stop());
            activeStreamRef.current = null;
        }
    };

    const stopRecordingCleanup = () => {
        if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        isRecordingProcessActiveRef.current = false;

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        // Stream tracks are released inside onstop after data is captured
    };

    const setupVAD = (stream: MediaStream) => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!globalAudioContextRef.current) {
                globalAudioContextRef.current = new AudioContext();
            }
            const ctx = globalAudioContextRef.current;
            if (ctx.state === 'suspended') ctx.resume();

            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            let lastSpeechTime = Date.now();
            let hasSpoken = false;
            let speechFrames = 0;

            const checkSilence = () => {
                if (!isRecordingProcessActiveRef.current) return;

                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) { sum += dataArray[i]; }
                const avg = sum / dataArray.length;

                if (avg > 30) { // Volume threshold for real speech (raised from 15)
                    speechFrames++;
                    if (speechFrames >= 3) { // Require 3 consecutive loud frames
                        hasSpoken = true;
                        hasSpokenRef.current = true;
                    }
                    lastSpeechTime = Date.now();
                } else {
                    speechFrames = 0; // Reset on silence
                    if (hasSpoken) {
                        if (Date.now() - lastSpeechTime > 1500) { // 1.5 seconds elapsed of silence
                            stopRecordingCleanup();
                            return;
                        }
                    }
                }

                animationFrameRef.current = requestAnimationFrame(checkSilence);
            };

            checkSilence();
        } catch (e) {
            console.error("VAD processing error fallback", e);
        }
    };

    const getSupportedMimeType = () => {
        const types = [
            'audio/webm;codecs=opus',
            'audio/mp4',
            'audio/webm'
        ];
        for (const type of types) {
            try {
                if (MediaRecorder.isTypeSupported(type)) {
                    return type;
                }
            } catch (e) {
                // Ignore DOMExceptions if certain browsers crash on isTypeSupported
            }
        }
        return '';
    };

    const toggleListening = async () => {
        unlockAudio(); // Unlock iOS audio on user gesture
        // Prevent disjointed taps or overlapping recording loops
        if (isRecordingProcessActiveRef.current) {
            stopRecordingCleanup();
            return;
        }

        try {
            const sessionId = Date.now();
            activeSessionIdRef.current = sessionId;
            setIsListening(true);
            isRecordingProcessActiveRef.current = true;
            hasSpokenRef.current = false;
            setRecognitionError("");

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            activeStreamRef.current = stream;

            const mimeType = getSupportedMimeType();
            const options = mimeType ? { mimeType } : undefined;
            const mediaRecorder = new MediaRecorder(stream, options);

            mediaRecorderRef.current = mediaRecorder;
            const sessionChunks: Blob[] = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) sessionChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                if (activeSessionIdRef.current !== sessionId) return; // Prevent superseded race conditions

                setIsListening(false);
                isRecordingProcessActiveRef.current = false;
                releaseStream();

                if (sessionChunks.length === 0) return;

                if (!hasSpokenRef.current) {
                    console.log("[Voice Debug] No speech detected by VAD — skipping transcription");
                    setRecognitionError("Nenhuma fala detectada. Tente novamente.");
                    setTimeout(() => { if (activeSessionIdRef.current === sessionId) setRecognitionError(""); }, 3000);
                    setInputValue("");
                    return;
                }

                const isMp4 = mimeType.includes('mp4');
                const ext = isMp4 ? 'mp4' : 'webm';
                const audioBlob = new Blob(sessionChunks, { type: mimeType || 'audio/webm' });

                console.log("[Voice Debug] Blob size:", audioBlob.size, "bytes | type:", audioBlob.type);

                if (audioBlob.size < 1000) {
                    console.log("[Voice Debug] Blob too small — skipping transcription");
                    setRecognitionError("Não foi possível ouvir. Tente novamente.");
                    setTimeout(() => { if (activeSessionIdRef.current === sessionId) setRecognitionError(""); }, 3000);
                    setInputValue("");
                    return;
                }

                const formData = new FormData();
                formData.append('file', audioBlob, `recording.${ext}`);

                console.log("[Voice Debug] Requesting inference - MimeType:", mimeType || "default");

                try {
                    setInputValue('Processando...');
                    const res = await fetch('/api/transcribe', {
                        method: 'POST',
                        body: formData
                    });

                    if (activeSessionIdRef.current !== sessionId) return;

                    if (!res.ok) throw new Error("Transcription failed");
                    const data = await res.json();
                    const transcript = (data.text || "").trim();

                    console.log("[Voice Debug] Transcript:", JSON.stringify(transcript), "| length:", transcript.length);

                    // Whisper Hallucination Filter
                    const hallucinations = [
                        "Medium please. No thanks. I'd like a coffee. Yes, that's all. My name is Guilherme.",
                        "Subtitles by Amara.org",
                        "Thanks for watching",
                        "Thanks for watching.",
                        "Thank you.",
                        "Obrigado.",
                        "Obrigado",
                        "Amara.org"
                    ];

                    if (transcript.length < 2 || hallucinations.includes(transcript)) {
                        console.log("[Voice Debug] Empty or hallucinated transcript — not submitting:", transcript);
                        setRecognitionError("Não foi possível entender a fala. Tente novamente.");
                        setTimeout(() => { if (activeSessionIdRef.current === sessionId) setRecognitionError(""); }, 3000);
                        setInputValue("");
                        return;
                    }

                    console.log("[Voice Debug] Calling submitMessage with:", transcript);
                    setInputValue(transcript);
                    submitMessage(transcript, true);
                } catch (error: any) {
                    if (activeSessionIdRef.current !== sessionId) return;
                    console.error("[Voice Debug] Transcription pipeline error:", error);
                    setRecognitionError("Erro ao processar voz.");
                    setTimeout(() => { if (activeSessionIdRef.current === sessionId) setRecognitionError(""); }, 3000);
                    setInputValue("");
                }
            };

            mediaRecorder.start();
            setupVAD(stream);

            maxDurationTimerRef.current = setTimeout(() => {
                if (activeSessionIdRef.current === sessionId) {
                    stopRecordingCleanup();
                }
            }, 8000);

        } catch (error) {
            console.error("Microphone error", error);
            setRecognitionError("Permissão de microfone negada. Verifique as configurações do navegador.");
            setTimeout(() => setRecognitionError(""), 3000);
            setIsListening(false);
            isRecordingProcessActiveRef.current = false;
        }
    };

    const toggleRepeating = async () => {
        if (isRecordingProcessActiveRef.current) {
            stopRecordingCleanup();
            return;
        }

        try {
            const sessionId = Date.now();
            activeSessionIdRef.current = sessionId;
            setIsRepeating(true);
            isRecordingProcessActiveRef.current = true;
            hasSpokenRef.current = false;
            setRepeatedText("");
            setRecognitionError("");

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            activeStreamRef.current = stream;

            const mimeType = getSupportedMimeType();
            const options = mimeType ? { mimeType } : undefined;
            const mediaRecorder = new MediaRecorder(stream, options);

            mediaRecorderRef.current = mediaRecorder;
            const sessionChunks: Blob[] = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) sessionChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                if (activeSessionIdRef.current !== sessionId) return;

                setIsRepeating(false);
                isRecordingProcessActiveRef.current = false;
                releaseStream();

                if (sessionChunks.length === 0) return;

                if (!hasSpokenRef.current) {
                    setRecognitionError("Nenhuma fala detectada.");
                    setTimeout(() => { if (activeSessionIdRef.current === sessionId) setRecognitionError(""); }, 3000);
                    setRepeatedText("");
                    return;
                }

                const isMp4 = mimeType.includes('mp4');
                const ext = isMp4 ? 'mp4' : 'webm';
                const audioBlob = new Blob(sessionChunks, { type: mimeType || 'audio/webm' });

                const formData = new FormData();
                formData.append('file', audioBlob, `repeat_recording.${ext}`);

                try {
                    setRepeatedText('Processando...');
                    const res = await fetch('/api/transcribe', {
                        method: 'POST',
                        body: formData
                    });

                    if (activeSessionIdRef.current !== sessionId) return;

                    if (!res.ok) throw new Error("Transcription failed");
                    const data = await res.json();
                    let transcript = (data.text || "").trim();

                    const hallucinations = [
                        "Medium please. No thanks. I'd like a coffee. Yes, that's all. My name is Guilherme.",
                        "Subtitles by Amara.org",
                        "Thanks for watching",
                        "Thanks for watching.",
                        "Thank you.",
                        "Obrigado.",
                        "Obrigado",
                        "Amara.org"
                    ];

                    if (transcript.length < 2 || hallucinations.includes(transcript)) {
                        transcript = "";
                    }

                    if (transcript) {
                        setRepeatedText(transcript);
                    } else {
                        setRepeatedText("");
                        setRecognitionError("Não foi possível entender a fala.");
                        setTimeout(() => { if (activeSessionIdRef.current === sessionId) setRecognitionError(""); }, 3000);
                    }
                } catch (error: any) {
                    if (activeSessionIdRef.current !== sessionId) return;
                    console.error("[Voice Debug Repeat] Transcription extraction logic fatal error:", error);
                    setRecognitionError("Erro ao processar repetição.");
                    setTimeout(() => { if (activeSessionIdRef.current === sessionId) setRecognitionError(""); }, 3000);
                    setRepeatedText("");
                }
            };

            mediaRecorder.start();
            setupVAD(stream);

            maxDurationTimerRef.current = setTimeout(() => {
                if (activeSessionIdRef.current === sessionId) {
                    stopRecordingCleanup();
                }
            }, 8000);

        } catch (error) {
            console.error("Microphone error", error);
            setRecognitionError("Permissão de microfone negada.");
            setTimeout(() => setRecognitionError(""), 3000);
            setIsRepeating(false);
            isRecordingProcessActiveRef.current = false;
        }
    };

    const prefetchAudio = async (text: string) => {
        if (!text) return null;
        if (audioCacheRef.current[text]) return audioCacheRef.current[text];
        try {
            const res = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            if (!res.ok) throw new Error("TTS prefetch failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            audioCacheRef.current[text] = url;
            return url;
        } catch (e) {
            console.error("Prefetch audio failed:", e);
            return null;
        }
    };

    const speakText = async (text: string) => {
        try {
            const audio = ttsAudioRef.current;
            if (!audio) return;

            // Stop any current playback
            audio.pause();
            audio.currentTime = 0;

            activePlaybackTextRef.current = text;
            setIsPreparingAudio(true);

            let url = audioCacheRef.current[text];
            if (!url) {
                url = await prefetchAudio(text) || "";
            }

            // Abandon if superseded by another quick action
            if (activePlaybackTextRef.current !== text) {
                setIsPreparingAudio(false);
                return;
            }

            setIsPreparingAudio(false);

            if (!url) {
                setIsSpeaking(false);
                return;
            }

            setIsSpeaking(true);
            audio.src = url;

            audio.onended = () => setIsSpeaking(false);
            audio.onerror = (e) => {
                console.error("Audio Playback Error:", e);
                setIsSpeaking(false);
            };

            try {
                await audio.play();
                audioUnlockedRef.current = true; // Mark as unlocked so unlockAudio() won't interfere later
                setAutoplayBlocked(false);
                setPendingAutoplayText(null);
            } catch (playError) {
                // iOS Safari autoplay was blocked — surface a tap-to-play state
                console.warn("Autoplay blocked by browser:", playError);
                setIsSpeaking(false);
                setAutoplayBlocked(true);
                setPendingAutoplayText(text);
            }
        } catch (error) {
            console.error("speakText error:", error);
            setIsPreparingAudio(false);
            setIsSpeaking(false);
        }
    };

    // Auto-play TTS when a newly rendered AI message appears
    useEffect(() => {
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];

            // If the newest message is from AI and we haven't spoken this exact text yet
            if (lastMessage.role === 'ai' && lastSpokenMessageContent.current !== lastMessage.content) {
                lastSpokenMessageContent.current = lastMessage.content;

                // Slight delay to ensure UI renders smoothly before audio block starts
                setTimeout(() => {
                    try {
                        speakText(lastMessage.content).then(() => {
                            // After playing, blindly prefetch the next potential conversation step silently
                            if (currentStep + 1 < conversationSteps.length) {
                                prefetchAudio(conversationSteps[currentStep + 1].question);
                            }
                        });
                    } catch (e) {
                        console.warn("Auto-play TTS error:", e);
                    }
                }, 300);
            }
        }
    }, [messages]);

    const toggleTranslation = (idx: number) => {
        setMessages(prev => prev.map((msg, i) => i === idx ? { ...msg, showTranslation: !msg.showTranslation } : msg));
    };

    const handleHelp = () => {
        if (helpLevel >= 3) return;
        const nextLevel = helpLevel + 1;
        const step = conversationSteps[currentStep];
        if (!step) return;

        const helpMap: Record<number, string | undefined> = {
            1: step.help_1 || step.hint_main,
            2: step.help_2 || step.hint_alt_1,
            3: step.help_3 || step.hint_alt_2,
        };

        const content = helpMap[nextLevel] || helpMap[1] || "Tente responder de forma simples.";

        setMessages(prev => [...prev, { role: 'help', content, helpLevel: nextLevel }]);
        setHelpLevel(nextLevel);
    };

    // Initial limit check & load data
    useEffect(() => {
        const loadData = async () => {
            if (dataLoadedRef.current) return;
            dataLoadedRef.current = true;

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

            if (profile) {
                setIsPremium(profile.is_premium);

                if (!profile.is_premium) {
                    const today = new Date().toISOString().split("T")[0];
                    if (profile.last_practice_date === today && profile.practice_count_today >= 2) {
                        setLimitReached(true);
                        setIsPageLoading(false);
                        return;
                    }
                }
            }

            // Sync User's Historical Streak immediately for motivation mapping
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const { data: practices } = await supabase
                    .from('practice_sessions')
                    .select('created_at')
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: false });

                let calculatedStreak = 0;
                if (practices && practices.length > 0) {
                    const datesArray = Array.from(new Set(practices.map(p => {
                        const localDate = new Date(p.created_at);
                        localDate.setHours(0, 0, 0, 0);
                        return `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
                    }))).sort((a, b) => b.localeCompare(a));

                    let currentRun = 0;
                    let lastDateInRun: Date | null = null;
                    for (let i = datesArray.length - 1; i >= 0; i--) {
                        const d = new Date(datesArray[i] + 'T00:00:00');
                        if (!lastDateInRun) {
                            currentRun = 1;
                        } else {
                            const diffDays = Math.round(Math.abs(d.getTime() - lastDateInRun.getTime()) / (1000 * 3600 * 24));
                            if (diffDays === 1) currentRun++;
                            else if (diffDays > 1) currentRun = 1;
                        }
                        lastDateInRun = d;
                    }
                    if (lastDateInRun) {
                        const diffFromToday = Math.round(Math.abs(today.getTime() - lastDateInRun.getTime()) / (1000 * 3600 * 24));
                        if (diffFromToday > 1) currentRun = 0;
                    }
                    calculatedStreak = currentRun;
                }
                setCurrentStreak(calculatedStreak);
            } catch (e) {
                console.error("Historical streak calc load failed:", e);
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
                    const processedSteps = steps.slice(0, 4).map((step: any) => {
                        const variations: { question: string; translation?: string; hint?: string }[] = [];

                        // 1. Include question_main if it exists. DO NOT fall back to old "question" if it does.
                        if (step.question_main) {
                            variations.push({
                                question: step.question_main,
                                translation: step.translation_main || step.translation,
                                hint: step.hint_main || step.hint
                            });
                        } else if (step.question) {
                            variations.push({
                                question: step.question,
                                translation: step.translation,
                                hint: step.hint
                            });
                        }

                        // 2. Include question_alt_1 if it exists
                        if (step.question_alt_1) {
                            variations.push({
                                question: step.question_alt_1,
                                translation: step.translation_alt_1 || step.translation,
                                hint: step.hint_alt_1 || step.hint
                            });
                        }

                        // 3. Include question_alt_2 if it exists
                        if (step.question_alt_2) {
                            variations.push({
                                question: step.question_alt_2,
                                translation: step.translation_alt_2 || step.translation,
                                hint: step.hint_alt_2 || step.hint
                            });
                        }

                        console.log("question variations:", variations);

                        // Randomly choose ONE variation
                        const selectedVariation = variations.length > 0
                            ? variations[Math.floor(Math.random() * variations.length)]
                            : { question: "Error: No question provided in database." };

                        console.log("chosen question variation:", selectedVariation);

                        // Randomly select hint variation independently to make it less repetitive
                        const hintVariations: string[] = [];
                        if (step.hint_main) hintVariations.push(step.hint_main);
                        else if (step.hint) hintVariations.push(step.hint);

                        if (step.hint_alt_1) hintVariations.push(step.hint_alt_1);
                        if (step.hint_alt_2) hintVariations.push(step.hint_alt_2);

                        const selectedHint = hintVariations.length > 0
                            ? hintVariations[Math.floor(Math.random() * hintVariations.length)]
                            : selectedVariation.hint;

                        return {
                            ...step,
                            question: selectedVariation.question,
                            translation: selectedVariation.translation,
                            hint: selectedHint,
                        };
                    });

                    setConversationSteps(processedSteps);

                    // Map immediate values natively into State hooks first
                    const firstQuestion = processedSteps[0].question;
                    setMessages([{
                        role: 'ai',
                        content: firstQuestion,
                        translation: processedSteps[0].translation,
                        hint: processedSteps[0].hint
                    }]);

                    // Prefetch audio for the first question before showing the UI
                    try {
                        await prefetchAudio(firstQuestion);
                    } catch (e) {
                        console.warn("Audio preload error (non-blocking):", e);
                    }
                } else {
                    const fallbackStep: ConversationStep = {
                        id: 'fallback',
                        step_order: 1,
                        question: "Nenhuma pergunta encontrada para esta conversa."
                    };
                    setConversationSteps([fallbackStep]);
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
        unlockAudio(); // Unlock iOS audio on user gesture
        const userText = inputValue.trim();
        if (!userText) return;
        await submitMessage(userText, false);
    };

    const submitMessage = async (text: string, isVoice: boolean = false) => {
        setIsVoiceResponse(isVoice);

        // Pre-flight check: If this is the absolute first message of the conversation, log it.
        // We do not log strictly upon entering the page, but when the user ACTUALLY speaks.
        if (currentStep === 0) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("is_premium, practice_count_today, last_practice_date")
                    .eq("id", session.user.id)
                    .single();

                if (profile) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const todayStr = today.toISOString().split("T")[0];

                    let newCount = profile.last_practice_date === todayStr ? profile.practice_count_today : 0;

                    if (!profile.is_premium && newCount >= 2) {
                        alert("Você atingiu o limite de conversas gratuitas por dia. Volte amanhã para continuar praticando!");
                        router.push('/home');
                        return; // Halt message submission strictly!
                    }

                    // Valid intercept. Increment immediately. 
                    // This protects against browser refreshes exploiting endless step1 conversations.
                    await supabase.from("profiles")
                        .update({
                            practice_count_today: newCount + 1,
                            last_practice_date: todayStr
                        })
                        .eq('id', session.user.id);
                }
            }
        }

        let nextStep = currentStep;
        let isFinal = false;

        // 1. Immediately update UI with user's message
        const userMessage: Message = { role: 'user', content: text };

        // 2. Immediately determine next AI message
        let nextAiMessage: Message | null = null;

        if (currentStep < 2 && currentStep < conversationSteps.length - 1) {
            nextStep = currentStep + 1;
            nextAiMessage = {
                role: 'ai',
                content: conversationSteps[nextStep].question,
                translation: conversationSteps[nextStep].translation,
                hint: conversationSteps[nextStep].hint
            };
        } else {
            isFinal = true;
            const closingStep = conversationSteps[3];
            nextAiMessage = {
                role: 'ai',
                content: closingStep ? closingStep.question : "Perfect. Let's wrap this up.",
                translation: closingStep?.translation,
                hint: closingStep?.hint
            };
        }

        // Apply immediate UI update for both messages at once
        setMessages(prev => [...prev, userMessage, nextAiMessage as Message]);
        setCurrentStep(nextStep);
        setHelpLevel(0);
        setInputValue("");

        if (isFinal) {
            // Start the two-stage loading flow immediately
            setFinalLoadingState("stage1");

            // Switch to stage 2 after a natural reading delay
            setTimeout(() => {
                setFinalLoadingState(current => current === "stage1" ? "stage2" : current);
            }, 2500);
        }

        // 3. Fire background feedback request (fire-and-forget)
        const currentQuestion = conversationSteps[currentStep].question;
        const currentTurnIndex = currentStep;

        setIsLoadingFeedback(true); // Can use this to show a subtle background saving state if needed

        fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: currentQuestion,
                userAnswer: text
            })
        }).then(async (response) => {
            if (response.ok) {
                const data = await response.json();

                // Store the full feedback invisibly mapped to this turn
                setTurnFeedbacks(prev => {
                    const next = [...prev];
                    next[currentTurnIndex] = data;
                    return next;
                });

                const numericScore = parseInt(String(data.score).split('/')[0]) || 0;
                setScores(prev => [...prev, numericScore]);
            } else {
                console.error("Feedback error for turn", currentTurnIndex);
            }
        }).catch(error => {
            console.error("Networking error for turn", currentTurnIndex, error);
        }).finally(() => {
            // Calculate if this is the final turn and we should show the evaluation screen
            setIsLoadingFeedback(false);

            // If we just processed the feedback for the 3rd turn
            setTurnFeedbacks(currentFeedbacks => {
                // If it's final and we have 3 feedbacks ready
                if (isFinal) {
                    // Force stage 2 if we somehow finished stage 1 super fast
                    setFinalLoadingState(current => {
                        if (current === "stage1") return "stage2";
                        return current;
                    });

                    // We ensure it stays on stage 2 for at least a brief moment to feel natural
                    setTimeout(() => {
                        setFinalLoadingState("idle");
                        setIsConversationEnded(true);
                    }, 1500);
                }
                return currentFeedbacks;
            });
        });
    };

    const handleShowReview = () => {
        setShowFullReview(true);
        setTimeout(() => {
            const reviewSection = document.getElementById("full-review-section");
            if (reviewSection) {
                const yOffset = -24; // slight padding from top
                const y = reviewSection.getBoundingClientRect().top + window.scrollY + yOffset;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        }, 150);
    };

    const handleFinishReview = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            // Update profile practice count and xp
            const { data: profile } = await supabase
                .from("profiles")
                .select("last_practice_date, practice_count_today, xp")
                .eq("id", session.user.id)
                .single();

            let finalOldStreak = 0;
            let finalNewStreak = 1;

            if (profile) {
                // Determine dates
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Normalize to local midnight
                const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

                const lastPracticeDateStr = profile.last_practice_date;
                let lastPracticeDate = new Date(lastPracticeDateStr || 0);
                if (lastPracticeDateStr) {
                    // Normalize to prevent timezone shifts matching wrong days if the DB stored specific times.
                    lastPracticeDate = new Date(lastPracticeDateStr + "T00:00:00");
                }

                // Calculate Streak from History
                const { data: practices } = await supabase
                    .from('practice_sessions')
                    .select('created_at')
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: false });

                let calculatedOldStreak = 0;
                if (practices && practices.length > 0) {
                    const datesArray = Array.from(new Set(practices.map(p => {
                        const localDate = new Date(p.created_at);
                        localDate.setHours(0, 0, 0, 0);
                        const year = localDate.getFullYear();
                        const month = String(localDate.getMonth() + 1).padStart(2, '0');
                        const day = String(localDate.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                    }))).sort((a, b) => b.localeCompare(a));

                    let currentRun = 0;
                    let lastDateInRun: Date | null = null;

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
                        lastDateInRun = d;
                    }

                    if (lastDateInRun) {
                        const diffFromToday = Math.round(Math.abs(today.getTime() - lastDateInRun.getTime()) / (1000 * 3600 * 24));
                        if (diffFromToday > 1) {
                            currentRun = 0;
                        }
                    }
                    calculatedOldStreak = currentRun;
                }

                const profilePracticeCountToday = profile.last_practice_date === todayStr ? profile.practice_count_today : 0;
                const wasFirstPracticeToday = profilePracticeCountToday === 0;

                // Streak Logic Calculation (User Explicit Rules)
                // - if last_practice_date is yesterday: streak_count + 1
                // - if last_practice_date is not yesterday: streak_count = 1
                // - except if already today, keep current streak
                // the variable calculatedOldStreak is already handling this history analysis robustly.
                finalOldStreak = wasFirstPracticeToday ? calculatedOldStreak : Math.max(1, calculatedOldStreak);
                finalNewStreak = wasFirstPracticeToday ? calculatedOldStreak + 1 : finalOldStreak;

                // Calculate earned XP
                let earnedXp = 0;
                if (scores.length > 0) {
                    const finalScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                    if (finalScore >= 9) earnedXp = 20;
                    else if (finalScore >= 7) earnedXp = 15;
                    else if (finalScore >= 5) earnedXp = 10;
                    else earnedXp = 5;
                }

                // Update Profile
                const updates = {
                    last_practice_date: todayStr,
                    xp: (profile.xp || 0) + earnedXp
                };

                await supabase.from("profiles").update(updates).eq("id", session.user.id);
            }

            // Set states for the animation UI
            setOldStreak(finalOldStreak);
            setNewStreak(finalNewStreak);

            // Save practice session
            console.log("saving practice session");
            try {
                let finalScore = 0;
                if (scores.length > 0) {
                    finalScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
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

    if (showStreakAnimation) {
        // Quick local calculation of XP strictly for visual display on this transition screen
        let displayXp = 0;
        let finalScore = 0;
        if (scores.length > 0) {
            finalScore = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
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

                        <div className="text-7xl relative z-10 animate-bounce">🎉</div>

                        <div className="space-y-1 relative z-10">
                            <h2 className="text-3xl font-black text-text-main tracking-tight drop-shadow-sm">
                                🔥 Você já consegue se comunicar em inglês
                            </h2>
                            <p className="text-text-secondary font-medium">Prática registrada com sucesso.</p>
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
                                    <span className="text-primary mr-1">🔥</span>
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
                    <div className="text-6xl animate-bounce-slight drop-shadow-md">🔥</div>

                    <div className="space-y-4">
                        <h2 className="text-2xl font-black tracking-tight text-text-main line-clamp-2">
                            Você completou suas práticas gratuitas hoje 🎉
                        </h2>

                        <div className="space-y-2">
                            <p className="text-[15px] text-text-secondary font-medium px-2">
                                Continue amanhã ou desbloqueie conversas ilimitadas.
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
            <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/5 blur-[100px] pointer-events-none"></div>

                <div className="w-full max-w-sm text-center p-10 space-y-6 relative z-10 border border-white/10 bg-card/80 backdrop-blur-xl animate-in zoom-in slide-in-from-bottom-4 duration-500 shadow-2xl rounded-[2rem] flex flex-col items-center">
                    <div className="relative w-14 h-14 flex items-center justify-center mb-2">
                        <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute flex items-center justify-center text-primary text-xl">🎙️</div>
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-xl font-bold tracking-tight text-text-main animate-pulse">
                            Preparando a conversa...
                        </h2>
                        <p className="text-sm text-text-secondary font-medium">
                            Ajustando áudio e conectando o microfone
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-background flex flex-col items-center p-4 md:p-6 relative">
            <div className="w-full max-w-2xl flex flex-col relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header & Progress */}
                <div className="text-center space-y-4 mb-4 shrink-0 mt-2 md:mt-6">
                    <div className="flex justify-center mb-4 animate-in fade-in zoom-in duration-500">
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border flex items-center gap-1.5 ${isPremium ? 'bg-orange-500/5 text-orange-400 border-orange-500/20' : 'bg-white/5 text-text-secondary border-white/5'}`}>
                            {isPremium ? '🔥 Premium' : '🌱 Plano Free'}
                        </div>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white mb-2">
                        Prática de conversa
                    </h1>
                    <div className="w-full max-w-sm mx-auto flex items-center gap-4 pt-4 pb-2">
                        <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden relative">
                            <div
                                className="absolute left-0 top-0 h-full bg-primary transition-all duration-500 ease-out rounded-full shadow-[0_0_10px_rgba(124,58,237,0.4)]"
                                style={{ width: `${Math.max(5, ((currentStep + 1) / (conversationSteps.length || 1)) * 100)}%` }}
                            />
                        </div>
                        <span className="text-[11px] font-bold tracking-widest text-text-secondary shrink-0">
                            {currentStep + 1} DE {conversationSteps.length || 1}
                        </span>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="space-y-6 flex-1 px-1 md:px-2 pb-4">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[85%] rounded-[20px] px-5 py-4 flex flex-col gap-1.5 text-[15px] shadow-sm ${msg.role === 'user'
                                    ? 'bg-primary text-white rounded-br-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]'
                                    : msg.role === 'help'
                                        ? 'bg-[#1E2433] border border-white/5 text-text-main text-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                                        : 'bg-[#1E2433] border border-white/5 text-white rounded-bl-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    {msg.role === 'help' && <span className="font-semibold text-amber-500 mr-0.5 text-base" aria-hidden="true">💡</span>}
                                    <div className="leading-relaxed">{msg.content}</div>
                                    {(msg.role === 'ai' || (msg.role === 'help' && msg.helpLevel === 3)) && (
                                        <button
                                            onClick={() => speakText(msg.content)}
                                            className={`p-1.5 rounded-full transition-colors flex items-center justify-center shrink-0 ${msg.role === 'help' ? 'text-amber-500/70 hover:text-amber-500 hover:bg-amber-500/10' : 'text-text-secondary hover:text-primary hover:bg-primary/10'}`}
                                            title="Ouvir pronúncia"
                                            disabled={isPreparingAudio}
                                        >
                                            {isPreparingAudio && activePlaybackTextRef.current === msg.content ? (
                                                <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${msg.role === 'help' ? 'border-amber-500' : 'border-primary'}`}></div>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isSpeaking && activePlaybackTextRef.current === msg.content ? `animate-pulse ${msg.role === 'help' ? 'text-amber-500' : 'text-primary'}` : ""}>
                                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                                                </svg>
                                            )}
                                        </button>
                                    )}
                                </div>
                                {msg.role === 'ai' && (msg.translation || (idx === messages.findLastIndex(m => m.role === 'ai') && helpLevel < 3)) && (
                                    <div className="flex flex-col gap-2 pt-1">
                                        <div className="flex items-center justify-between border-t border-border/30 pt-2">
                                            <div className="flex gap-4">
                                                {msg.translation && (
                                                    <button onClick={() => toggleTranslation(idx)} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                                                        {msg.showTranslation ? "Ocultar tradução" : "Ver tradução"}
                                                    </button>
                                                )}
                                                {idx === messages.findLastIndex(m => m.role === 'ai') && helpLevel < 3 && (
                                                    <button onClick={handleHelp} className="text-xs font-medium text-amber-500 hover:text-amber-500/80 transition-colors">
                                                        💡 Preciso de ajuda
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {msg.showTranslation && (
                                            <div className="flex flex-col gap-2">
                                                <div className="flex flex-col gap-3 animate-in fade-in">
                                                    <div className="text-sm text-text-secondary italic">
                                                        "{msg.translation}"
                                                    </div>
                                                    {msg.vocabulary && msg.vocabulary.length > 0 && (
                                                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                                                            <span className="text-xs font-bold text-primary uppercase tracking-wider mb-2 block">Vocabulário</span>
                                                            <ul className="space-y-1.5 text-sm text-text-secondary">
                                                                {msg.vocabulary.map((v, i) => (
                                                                    <li key={i} className="flex gap-2">
                                                                        <span className="font-semibold text-text-main shrink-0">{v.word}</span>
                                                                        <span className="text-text-secondary/50">=</span>
                                                                        <span>{v.translation}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* iOS autoplay blocked fallback */}
                    {autoplayBlocked && pendingAutoplayText && (
                        <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <button
                                onClick={() => {
                                    unlockAudio();
                                    setAutoplayBlocked(false);
                                    setPendingAutoplayText(null);
                                    speakText(pendingAutoplayText);
                                }}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                </svg>
                                Toque para ouvir
                            </button>
                        </div>
                    )}

                    {isLoadingFeedback && finalLoadingState === 'idle' && (
                        <div className="flex justify-start opacity-70 mb-2">
                            <div className="text-xs text-text-secondary/60 italic px-2 flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 border-2 border-primary/50 border-t-transparent rounded-full animate-spin"></div>
                                Salvando progresso...
                            </div>
                        </div>
                    )}

                    {/* Two-stage final loading UI */}
                    {finalLoadingState !== 'idle' && (
                        <div className="flex justify-center mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="bg-card/50 border border-primary/20 backdrop-blur-sm px-6 py-4 rounded-2xl flex flex-col items-center gap-3">
                                <div className="relative w-8 h-8 flex items-center justify-center">
                                    <div className="absolute inset-0 border-2 border-primary/30 rounded-full"></div>
                                    <div className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                </div>
                                <div className="text-sm font-medium text-text-main animate-pulse">
                                    {finalLoadingState === 'stage1'
                                        ? "Analisando suas respostas..."
                                        : "Preparando seu resultado final..."}
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Conversation Ended Action Bar */}
                {isConversationEnded && finalLoadingState === 'idle' && (
                    <div className="pt-8 pb-4 animate-in fade-in slide-in-from-bottom-6 duration-700 flex justify-center px-4 w-full">
                        <div className="bg-card w-full max-w-sm rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center gap-5 border border-border shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20"></div>

                            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center -mt-2">
                                <span className="text-4xl animate-bounce-slight">🎉</span>
                            </div>

                            <div className="space-y-1">
                                <h2 className="text-2xl font-bold text-white tracking-tight">Conversa finalizada!</h2>
                                <p className="text-sm text-text-secondary font-medium">Você mandou muito bem.</p>
                            </div>

                            <div className="bg-[#1A1F2B] px-6 py-5 rounded-2xl border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] w-full mb-2 flex flex-col items-center">
                                <span className="text-text-secondary text-xs font-bold uppercase tracking-widest block mb-1">Média final</span>
                                <span className="text-white font-black text-5xl">
                                    {scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0}<span className="text-2xl text-text-secondary">/10</span>
                                </span>
                                <span className="text-sm font-medium text-text-main text-center block mt-3">
                                    {scores.length > 0 && Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) >= 7 ? "Bom! Você já se comunica 👍" : "Continue praticando, você está no caminho! 💪"}
                                </span>
                            </div>

                            {!showFullReview && (
                                <Button
                                    onClick={handleShowReview}
                                    className="w-full rounded-xl py-6 text-lg font-bold shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:scale-[1.02] transition-transform"
                                >
                                    Ver minha avaliação completa
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Full Review Render (End of Conversation) */}
                {showFullReview && (
                    <div id="full-review-section" className="px-1 md:px-2 pb-8 space-y-8 animate-in mt-4 md:mt-8 fade-in slide-in-from-bottom-8 duration-500">
                        <div className="flex items-center justify-between border-b border-border/50 pb-4">
                            <h3 className="font-bold text-xl text-primary flex items-center gap-2">
                                <span className="text-2xl">✨</span> Avaliação Completa
                            </h3>
                            <div className="bg-card px-4 py-2 rounded-lg border border-border shadow-sm">
                                <span className="text-text-secondary text-sm font-medium mr-2">Média final:</span>
                                <span className="text-text-main font-bold text-lg">
                                    {scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0}/10
                                </span>
                            </div>
                        </div>

                        {turnFeedbacks.map((fb, index) => {
                            if (!fb) return null;
                            const scoreNum = parseInt(String(fb.score).split('/')[0]) || 0;
                            const userMsgIndex = index * 2 + 1;
                            const userMsg = messages[userMsgIndex]?.content || "";

                            return (
                                <Card key={`fb-${index}`} className="w-full p-6 space-y-4 border-l-4 border-l-primary/50 bg-primary/5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-text-secondary uppercase tracking-wider">Turno {index + 1}</span>
                                        <div className="text-xl font-bold text-text-main">{scoreNum}/10</div>
                                    </div>

                                    <div className="space-y-4 pt-2">
                                        <div className="space-y-1">
                                            <span className="text-sm font-medium text-text-secondary uppercase tracking-wider block">👍 O que você fez bem</span>
                                            <div className="bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg p-3 font-medium">
                                                {fb.feedback}
                                            </div>
                                        </div>

                                        {fb.correction && (
                                            <div className="space-y-1">
                                                <span className="text-sm font-medium text-text-secondary uppercase tracking-wider block">❌ Correção</span>
                                                <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
                                                    <span className="text-red-400 line-through decoration-red-400/50">"{userMsg}"</span>
                                                    <span className="text-green-400 font-medium">"{fb.correction}"</span>
                                                </div>
                                            </div>
                                        )}

                                        {fb.highlights && Array.isArray(fb.highlights) && fb.highlights.length > 0 && (
                                            <div className="space-y-1">
                                                <span className="text-sm font-medium text-text-secondary uppercase tracking-wider block">🔍 Mudanças específicas</span>
                                                <div className="bg-card border border-border rounded-lg p-3 space-y-2">
                                                    {fb.highlights.map((h: any, i: number) => (
                                                        <div key={i} className="flex items-center gap-2 text-sm">
                                                            <span className="text-red-400 line-through font-medium">"{h.wrong}"</span>
                                                            <span className="text-text-secondary">→</span>
                                                            <span className="text-green-400 font-bold">"{h.right}"</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {fb.examples && Array.isArray(fb.examples) && fb.examples.length > 0 && (
                                            <div className="space-y-1">
                                                <span className="text-sm font-medium text-text-secondary uppercase tracking-wider block">💬 Respostas válidas</span>
                                                <div className="bg-card border border-green-500/20 rounded-lg p-3 space-y-1.5">
                                                    {fb.examples.map((ex: string, i: number) => (
                                                        <div key={i} className="flex items-start gap-2">
                                                            <span className="text-green-400 mt-0.5 shrink-0">•</span>
                                                            <span className="text-text-main font-medium text-sm">"{ex}"</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {fb.natural && (
                                            <div className="space-y-1">
                                                <span className="text-sm font-medium text-text-secondary uppercase tracking-wider block">💡 Versão mais natural</span>
                                                <div className="bg-card border border-border rounded-lg p-4 text-text-main italic">
                                                    "{fb.natural}"
                                                </div>
                                            </div>
                                        )}

                                        {fb.tip && (
                                            <div className="space-y-1">
                                                <span className="text-sm font-medium text-text-secondary uppercase tracking-wider block">🧠 Dica rápida</span>
                                                <div className="bg-primary/10 rounded-lg p-3 text-sm text-text-main border border-primary/20">
                                                    {fb.tip}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Repeat Sentence Section */}
                                    {fb.correction && (
                                        <div className="space-y-3 pt-4 border-t border-border/50">
                                            <h4 className="text-sm font-semibold text-text-main flex items-center gap-2">
                                                <span className="text-primary text-xl">🎙️</span> Repeat the correct sentence
                                            </h4>
                                            <div className="bg-card/50 border border-border rounded-xl p-4 space-y-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <p className="text-text-main font-medium leading-relaxed">"{fb.correction}"</p>
                                                    <button
                                                        onClick={() => speakText(fb.correction)}
                                                        className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center shrink-0"
                                                        title="Ouvir frase correta"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            );
                        })}

                        <div className="flex flex-col pt-8 mt-6 border-t border-white/5 space-y-6">
                            <Button variant="primary" onClick={handleFinishReview} className="w-full text-base">
                                Praticar novamente 🔁
                            </Button>
                            <p className="text-sm font-medium text-text-secondary text-center flex items-center justify-center gap-1.5">
                                {currentStreak === 0
                                    ? "Volte amanhã e comece um streak de 1 dia"
                                    : `Volte amanhã e leve seu streak pra ${currentStreak + 1} dias`} <span className="text-lg">🔥</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* Input Area */}
                {!isConversationEnded && !showFullReview && finalLoadingState === 'idle' && (
                    <div className="w-full shrink-0 sticky bottom-6 z-20 mt-4 pb-2">
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
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 w-full max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-2 bg-[#1A1F2B]/95 backdrop-blur-md p-4 rounded-[24px] border border-white/5 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)]">
                                <form onSubmit={handleSendMessage} className="flex gap-3 relative w-full">
                                    <Input
                                        placeholder={isListening ? "Ouvindo..." : "Digite sua resposta em inglês..."}
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        className="flex-1 rounded-xl bg-black/20 border-white/10 focus:border-primary/50 text-[15px]"
                                        autoFocus
                                    />

                                    <Button
                                        type="submit"
                                        variant="primary"
                                        className="px-6 rounded-xl shrink-0 flex items-center justify-center min-w-[100px]"
                                        disabled={!inputValue.trim() || isListening || isLoadingFeedback}
                                    >
                                        {isLoadingFeedback ? (
                                            <div className="w-5 h-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            "Enviar"
                                        )}
                                    </Button>
                                </form>
                                <button
                                    onClick={() => setIsTypingMode(false)}
                                    className="text-text-secondary hover:text-white transition-colors text-sm font-medium self-center flex items-center gap-2 py-2 px-4 rounded-full hover:bg-white/5"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
                                    Voltar para fala
                                </button>
                            </div>
                        )}

                        {/* Error Message for Speech Recognition / Synthesis */}
                        {(recognitionError || synthesisError) && (
                            <p className="text-red-400 text-xs pl-2 animate-in fade-in duration-300 text-center mt-2">
                                {recognitionError || synthesisError}
                            </p>
                        )}
                        {!recognitionSupported && !recognitionError && (
                            <p className="text-text-secondary/50 text-xs pl-2 text-center mt-2">
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
