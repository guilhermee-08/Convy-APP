"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";

export default function Home() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [canPractice, setCanPractice] = useState(true);

    useEffect(() => {
        const checkLimit = async () => {
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
                if (!profile.is_premium) {
                    const today = new Date().toISOString().split("T")[0];
                    if (profile.last_practice_date === today && profile.practice_count_today >= 1) {
                        setCanPractice(false);
                    }
                }
            }
            setIsLoading(false);
        };
        checkLimit();
    }, [router]);

    return (
        <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <Card className="w-full max-w-xl text-center p-10 space-y-8 relative z-10 border-white/5 bg-card/60 animate-in fade-in zoom-in duration-500">
                <div className="space-y-3">
                    <h1 className="text-4xl font-extrabold tracking-tight text-text-main drop-shadow-sm">
                        Prática de hoje
                    </h1>
                    <p className="text-lg text-text-secondary leading-relaxed">
                        {!isLoading && !canPractice
                            ? "Você já completou sua prática gratuita de hoje."
                            : "Inicie sua conversa em inglês."}
                    </p>
                </div>

                <div className="flex flex-col gap-4 pt-4">
                    {isLoading ? (
                        <div className="h-12 w-full animate-pulse bg-card rounded-xl border border-border"></div>
                    ) : canPractice ? (
                        <Button
                            variant="primary"
                            className="w-full text-lg h-12 rounded-xl"
                            onClick={() => router.push("/practice")}
                        >
                            Iniciar prática
                        </Button>
                    ) : (
                        <Button
                            variant="secondary"
                            className="w-full text-lg h-12 rounded-xl border-primary text-primary hover:bg-primary/10"
                            onClick={() => router.push("/paywall")}
                        >
                            Desbloquear ilimitado
                        </Button>
                    )}
                </div>
            </Card>
        </main>
    );
}
