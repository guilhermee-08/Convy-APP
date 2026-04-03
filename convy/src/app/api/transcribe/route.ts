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

        // Derive correct extension from actual blob type (Safari sends mp4, Chrome sends webm)
        const blobType = file.type || 'audio/webm';
        const ext = blobType.includes('mp4') ? 'mp4' : 'webm';
        const fileName = `recording.${ext}`;

        console.log(`[Transcribe] Size: ${file.size} bytes | Type: ${blobType} | File: ${fileName}`);

        const audioFile = new File([file], fileName, { type: blobType });

        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: "gpt-4o-mini-transcribe",
            language: "en",
            prompt: "Medium please. No thanks. I'd like a coffee. Yes, that's all. My name is Guilherme.",
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
