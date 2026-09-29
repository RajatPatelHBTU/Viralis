import { WebSocket } from 'ws';
import { Request } from 'express';
import axios from 'axios';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { Business } from '../models/Business';
import { VoiceController } from './voiceController';

// Explicitly load .env from Backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PORT = process.env.PORT || 5000;
const BACKEND_URL = process.env.BACKEND_URL || `http://127.0.0.1:${PORT}`;

// Phrases that indicate user interest/intent to connect
const INTEREST_PHRASES = [
    "connect you",
    "someone will call",
    "call you back",
    "schedule",
    "appointment",
    "book",
    "leave your details",
    "drop your details",
    "get back to you",
    "take a message",
    "our team will",
    "provide your details",
    "logged your request",
    "follow up"
];


interface BrandData {
    _id?: any;
    name: string;
    description?: string;
    industryMode?: string;
    businessHours?: string;
    brandVoice?: {
        tone?: string;
    };
    apiKeys?: {
        gemini?: string;
        deepgram?: string;
        twilio?: string;
    };
    knowledgeBase?: {
        services?: Array<{ name: string; price: string }>;
        customInstructions?: string;
        contactPhone?: string;
        businessHours?: string;
        address?: string;
    };
    location?: {
        address?: string;
        city?: string;
        country?: string;
    };
}

// Helper: Fetch Brand Data from DB or fallback
async function fetchBrandData(brandId: string): Promise<BrandData> {
    try {
        if (brandId && mongoose.isValidObjectId(brandId)) {
            const business = await Business.findById(brandId);
            if (business) {
                return business.toObject() as BrandData;
            }
        }
    } catch (e) {
        console.warn('Mongoose fetchBrandData warning:', e);
    }

    try {
        const response = await axios.get(`${BACKEND_URL}/api/public/brand/${brandId}`, { timeout: 3000 });
        if (response.data) return response.data;
    } catch {
        // Continue to fallback
    }

    try {
        const anyBusiness = await Business.findOne();
        if (anyBusiness) return anyBusiness.toObject() as BrandData;
    } catch {}

    return {
        name: 'Viralis AI Assistant',
        description: 'AI-Powered Business & Customer Service Assistant',
        industryMode: 'Customer Service',
        businessHours: 'Monday-Sunday: 24/7',
        brandVoice: { tone: 'Professional, warm, and helpful' },
        knowledgeBase: {
            services: [
                { name: 'Standard Consultation', price: '$99' },
                { name: 'Full Service Package', price: '$299/mo' }
            ],
            customInstructions: 'Help the caller answer questions and take down their inquiries seamlessly.',
            businessHours: '24/7'
        }
    };
}

// Helper: Construct System Prompt
function createSystemPrompt(brand: BrandData): string {
    const kb = brand.knowledgeBase || {};
    const servicesList = kb.services && kb.services.length > 0
        ? kb.services.map(s => `- ${s.name}: ${s.price}`).join('\n')
        : 'Consultations and custom service packages.';

    const toneInstruction = brand.brandVoice?.tone
        ? `Tone: Adopt a ${brand.brandVoice.tone} persona.`
        : 'Tone: Professional, warm, and conversational.';

    const industryContext = brand.industryMode
        ? `Industry: ${brand.industryMode}`
        : '';

    const businessDesc = brand.description
        ? `About Business: ${brand.description}`
        : '';

    return `
Role: You are the voice AI receptionist and customer representative for ${brand.name}.
${industryContext}
${businessDesc}
${toneInstruction}

Context: ${kb.customInstructions || 'Be helpful, engaging, and friendly.'}

Facts:
- Business Hours: ${kb.businessHours || brand.businessHours || 'Open daily'}
- Address: ${kb.address || brand.location?.address || 'Available online and locally'} ${brand.location?.city ? `(${brand.location.city})` : ''}
- Contact / Handoff Phone: ${kb.contactPhone || 'Available upon request'}

Services & Pricing:
${servicesList}

Conversational Guidelines:
- Keep spoken responses natural and concise (1-2 sentences).
- Speak directly and clearly like a real person over a phone call.
- Provide accurate pricing and info from the facts above; never fabricate details.
- When the caller wants to book, schedule, purchase, or connect:
  * Handle it smoothly and enthusiastically in conversation!
  * Do NOT ask for permission every time to submit their request.
  * Do NOT tell them to fill out a website form.
  * Naturally ask for their name and phone number or email so the team can confirm their booking or connect with them.
  * Once they provide any details, confirm immediately: "Perfect, I've logged your request and our team will get back to you shortly!"
- If they ask something outside your knowledge, offer to take down their message and contact info.
- Keep the conversation flowing without awkward pauses or robotic permission checks.
    `.trim();
}

