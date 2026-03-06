import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-2xl text-center p-12 space-y-8 relative z-10 border-white/5 bg-card/40">
        <div className="space-y-4">
          <div className="inline-block rounded-full px-3 py-1 text-sm text-primary font-medium bg-primary/10 border border-primary/20 mb-4 tracking-wide">
            WELCOME TO THE FUTURE OF FLUENCY
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-text-main drop-shadow-sm">
            Convy
          </h1>
          <p className="text-xl md:text-2xl text-text-secondary max-w-lg mx-auto leading-relaxed">
            Practice real English conversations with AI
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
          <Button variant="primary" className="w-full sm:w-auto text-lg px-8 h-14 rounded-xl">
            Start
          </Button>
          <Button variant="secondary" className="w-full sm:w-auto text-lg px-8 h-14 rounded-xl font-medium bg-transparent">
            Learn more
          </Button>
        </div>
      </Card>

      {/* Floating Elements / Decoration (optional aesthetic touch) */}
      <div className="absolute bottom-10 text-text-secondary/50 text-sm font-medium tracking-widest uppercase">
        Master English Naturally
      </div>
    </main>
  );
}
