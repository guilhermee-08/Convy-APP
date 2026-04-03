import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as Blob;

        if (!file) {
            return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
        }

        console.log(`Transcribing audio file blob... Size: ${file.size} bytes`);

        // Note: The OpenAI SDK typically expects a File object natively with a name
        const audioFile = new File([file], 'recording.webm', { type: file.type || 'audio/webm' });

        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: "gpt-4o-mini-transcribe", // As explicitly demanded by User (overriding whisper-1)
        });

        console.log("Transcription successful:", transcription.text);

        return NextResponse.json({ text: transcription.text });

    } catch (error: any) {
        console.error("Transcription Route Error:", error);
        return NextResponse.json(
            { error: 'Failed to transcribe audio', details: error.message },
            { status: 500 }
        );
    }
}
