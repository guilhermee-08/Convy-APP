import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize the OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { text } = body;

        if (!text) {
            return NextResponse.json(
                { error: 'Text is required.' },
                { status: 400 }
            );
        }

        const systemPrompt = `You are a helpful English language tutor for a language learning app.
The user needs a translation of an English sentence into Portuguese, along with a tiny vocabulary breakdown.

You MUST respond with a JSON object exactly matching this structure:
{
  "translation": "The direct Portuguese translation of the sentence.",
  "vocabulary": [
    { "word": "English word 1", "translation": "Portuguese meaning in this context" },
    { "word": "English word 2", "translation": "Portuguese meaning in this context" }
  ]
}

Rules for vocabulary:
- Keep explanations simple and beginner-friendly.
- Extract exactly 2 or 3 of the most important or difficult words/phrases from the sentence.
- Do not extract every word. Just the key ones that help understand the sentence.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-5-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Sentence: ${text}` }
            ],
            response_format: { type: "json_object" },
        });

        const aiMessage = completion.choices[0].message.content;

        if (!aiMessage) {
            throw new Error("No response from AI");
        }

        return NextResponse.json(JSON.parse(aiMessage));

    } catch (error) {
        console.error("Error generating translation:", error);
        return NextResponse.json(
            { error: 'Failed to generate translation.' },
            { status: 500 }
        );
    }
}
