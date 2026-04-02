"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const router = useRouter();

    useEffect(() => {
        // Optional: you can verify if a session actually exists before letting them stay on the page.
        // During PKCE password reset, arriving on this page natively mints the session from the URL.
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                // Not authenticated yet, they probably loaded the page directly
                setMessage({ type: 'error', text: "Sessão inválida ou expirada. Solicite uma nova redefinição de senha." });
            }
        });
    }, []);

    const handleReset = async (e: React.FormEvent) => {
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

        const { error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) {
            setMessage({ type: 'error', text: "Ocorreu um erro ao atualizar a senha." });
            setIsLoading(false);
        } else {
            setMessage({ type: 'success', text: "Senha atualizada com sucesso!" });

            // Redirect smoothly to dashboard or wherever preferred
            setTimeout(() => {
                router.push('/home');
            }, 2000);
        }
    };

    return (
        <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-1/4 max-md:hidden left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
            <Card className="w-full max-w-md text-center p-10 space-y-8 relative z-10 border-white/5 bg-card/60">
                <div className="space-y-3">
                    <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-text-main drop-shadow-sm">
                        Redefinir senha
                    </h1>
                    <p className="text-lg text-text-secondary leading-relaxed">
                        Escolha uma nova senha para sua conta.
                    </p>
                </div>

                <form onSubmit={handleReset} className="flex flex-col gap-4 pt-4">
                    <div className="space-y-3 text-left">
                        <Input
                            type="password"
                            placeholder="Nova senha"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                        <Input
                            type="password"
                            placeholder="Confirmar nova senha"
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
                        disabled={isLoading || message?.type === 'success'}
                    >
                        {isLoading ? "Salvando..." : "Redefinir senha"}
                    </Button>

                    {message && (
                        <p className={`text-sm mt-2 font-medium ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                            {message.text}
                        </p>
                    )}
                </form>
            </Card>
        </main>
    );
}
