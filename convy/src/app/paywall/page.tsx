import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function Paywall() {
    return (
        <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
            <Card className="w-full max-w-lg text-center p-12 space-y-8 relative z-10 border-white/10 bg-card/80 backdrop-blur-md">
                <div className="space-y-3">
                    <div className="inline-block rounded-full px-3 py-1 text-sm text-primary font-medium bg-primary/10 border border-primary/20 mb-2 tracking-wide">
                        PREMIUM
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-md">
                        Convy Premium
                    </h1>
                    <p className="text-lg text-text-secondary leading-relaxed">
                        Desbloqueie conversas ilimitadas com IA.
                    </p>
                </div>

                <div className="flex flex-col gap-4 pt-6">
                    <Link href="/home" className="w-full">
                        <Button variant="primary" className="w-full text-lg h-14 rounded-xl shadow-lg shadow-primary/30">
                            Assinar agora
                        </Button>
                    </Link>
                    <Link href="/home" className="w-full">
                        <Button variant="secondary" className="w-full text-lg h-14 rounded-xl bg-transparent font-medium border-0 hover:border hover:border-border mt-2">
                            Voltar ao início
                        </Button>
                    </Link>
                </div>
            </Card>
        </main>
    );
}
