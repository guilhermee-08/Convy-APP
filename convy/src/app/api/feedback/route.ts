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

        const systemPrompt = `You are a helpful and concise English language tutor for a language learning app.
The user is responding to a conversational prompt.

Evaluate the user's answer.
You MUST respond with a JSON object exactly matching this structure:
{
  "correction": "The corrected version of their answer, fixing any grammatical or spelling errors (if perfect, just repeat their answer).",
  "natural": "A slightly more natural, native-like way to say what they meant (or the same if their answer is already highly natural).",
  "score": "A score out of 10 evaluating their answer based on grammar and appropriateness (e.g. '8/10').",
  "shortFeedback": "A very brief, encouraging 1-sentence tip on why the correction/natural version is better or praising them if it's perfect."
}`;

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
