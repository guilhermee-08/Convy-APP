import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function Result() {
    return (
        <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <Card className="w-full max-w-md text-center p-10 space-y-8 relative z-10 border-white/5 bg-card/60">
                <div className="space-y-3">
                    <h1 className="text-4xl font-extrabold tracking-tight text-text-main drop-shadow-sm">
                        Seu resultado
                    </h1>
                    <p className="text-lg text-text-secondary leading-relaxed">
                        Veja seu desempenho.
                    </p>
                </div>

                <div className="flex flex-col gap-4 pt-4">
                    <Link href="/paywall" className="w-full">
                        <Button variant="primary" className="w-full text-lg h-12 rounded-xl">
                            Ver planos
                        </Button>
                    </Link>
                </div>
            </Card>
        </main>
    );
}
