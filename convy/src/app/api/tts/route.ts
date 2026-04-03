import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    try {
        const { text } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        // Limit TTS strictly to short texts to prevent long generation blocks per UX rules
        if (text.length > 350) {
            console.log("TTS blocked: Text too long for voice generation loop.");
            return NextResponse.json({ error: 'Text too long for TTS' }, { status: 400 });
        }

        console.log(`Generating TTS for text: "${text.substring(0, 30)}..."`);

        const mp3 = await openai.audio.speech.create({
            model: "gpt-4o-mini-tts", // As explicitly requested by User
            voice: "alloy",
            input: text,
            response_format: "mp3"
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());

        console.log("TTS generation successful. Returning audio/mpeg buffer.");

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': buffer.length.toString(),
            },
        });

    } catch (error: any) {
        console.error("TTS Route Error:", error);
        return NextResponse.json(
            { error: 'Failed to generate speech', details: error.message },
            { status: 500 }
        );
    }
}
