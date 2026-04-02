"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { ensureProfileExists } from "@/lib/profile";
import Link from "next/link";

export default function Signup() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isFromOnboarding, setIsFromOnboarding] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            if (params.get("from") === "onboarding") {
                setIsFromOnboarding(true);
            }
        }
    }, []);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: "As senhas não coincidem." });
            setIsLoading(false);
            return;
        }

        if (password.length < 6) {
            setMessage({ type: 'error', text: "A senha deve ter no mínimo 6 caracteres." });
            setIsLoading(false);
            return;
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            if (error.message.includes("already registered")) {
                setMessage({ type: 'error', text: "Este e-mail já está em uso." });
            } else {
                setMessage({ type: 'error', text: "Ocorreu um erro ao criar a conta. Formato de e-mail inválido ou falha na rede." });
            }
        } else {
            // Supabase by default will log them in unless email confirmations are explicitly required
            if (data.user) {
                await ensureProfileExists(data.user);
            }
            router.push('/home'); // Will trigger the session sync logic in the callback, or just send to home.
        }

        setIsLoading(false);
    };

    return (
        <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-1/4 max-md:hidden left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
            <Card className="w-full max-w-md text-center p-10 space-y-8 relative z-10 border-white/5 bg-card/60">
                <div className="space-y-3">
                    <h1 className="text-4xl font-extrabold tracking-tight text-text-main drop-shadow-sm">
                        {isFromOnboarding ? "Conta" : "Criar conta"}
                    </h1>
                    <p className="text-lg text-text-secondary leading-relaxed">
                        {isFromOnboarding ? "Crie sua conta para salvar seu progresso" : "Cadastre-se para começar a praticar inglês."}
                    </p>
                </div>

                <form onSubmit={handleSignup} className="flex flex-col gap-4 pt-4">
                    <div className="space-y-3 text-left">
                        <Input
                            type="email"
                            placeholder="Seu e-mail"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                        <Input
                            type="password"
                            placeholder="Senha"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                        <Input
                            type="password"
                            placeholder="Confirmar senha"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        className="w-full text-lg h-12 rounded-xl mt-2"
                        disabled={isLoading}
                    >
                        {isLoading ? "Criando conta..." : "Criar conta"}
                    </Button>

                    {message && (
                        <p className={`text-sm mt-2 font-medium ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                            {message.text}
                        </p>
                    )}

                    <div className="pt-2 text-sm text-text-secondary">
                        Já tem uma conta? <Link href="/login" className="text-primary hover:underline font-medium">Entrar</Link>
                    </div>
                </form>
            </Card>
        </main>
    );
}
