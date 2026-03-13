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
  "correction": "The corrected version of their answer in English, fixing any grammatical or spelling errors.",
  "natural": "A slightly more natural, native-like way to say what they meant in English.",
  "score": "A score out of 10 evaluating their answer based on grammar and appropriateness (e.g. '8/10').",
  "shortFeedback": "A very brief, practical 1-sentence explanation IN PORTUGUESE of what was wrong, accompanied by a quick motivational message IN PORTUGUESE. Example: 'Você escreveu \"coffe\", mas o correto é \"coffee\". Boa tentativa!'",
  "microFeedback": "A very short, natural 1-3 word acknowledgement in English with an emoji (e.g., '👍 Great answer.', '👍 Perfect.', '👍 Nice.', '👍 Almost there.')."
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
