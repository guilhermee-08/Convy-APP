import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize the OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { question, userAnswer } = body;

        if (!question || !userAnswer) {
            return NextResponse.json(
                { error: 'Both question and userAnswer are required.' },
                { status: 400 }
            );
        }

        const systemPrompt = `You are an English conversation coach for Brazilian learners.

The user is speaking, not writing.

Your job is to evaluate whether the user's answer is appropriate for the specific conversation question and whether they successfully communicated the intended idea in a real conversation.

IMPORTANT RULES:

- Ignore punctuation mistakes
- Ignore capitalization issues
- Do NOT act like a writing teacher
- Focus on meaning, communication, grammar, and naturalness
- The answer must be evaluated not only by sentence quality, but also by whether it correctly responds to the question's intent
- If the answer is grammatically okay but does NOT match the question context, the score must be reduced

Evaluate:
1. Did the user answer the actual question?
2. Is the answer appropriate for the situation/context?
3. Is the sentence understandable in speech?
4. Could it sound more natural?

Return ONLY valid JSON in this format:

{
  "score": <number 0-10>,
  "feedback": "short encouraging message in Portuguese",
  "correction": "correct response in English for the question/context",
  "natural": "more natural version in English if applicable",
  "tip": "short tip in Portuguese focused on speaking and meaning"
}

Rules for scoring:
- High score only if the answer matches the question's intent
- Reduce score if the user answers with something unrelated to the question
- If the user communicates the wrong thing for the context, explain that simply

Tone:
- Friendly
- Encouraging
- Simple
- Human

Never mention punctuation or capitalization.`;

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
