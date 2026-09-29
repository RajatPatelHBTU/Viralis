"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebConnection = void 0;
const ws_1 = require("ws");
const axios_1 = __importDefault(require("axios"));
const sdk_1 = require("@deepgram/sdk");
const generative_ai_1 = require("@google/generative-ai");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const mongoose_1 = __importDefault(require("mongoose"));
const Business_1 = require("../models/Business");
const voiceController_1 = require("./voiceController");
// Explicitly load .env from Backend root
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
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
// Helper: Fetch Brand Data from DB or fallback
async function fetchBrandData(brandId) {
    try {
        if (brandId && mongoose_1.default.isValidObjectId(brandId)) {
            const business = await Business_1.Business.findById(brandId);
            if (business) {
                return business.toObject();
            }
        }
    }
    catch (e) {
        console.warn('Mongoose fetchBrandData warning:', e);
    }
    try {
        const response = await axios_1.default.get(`${BACKEND_URL}/api/public/brand/${brandId}`, { timeout: 3000 });
        if (response.data)
            return response.data;
    }
    catch {
        // Continue to fallback
    }
    try {
        const anyBusiness = await Business_1.Business.findOne();
        if (anyBusiness)
            return anyBusiness.toObject();
    }
    catch { }
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
function createSystemPrompt(brand) {
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
function detectInterest(text) {
    const lowerText = text.toLowerCase();
    return INTEREST_PHRASES.some(phrase => lowerText.includes(phrase));
}
// Extract contact information from conversation log
function extractContactInfo(log) {
    const fullText = log.join(' ');
    let email;
    let phone;
    let name;
    const emailMatch = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch)
        email = emailMatch[0];
    const phoneMatch = fullText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10}\b/);
    if (phoneMatch)
        phone = phoneMatch[0];
    const nameMatch = fullText.match(/(?:my name is|i am|this is|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (nameMatch)
        name = nameMatch[1];
    return { email, phone, name };
}
// Main Handler
const handleWebConnection = async (ws, req) => {
    console.log('📞 New Voice Call Connection initiated');
    const callStartTime = Date.now();
    const conversationLog = [];
    let userInterested = false;
    // 1. Parse Params
    let brandId = null;
    try {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        brandId = url.searchParams.get('brandId');
    }
    catch {
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
    let chat = null;
    if (geminiKey) {
        try {
            const genAI = new generative_ai_1.GoogleGenerativeAI(geminiKey);
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
        }
        catch (err) {
            console.error('❌ Error initializing Gemini Chat:', err);
        }
    }
    // 4. Setup Deepgram STT if key is present
    let deepgram = null;
    let liveSTT = null;
    const pendingAudioChunks = [];
    let isSttOpen = false;
    if (deepgramKey) {
        try {
            deepgram = (0, sdk_1.createClient)(deepgramKey);
            liveSTT = deepgram.listen.live({
                model: 'nova-2',
                language: 'en-US',
                smart_format: true,
                encoding: 'linear16',
                sample_rate: 16000,
            });
            liveSTT.on(sdk_1.LiveTranscriptionEvents.Open, () => {
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
            liveSTT.on(sdk_1.LiveTranscriptionEvents.Transcript, async (data) => {
                const transcript = data.channel?.alternatives?.[0]?.transcript?.trim();
                if (transcript && data.is_final) {
                    console.log(`🗣️ User: ${transcript}`);
                    conversationLog.push(`User: ${transcript}`);
                    // Send user transcript back to client
                    if (ws.readyState === ws_1.WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'transcript', role: 'user', text: transcript }));
                    }
                    // Process with Gemini or fallback response
                    let responseText = '';
                    if (chat) {
                        try {
                            console.log(`➡️ Sending to Gemini: "${transcript}"`);
                            const result = await chat.sendMessage(transcript);
                            responseText = result.response.text();
                        }
                        catch (aiErr) {
                            console.error('Gemini error, attempting recovery:', aiErr);
                            responseText = `I understand. Regarding ${brand.name}, I can help you with services and pricing or connect you directly with our team.`;
                        }
                    }
                    else {
                        // Intelligent fallback response
                        if (detectInterest(transcript) || transcript.toLowerCase().includes('price') || transcript.toLowerCase().includes('cost')) {
                            responseText = `We'd love to help you with that! Our services start at very competitive rates and I can log your request right now. What's your name and best phone number?`;
                        }
                        else {
                            responseText = `Thank you for reaching out to ${brand.name}. How can I best assist you today?`;
                        }
                    }
                    if (!responseText)
                        return;
                    console.log(`🤖 AI Response: "${responseText}"`);
                    conversationLog.push(`AI: ${responseText}`);
                    // Detect user interest
                    const isNewInterest = detectInterest(responseText) || detectInterest(transcript);
                    if (isNewInterest) {
                        userInterested = true;
                        if (ws.readyState === ws_1.WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'interest_detected', interested: true }));
                        }
                    }
                    // Send AI transcript to client
                    if (ws.readyState === ws_1.WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'transcript', role: 'ai', text: responseText }));
                    }
                    // Generate TTS Audio via Deepgram
                    if (deepgram) {
                        try {
                            console.log('🗣️ Requesting TTS from Deepgram...');
                            const ttsResponse = await deepgram.speak.request({ text: responseText }, { model: 'aura-asteria-en' });
                            const stream = await ttsResponse.getStream();
                            if (stream) {
                                const reader = stream.getReader();
                                const chunks = [];
                                while (true) {
                                    const { done, value } = await reader.read();
                                    if (done)
                                        break;
                                    if (value)
                                        chunks.push(value);
                                }
                                const combinedBuffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
                                if (ws.readyState === ws_1.WebSocket.OPEN) {
                                    ws.send(combinedBuffer);
                                    console.log(`✅ Sent TTS Audio (${combinedBuffer.length} bytes) to client`);
                                }
                            }
                        }
                        catch (ttsErr) {
                            console.error('❌ TTS Generation Error:', ttsErr);
                            // Signal client to speak via Web Speech API fallback
                            if (ws.readyState === ws_1.WebSocket.OPEN) {
                                ws.send(JSON.stringify({ type: 'transcript', role: 'ai', text: responseText, speakFallback: true }));
                            }
                        }
                    }
                    else {
                        // Fallback speech for client
                        if (ws.readyState === ws_1.WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'transcript', role: 'ai', text: responseText, speakFallback: true }));
                        }
                    }
                }
            });
            liveSTT.on(sdk_1.LiveTranscriptionEvents.Error, (err) => {
                console.error('Deepgram STT Error:', err);
            });
            liveSTT.on(sdk_1.LiveTranscriptionEvents.Close, () => {
                console.log('Deepgram STT connection closed');
                isSttOpen = false;
            });
        }
        catch (dgErr) {
            console.error('❌ Error initializing Deepgram client:', dgErr);
        }
    }
    else {
        console.warn('⚠️ Running in fallback mode (GEMINI_API_KEY or DEEPGRAM_API_KEY not configured)');
    }
    // Send greeting to client on connection
    const welcomeGreeting = `Hello! Thank you for calling ${brand.name}. How can I help you today?`;
    conversationLog.push(`AI: ${welcomeGreeting}`);
    setTimeout(async () => {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'agent_status',
                status: 'ready',
                brandName: brand.name,
                hasLiveKeys
            }));
            // Try to send greeting audio if TTS available
            if (deepgram) {
                try {
                    const ttsResponse = await deepgram.speak.request({ text: welcomeGreeting }, { model: 'aura-asteria-en' });
                    const stream = await ttsResponse.getStream();
                    if (stream) {
                        const reader = stream.getReader();
                        const chunks = [];
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done)
                                break;
                            if (value)
                                chunks.push(value);
                        }
                        const combinedBuffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
                        if (ws.readyState === ws_1.WebSocket.OPEN) {
                            ws.send(combinedBuffer);
                        }
                    }
                }
                catch {
                    ws.send(JSON.stringify({ type: 'transcript', role: 'ai', text: welcomeGreeting, speakFallback: true }));
                }
            }
            else {
                ws.send(JSON.stringify({ type: 'transcript', role: 'ai', text: welcomeGreeting, speakFallback: true }));
            }
        }
    }, 500);
    // 5. Pipe Incoming Audio from Client
    ws.on('message', (data) => {
        const buf = Buffer.isBuffer(data)
            ? data
            : data instanceof ArrayBuffer
                ? Buffer.from(data)
                : Buffer.isBuffer(data?.buffer)
                    ? data.buffer
                    : null;
        if (buf) {
            if (liveSTT && isSttOpen && liveSTT.getReadyState() === 1) {
                liveSTT.send(buf);
            }
            else if (liveSTT) {
                // Buffer audio while STT connection is opening
                if (pendingAudioChunks.length < 50) {
                    pendingAudioChunks.push(buf);
                }
            }
        }
        else if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
                }
            }
            catch {
                console.log('📩 Received Text:', data);
            }
        }
    });
    // 6. Handle Call Close & Lead Capture
    ws.on('close', async () => {
        console.log('📴 Call Ended');
        if (liveSTT) {
            try {
                liveSTT.finish();
            }
            catch { }
        }
        const callDuration = Math.round((Date.now() - callStartTime) / 1000);
        console.log(`⏱️ Call Duration: ${callDuration}s`);
        console.log(`📋 Conversation log items: ${conversationLog.length}`);
        if (conversationLog.length === 0)
            return;
        // Auto-extract contact info from conversation
        const contact = extractContactInfo(conversationLog);
        const resolvedBusinessId = brand._id ? brand._id.toString() : brandId;
        try {
            console.log('💾 Auto-saving call lead and transcript...');
            const record = await voiceController_1.VoiceController.processCallRecord({
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
        }
        catch (err) {
            console.error('❌ Failed to process call record on close:', err);
        }
    });
};
exports.handleWebConnection = handleWebConnection;
//# sourceMappingURL=webCallController.js.map