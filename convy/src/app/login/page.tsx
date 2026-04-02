"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { ensureProfileExists } from "@/lib/profile";
import Link from "next/link";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const router = useRouter();

    useEffect(() => {
        // Simple session bouncer
        if (typeof window !== "undefined") {
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (session) {
                    supabase.from('profiles').select('onboarding_completed')
                        .eq('id', session.user.id).single()
                        .then(({ data }) => {
                            if (data?.onboarding_completed) {
                                router.push('/home');
                            } else {
                                router.push('/onboarding');
                            }
                        });
                }
            });
        }
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            if (error.message.includes("Invalid login credentials")) {
                setMessage({ type: 'error', text: "E-mail ou senha incorretos." });
            } else {
                setMessage({ type: 'error', text: "Ocorreu um erro ao entrar. Verifique seus dados." });
            }
            setIsLoading(false);
        } else {
            if (data?.user) {
                await ensureProfileExists(data.user);
            }
            router.push('/home');
        }
    };

    const handleForgotPassword = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!email) {
            setMessage({ type: 'error', text: "Por favor, digite seu e-mail acima para redefinir a senha." });
            return;
        }

        setIsLoading(true);
        setMessage(null);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) {
            setMessage({ type: 'error', text: "Erro ao solicitar redefinição. Verifique o e-mail." });
        } else {
            setMessage({ type: 'success', text: "E-mail de redefinição enviado! Verifique sua caixa de entrada." });
        }

        setIsLoading(false);
    };

    return (
        <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-1/4 max-md:hidden left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
            <Card className="w-full max-w-md text-center p-10 space-y-8 relative z-10 border-white/5 bg-card/60">
                <div className="space-y-3">
                    <h1 className="text-4xl font-extrabold tracking-tight text-text-main drop-shadow-sm">
                        {isForgotPasswordMode ? "Redefinir senha" : "Entrar"}
                    </h1>
                    <p className="text-lg text-text-secondary leading-relaxed">
                        {isForgotPasswordMode ? "Enviaremos um link para você escolher uma nova senha." : "Acesse sua conta para continuar praticando inglês."}
                    </p>
                </div>

                <form onSubmit={isForgotPasswordMode ? handleForgotPassword : handleLogin} className="flex flex-col gap-4 pt-4">
                    <div className="space-y-3 text-left">
                        <Input
                            type="email"
                            placeholder="Seu e-mail"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                        {!isForgotPasswordMode && (
                            <Input
                                type="password"
                                placeholder="Senha"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        )}
                        <div className="flex justify-end pr-1">
                            {!isForgotPasswordMode ? (
                                <button
                                    type="button"
                                    onClick={() => { setIsForgotPasswordMode(true); setMessage(null); }}
                                    disabled={isLoading}
                                    className="text-sm text-text-secondary hover:underline hover:text-primary transition-colors font-medium cursor-pointer"
                                >
                                    Esqueci minha senha
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => { setIsForgotPasswordMode(false); setMessage(null); }}
                                    disabled={isLoading}
                                    className="text-sm text-text-secondary hover:underline hover:text-primary transition-colors font-medium cursor-pointer"
                                >
                                    Voltar para o login
                                </button>
                            )}
                        </div>
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        className="w-full text-lg h-12 rounded-xl mt-2"
                        disabled={isLoading}
                    >
                        {isLoading ? (isForgotPasswordMode ? "Enviando..." : "Entrando...") : (isForgotPasswordMode ? "Enviar link de redefinição" : "Entrar")}
                    </Button>

                    {message && (
                        <p className={`text-sm mt-2 font-medium ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                            {message.text}
                        </p>
                    )}

                    <div className="pt-2 text-sm text-text-secondary">
                        Ainda não tem conta? <Link href="/signup" className="text-primary hover:underline font-medium">Cadastre-se</Link>
                    </div>
                </form>
            </Card>
        </main>
    );
}