function detectInterest(text: string): boolean {
    const lowerText = text.toLowerCase();
    return INTEREST_PHRASES.some(phrase => lowerText.includes(phrase));
}

// Extract contact information from conversation log
function extractContactInfo(log: string[]) {
    const fullText = log.join(' ');
    let email: string | undefined;
    let phone: string | undefined;
    let name: string | undefined;

    const emailMatch = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) email = emailMatch[0];

    const phoneMatch = fullText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10}\b/);
    if (phoneMatch) phone = phoneMatch[0];

    const nameMatch = fullText.match(/(?:my name is|i am|this is|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (nameMatch) name = nameMatch[1];

    return { email, phone, name };
}

// Main Handler
export const handleWebConnection = async (ws: WebSocket, req: Request) => {
    console.log('📞 New Voice Call Connection initiated');

    const callStartTime = Date.now();
    const conversationLog: string[] = [];
    let userInterested = false;

    // 1. Parse Params
    let brandId: string | null = null;
    try {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        brandId = url.searchParams.get('brandId');
    } catch {
        brandId = null;
    }

    if (!brandId) {
        console.warn('⚠️ No brandId in query, attempting default business');
    }

    // 2. Fetch Brand Data
    const brand = await fetchBrandData(brandId || '');
    console.log(`✅ Loaded Persona: ${brand.name}`);

    // Resolve API Keys
    const geminiKey = process.env.GEMINI_API_KEY || brand.apiKeys?.gemini;
    const deepgramKey = process.env.DEEPGRAM_API_KEY || brand.apiKeys?.deepgram;

    const hasLiveKeys = Boolean(geminiKey && deepgramKey);

    // 3. Setup Gemini if key is present
    let chat: any = null;
    if (geminiKey) {
        try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            // gemini-1.5-flash is fast and low-latency for voice
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            chat = model.startChat({
                history: [
                    {
                        role: 'user',
                        parts: [{ text: createSystemPrompt(brand) }]
                    },
                    {
                        role: 'model',
                        parts: [{ text: `Hello! Thanks for calling ${brand.name}. How can I assist you today?` }]
                    }
                ]
            });
            console.log('🤖 Gemini Chat Session initialized');
        } catch (err) {
            console.error('❌ Error initializing Gemini Chat:', err);
        }
    }

    // 4. Setup Deepgram STT if key is present
    let deepgram: any = null;
    let liveSTT: any = null;
    const pendingAudioChunks: Buffer[] = [];
    let isSttOpen = false;

    // Handler for processing user speech from any source (Deepgram STT or Browser STT)
    let isProcessingUtterance = false;
    let lastProcessedTranscript = '';
    let lastProcessedAt = 0;

    const handleUserUtterance = async (rawText: string) => {
        const transcript = rawText.trim();
        if (!transcript || transcript.length < 2) return;

        const now = Date.now();
        // Prevent duplicate processing of the same phrase within 2.5 seconds
        if (isProcessingUtterance || (transcript.toLowerCase() === lastProcessedTranscript.toLowerCase() && now - lastProcessedAt < 2500)) {
            return;
        }

        isProcessingUtterance = true;
        lastProcessedTranscript = transcript;
        lastProcessedAt = now;

        try {
            console.log(`🗣️ User: "${transcript}"`);
            conversationLog.push(`User: ${transcript}`);

            // Send user transcript back to client immediately
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'transcript', role: 'user', text: transcript }));
            }

            // Process with Gemini or fallback response
            let responseText = '';
            if (geminiKey) {
                try {
                    if (chat) {
                        console.log(`➡️ Sending to Gemini chat: "${transcript}"`);
                        const result = await chat.sendMessage(transcript);
                        responseText = result.response.text();
                    } else {
                        const genAI = new GoogleGenerativeAI(geminiKey);
                        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                        const result = await model.generateContent([
                            createSystemPrompt(brand),
                            `User question: ${transcript}\nRespond concisely in 1-2 spoken sentences:`
                        ]);
                        responseText = result.response.text();
                    }
                } catch (aiErr) {
                    console.error('Gemini error, attempting single-shot recovery:', aiErr);
                    try {
                        const genAI = new GoogleGenerativeAI(geminiKey);
                        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                        const result = await model.generateContent([
                            createSystemPrompt(brand),
                            `User question: ${transcript}\nRespond concisely in 1 spoken sentence:`
                        ]);
                        responseText = result.response.text();
                    } catch (fallbackErr) {
                        console.error('Gemini recovery also failed:', fallbackErr);
                    }
                }
            }

            if (!responseText) {
                // Intelligent fallback response
                if (detectInterest(transcript) || transcript.toLowerCase().includes('price') || transcript.toLowerCase().includes('cost')) {
                    responseText = `We'd love to help you with that! Our services start at very competitive rates and I can log your request right now. What's your name and best phone number?`;
                } else if (transcript.toLowerCase().includes('hour') || transcript.toLowerCase().includes('open') || transcript.toLowerCase().includes('time')) {
                    responseText = `We are open ${brand.businessHours || brand.knowledgeBase?.businessHours || 'daily'}. How can I assist you further?`;
                } else {
                    responseText = `Thank you for asking. Regarding ${brand.name}, I can help you with our services, answer any questions, or connect you with our team!`;
                }
            }

            console.log(`🤖 AI Response: "${responseText}"`);
            conversationLog.push(`AI: ${responseText}`);

            // Detect user interest
            const isNewInterest = detectInterest(responseText) || detectInterest(transcript);
            if (isNewInterest) {
                userInterested = true;
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'interest_detected', interested: true }));
                }
            }

            // Send AI transcript to client immediately
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'transcript', role: 'ai', text: responseText }));
            }

            // Generate TTS Audio via Deepgram if available
            let ttsSent = false;
            if (deepgram) {
                try {
                    console.log('🗣️ Requesting TTS from Deepgram...');
                    const ttsResponse = await deepgram.speak.request(
                        { text: responseText },
                        { model: 'aura-asteria-en' }
                    );

                    const stream = await ttsResponse.getStream();
                    if (stream) {
                        const reader = stream.getReader();
                        const chunks: Uint8Array[] = [];

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            if (value) chunks.push(value);
                        }

                        const combinedBuffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
                        if (combinedBuffer.length > 0 && ws.readyState === WebSocket.OPEN) {
                            ws.send(combinedBuffer);
                            ttsSent = true;
                            console.log(`✅ Sent TTS Audio (${combinedBuffer.length} bytes) to client`);
                        }
                    }
                } catch (ttsErr) {
                    console.error('❌ TTS Generation Error:', ttsErr);
                }
            }

            // Fallback to browser SpeechSynthesis if Deepgram audio was not sent
            if (!ttsSent && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'speak_text', text: responseText }));
            }
        } finally {
            isProcessingUtterance = false;
        }
    };

    if (deepgramKey) {
        try {
            deepgram = createClient(deepgramKey);
            liveSTT = deepgram.listen.live({
                model: 'nova-2',
                language: 'en-US',
                smart_format: true,
                encoding: 'linear16',
                sample_rate: 16000,
                endpointing: 300,
                interim_results: true,
                utterance_end_ms: 1000,
                vad_events: true,
            });

            liveSTT.on(LiveTranscriptionEvents.Open, () => {
                console.log('🎤 Deepgram STT Connected & Listening');
                isSttOpen = true;

                // Flush pending buffered audio chunks
                while (pendingAudioChunks.length > 0) {
                    const chunk = pendingAudioChunks.shift();
                    if (chunk && liveSTT.getReadyState() === 1) {
                        liveSTT.send(chunk);
                    }
                }
            });

            let accumulatedUtterance = '';
            let silenceTimer: NodeJS.Timeout | null = null;

            const triggerUtterance = async () => {
                if (silenceTimer) {
                    clearTimeout(silenceTimer);
                    silenceTimer = null;
                }
                const toProcess = accumulatedUtterance.trim();
                accumulatedUtterance = '';
                if (toProcess.length > 1) {
                    await handleUserUtterance(toProcess);
                }
            };

            liveSTT.on(LiveTranscriptionEvents.Transcript, async (data: any) => {
                const transcript = data.channel?.alternatives?.[0]?.transcript?.trim();
                const isSpeechFinal = Boolean(data.speech_final);
                const isFinal = Boolean(data.is_final);

                if (transcript) {
                    if (isSpeechFinal) {
                        accumulatedUtterance = accumulatedUtterance ? `${accumulatedUtterance} ${transcript}`.trim() : transcript;
                        await triggerUtterance();
                    } else if (isFinal) {
                        accumulatedUtterance = accumulatedUtterance ? `${accumulatedUtterance} ${transcript}`.trim() : transcript;
                        // Reset silence debounce timer
                        if (silenceTimer) clearTimeout(silenceTimer);
                        silenceTimer = setTimeout(() => {
                            triggerUtterance();
                        }, 1200);
                    }
                }
            });

            liveSTT.on(LiveTranscriptionEvents.UtteranceEnd, async () => {
                await triggerUtterance();
            });

            liveSTT.on(LiveTranscriptionEvents.Error, (err: any) => {
                console.error('Deepgram STT Error:', err);
            });

            liveSTT.on(LiveTranscriptionEvents.Close, () => {
                console.log('Deepgram STT connection closed');
                isSttOpen = false;
            });

        } catch (dgErr) {
            console.error('❌ Error initializing Deepgram client:', dgErr);
        }
    } else {
        console.warn('⚠️ Running in fallback mode (GEMINI_API_KEY or DEEPGRAM_API_KEY not configured)');
    }

    // Send greeting to client on connection
    const welcomeGreeting = `Hello! Thank you for calling ${brand.name}. How can I help you today?`;
    conversationLog.push(`AI: ${welcomeGreeting}`);

    setTimeout(async () => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'agent_status',
                status: 'ready',
                brandName: brand.name,
                hasLiveKeys
            }));

            // Try to send greeting audio if TTS available
            if (deepgram) {
                try {
                    const ttsResponse = await deepgram.speak.request(
                        { text: welcomeGreeting },
                        { model: 'aura-asteria-en' }
                    );
                    const stream = await ttsResponse.getStream();
                    if (stream) {
                        const reader = stream.getReader();
                        const chunks: Uint8Array[] = [];
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            if (value) chunks.push(value);
                        }
                        const combinedBuffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(combinedBuffer);
                        }
                    }
                } catch {
                    ws.send(JSON.stringify({ type: 'transcript', role: 'ai', text: welcomeGreeting, speakFallback: true }));
                }
            } else {
                ws.send(JSON.stringify({ type: 'transcript', role: 'ai', text: welcomeGreeting, speakFallback: true }));
            }
        }
    }, 500);

    // 5. Pipe Incoming Audio and Speech from Client
    ws.on('message', async (data: any, isBinary: boolean) => {
        let isTextJson = false;

        // Check if message is a JSON string or text buffer
        if (typeof data === 'string' || (!isBinary && Buffer.isBuffer(data) && data.length < 2000)) {
            try {
                const textStr = typeof data === 'string' ? data : data.toString('utf8');
                if (textStr.trim().startsWith('{')) {
                    const parsed = JSON.parse(textStr);
                    isTextJson = true;

                    if (parsed.type === 'ping') {
                        ws.send(JSON.stringify({ type: 'pong' }));
                    } else if ((parsed.type === 'user_speech' || parsed.type === 'speech' || parsed.type === 'transcript') && parsed.text) {
                        console.log(`🎤 Received speech from client: "${parsed.text}"`);
                        await handleUserUtterance(parsed.text);
                    }
                }
            } catch {
                // Not JSON, fall through to audio buffer processing
            }
        }

        if (isTextJson) return;

        // Process Binary Audio Chunks for Deepgram STT
        let buf: Buffer | null = null;
        if (Buffer.isBuffer(data)) {
            buf = data;
        } else if (data instanceof ArrayBuffer) {
            buf = Buffer.from(data);
        } else if (ArrayBuffer.isView(data)) {
            buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
        }

        if (buf && buf.length > 0) {
            if (liveSTT && isSttOpen && liveSTT.getReadyState() === 1) {
                liveSTT.send(buf);
            } else if (liveSTT) {
                if (pendingAudioChunks.length < 50) {
                    pendingAudioChunks.push(buf);
                }
            }
        }
    });

    // 6. Handle Call Close & Lead Capture
    ws.on('close', async () => {
        console.log('📴 Call Ended');
        if (liveSTT) {
            try {
                liveSTT.finish();
            } catch {}
        }

        const callDuration = Math.round((Date.now() - callStartTime) / 1000);
        console.log(`⏱️ Call Duration: ${callDuration}s`);
        console.log(`📋 Conversation log items: ${conversationLog.length}`);

        if (conversationLog.length === 0) return;

        // Auto-extract contact info from conversation
        const contact = extractContactInfo(conversationLog);
        const resolvedBusinessId = brand._id ? brand._id.toString() : brandId;

        try {
            console.log('💾 Auto-saving call lead and transcript...');
            const record = await VoiceController.processCallRecord({
                businessId: resolvedBusinessId || undefined,
                brandId: resolvedBusinessId || undefined,
                callerNumber: contact.phone || 'web-call',
                callerName: contact.name || 'Web Caller',
                email: contact.email || '',
                transcript: conversationLog.join('\n'),
                duration: callDuration,
                sentiment: userInterested ? 'positive' : 'neutral',
                status: 'completed',
                userInterested: userInterested,
                notes: userInterested
                    ? 'High-intent lead: Caller discussed scheduling or services during AI Voice Call.'
                    : 'AI Voice Call interaction record'
            });
            console.log('✅ Call lead record processed successfully:', record?.lead?._id);
        } catch (err) {
            console.error('❌ Failed to process call record on close:', err);
        }
    });
};

