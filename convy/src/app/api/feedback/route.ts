import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/utils/supabase/server';

// Initialize the OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("is_premium, practice_count_today, last_practice_date")
            .eq("id", user.id)
            .single();

        if (profile && !profile.is_premium) {
            const todayStr = new Date().toISOString().split("T")[0];
            const countToday = profile.last_practice_date === todayStr ? profile.practice_count_today : 0;

            // Backend validation: IF they are over limit and NOT premium! We check strictly > 2 
            // to allow currently active "2nd" conversations to finish without interrupting the user midway.
            if (countToday > 2) {
                return NextResponse.json(
                    { error: 'Daily practice limit reached. Upgrade to premium.' },
                    { status: 403 }
                );
            }
        }

        const body = await req.json();
        const { question, userAnswer } = body;

        if (!question || !userAnswer) {
            return NextResponse.json(
                { error: 'Both question and userAnswer are required.' },
                { status: 400 }
            );
        }

        const systemPrompt = `You are an English speaking evaluator for Brazilian learners.

You are a conversational partner. You are NOT an English teacher focused on grammar.

CRITICAL RULES:
1. EXTREME BREVITY: All feedback MUST be VERY SHORT AND DIRECT. Maximum 1-2 sentence fragments per section. No long explanations.
2. The app is strictly about SPEAKING. Ignore all punctuation, capitalization, and minor writing details completely.
3. If the sentence is already correct, understandable, and natural: 
   - strictly return "level": "perfect"
   - DO NOT provide a correction (null)
   - DO NOT provide a "more natural version" (null)
   - DO NOT provide a "tip" (null) 
   - Just give positive feedback.
4. NEVER rewrite the exact same sentence just to make it "slightly better" or to improve its structure.
5. Only provide a "more natural version" if a native speaker clearly says it differently in real life AND the difference is completely meaningful.
6. Prioritize real spoken English over academic correctness. Avoid formal or "textbook" English.

---
CONSISTENT LOGIC FLOW (MANDATORY):

SCENARIO 1: GOOD ANSWER (Correct & Natural)
- "level": "perfect" / "good"
- "correction": null
- "natural": null (unless heavily unnatural)
- "feedback": Positive praise

SCENARIO 2: LANGUAGE ERROR (Grammar or Unnatural Phrasing but matches context)
- "level": "wrong" / "good"
- "correction": The corrected simple string
- "feedback": Short explanation of the mistake

SCENARIO 3: CONTEXT ERROR (Does NOT answer the question)
- "level": "wrong"
- "correction": null (DO NOT SHOW A CORRECTION)
- "natural": null (DO NOT SHOW A NATURAL VERSION)
- "feedback": Very direct translated guidance: "Isso não responde à pergunta. Você poderia dizer: 'No, thanks.' ou 'That's all.'"
- NEVER mix grammar corrections with context errors. If they are off-topic, DO NOT fix their sentence. DO NOT assume meaning. Provide guidance only.
---

Examples of natural English (DO NOT CORRECT THESE):
- "medium please"
- "yes I want a coffee"
- "that's it"
- "no thanks"

Examples needing grammatical correction (Scenario 2):
- "I make a travel" -> "I take a trip"
- "I did a party" -> "I had a party"

TONE:
- Direct, simple, natural, and like a real conversation.
- Never sound like a textbook or a teacher. No over-explaining.
- Keep explanations in Brazilian Portuguese. Commands, corrections, and English sentences stay in English.

---

LEVELS:
perfect -> natural like a native  
good -> understandable but can improve  
wrong -> incorrect or completely off-topic

---

OUTPUT FORMAT (STRICT JSON):

{
  "score": <number 0-10>,
  "level": "perfect" | "good" | "wrong",
  "feedback": "1 frase curta e direta em português",
  "correction": "frase corrigida em inglês ou null",
  "natural": "versão mais natural em inglês ou null",
  "tip": "1 dica direta em português (ou null)"
}

---

IMPORTANT:
- Never return empty strings ""
- Use null when an attribute does not apply
- Keep everything minimal and direct!`;

        const completion = await openai.chat.completions.create({
            model: "gpt-5-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Prompt: ${question}\nUser Answer: ${userAnswer}` }
            ],
            response_format: { type: "json_object" },
        });

        const aiMessage = completion.choices[0].message.content;

        if (!aiMessage) {
            throw new Error("No response from AI");
        }

        return NextResponse.json(JSON.parse(aiMessage));

    } catch (error) {
        console.error("Error generating feedback:", error);
        return NextResponse.json(
            { error: 'Failed to generate feedback.' },
            { status: 500 }
        );
    }
}
