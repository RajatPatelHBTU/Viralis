"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate30DayCalendar = generate30DayCalendar;
exports.generateDailyPost = generateDailyPost;
const generative_ai_1 = require("@google/generative-ai");
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
function buildPrompt(input) {
    const { niche, platform, city, description, brandName } = input;
    return `
    You are VIRALIS AI, an expert social media content strategist.
    Your task is to generate a detailed 30-day social media content calendar, returned as a valid JSON array.

    INPUTS:
    - Niche: "${niche}"
    - Platform: "${platform}"
    - Location: "${city}"
    - Brand Name: "${brandName || 'the brand'}"
    - Extra Description: "${description || 'No extra description provided.'}"

    REQUIREMENTS FOR EACH OF THE 30 DAYS:
    1.  day: day number (1–30)
    2.  hook: an attention-grabbing first line (max 10 words).
    3.  caption: a 50–120 word caption. It must be conversational and use emojis and clear line breaks for readability.
    4.  hashtags: an array of 8–12 relevant hashtags. Mix niche, local ("${city}"), and broad hashtags. Do not include spaces or '#' in the strings.
    5.  post_type: one of ["carousel", "reel", "story", "static"].
    6.  best_time: a human-readable time window in the local timezone (e.g., "6–8 PM", "11 AM - 1 PM").
    7.  cta: a short, clear call-to-action sentence.
    8.  visual_prompt: A TEXT description of the ideal visual for the post. This is a suggestion for a human designer, not for an image generation AI.

    THEMES TO FOLLOW:
    - Days 1–5: Focus on the brand's story, mission, and the 'why' behind the business.
    - Days 6–10: Highlight hero products/services, their benefits, and use cases.
    - Days 11–15: Show behind-the-scenes content, introduce the team, and explain the process.
    - Days 16–20: Use testimonials, social proof, and user-generated content (UGC) ideas.
    - Days 21–25: Provide educational tips, how-tos, and solve common problems for the audience.
    - Days 26–30: Focus on offers, promotions, and engaging content like polls, questions, or contests.

    OUTPUT FORMAT:
    Return ONLY a valid JSON array containing exactly 30 objects. Do not include any extra text, markdown, or explanations before or after the JSON array. The structure of each object must be:
    {
      "day": number,
      "hook": "string",
      "caption": "string",
      "hashtags": ["string"],
      "post_type": "carousel" | "reel" | "story" | "static",
      "best_time": "string",
      "cta": "string",
      "visual_prompt": "string"
    }
  `;
}
const CANDIDATE_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash"
];
function generateFallbackVariations(input) {
    const { niche, platform, city, description, brandName, date } = input;
    const brand = brandName || 'Viralis Studio';
    const cleanCity = city || 'your city';
    const cleanNiche = niche || 'lifestyle';
    const isReel = platform.toLowerCase().includes('reel');
    const contextPrefix = description ? `${description}\n\n` : '';
    return {
        viral: {
            day: (date || 1),
            hook: `Stop making this huge ${cleanNiche} mistake in ${cleanCity}! 🛑`,
            caption: `${contextPrefix}90% of people in ${cleanCity} get this completely wrong when starting out with ${cleanNiche}.\n\nHere is the real truth nobody talks about: focus on smart consistency, not burnout.\n\nSave this post so you don't forget it later! Tag someone who needs this wakeup call. 👇`,
            hashtags: [`#${cleanNiche.replace(/\s+/g, '')}`, `#${cleanCity.replace(/\s+/g, '')}Vibes`, '#ViralReel', '#TrendingNow', '#LifeHacks', '#ViralisAI'],
            post_type: isReel ? 'reel' : 'carousel',
            best_time: '7:30 PM - 9:00 PM',
            cta: `Comment "${cleanNiche.toUpperCase()}" below and we'll DM you our private checklist!`,
            visual_prompt: `High-energy dynamic visual highlighting the common mistake vs the right technique in ${cleanCity}.`,
            script: `Hook: You are probably doing this wrong every single day. Here is what actually works in 3 easy steps.`
        },
        reach: {
            day: 1,
            hook: `3 simple hacks to level up your ${cleanNiche} journey in ${cleanCity} 🚀`,
            caption: `Small daily adjustments create massive compound results.\n\n1. Master the fundamentals before chasing trends\n2. Track your weekly milestones\n3. Join a supportive community at ${brand}\n\nDouble tap if you are ready to make serious progress this week! 💯`,
            hashtags: [`#${cleanNiche.replace(/\s+/g, '')}Tips`, `#${cleanCity.replace(/\s+/g, '')}`, '#GrowthMindset', '#DailyRoutine', '#SuccessHacks', '#ProTips'],
            post_type: 'carousel',
            best_time: '12:30 PM - 2:00 PM',
            cta: 'Save this post to review during your next routine session!',
            visual_prompt: `Clean, multi-slide aesthetic carousel with bold typography and step-by-step pointers.`,
            script: `Three simple things I wish I knew when I first started in ${cleanCity}.`
        },
        niche: {
            day: 1,
            hook: `The ultimate deep-dive breakdown for ${cleanNiche} enthusiasts in ${cleanCity} 📊`,
            caption: `Let's break down the technical side of ${cleanNiche} that separates beginners from experts.\n\nAt ${brand}, we prioritize proven methodology and measurable results. Here are the core metrics and benchmarks you should be watching closely.\n\nWhat is your biggest hurdle right now? Let's discuss in the comments below!`,
            hashtags: [`#${cleanNiche.replace(/\s+/g, '')}Community`, `#${cleanCity.replace(/\s+/g, '')}Pros`, '#DeepDive', '#Mastery', '#ProGuidance', '#IndustrySecrets'],
            post_type: 'static',
            best_time: '9:00 AM - 10:30 AM',
            cta: 'Share your thoughts in the comments or send us a DM for a personalized roadmap!',
            visual_prompt: `Minimalist, authoritative infographic highlighting key benchmarks and structured guidelines.`,
            script: `A step-by-step masterclass on optimizing your ${cleanNiche} performance.`
        },
        platformPosts: {
            instagram: {
                day: (date || 1),
                platform: 'Instagram',
                hook: `The exact 5-step blueprint to master ${cleanNiche} in ${cleanCity} 📸`,
                caption: `${contextPrefix}Swipe through to discover how top performers approach ${cleanNiche} without getting overwhelmed.\n\nSlide 1: The core misconception\nSlide 2: What to eliminate this week\nSlide 3: The daily 15-minute protocol\nSlide 4: Key metric checklist\nSlide 5: Action summary\n\nDrop a ❤️ and save this post for your next session!`,
                hashtags: [`#${cleanNiche.replace(/\s+/g, '')}`, `#${cleanCity.replace(/\s+/g, '')}Creators`, '#InstagramGrowth', '#CarouselPost', '#ViralContent', '#InstaTips'],
                post_type: 'carousel',
                best_time: '11:00 AM - 1:00 PM',
                cta: 'Bookmark this carousel to revisit anytime!',
                visual_prompt: `5-slide seamless carousel design: Slide 1 bold headline with gradient background, Slides 2-4 clean infographics with bullet points, Slide 5 bold CTA banner.`
            },
            reels: {
                day: (date || 1),
                platform: 'Instagram Reels',
                hook: `POV: You stopped doing random ${cleanNiche} routines in ${cleanCity} and tried this instead 🎬`,
                caption: `Stop overcomplicating your progress! This 30-second breakdown is the secret.\n\nTrending audio recommendation: Fast upbeat lofi beat.\n\nTag your workout/accountability partner below! 👇`,
                hashtags: [`#${cleanNiche.replace(/\s+/g, '')}Reel`, `#${cleanCity.replace(/\s+/g, '')}Fitness`, '#ReelsTrending', '#ViralAudio', '#ReelOfTheDay', '#FYP'],
                post_type: 'reel',
                best_time: '6:30 PM - 8:30 PM',
                cta: 'Follow for daily high-impact reels!',
                visual_prompt: `Dynamic 9:16 vertical video. Fast transitions every 2.5 seconds with prominent neon on-screen subtitles and b-roll action footage.`,
                script: `[0-3s Hook]: Stop scrolling if you do ${cleanNiche} in ${cleanCity}!\n[3-10s The Flaw]: 90% of people focus on the wrong variable and waste months.\n[10-20s The Shift]: Here is what you should do instead starting today.\n[20-30s CTA]: Try this for 7 days and see the difference. Follow for more daily routines!`
            },
            facebook: {
                day: (date || 1),
                platform: 'Facebook',
                hook: `Quick question for our ${cleanCity} community: what's your biggest hurdle with ${cleanNiche}? 💬`,
                caption: `${contextPrefix}We were talking with several members here in ${cleanCity} this week, and one common theme kept coming up: staying consistent when life gets busy.\n\nHere are 3 small habits that make a world of difference:\n1. Schedule your sessions like non-negotiable appointments.\n2. Keep your prep routine under 5 minutes.\n3. Celebrate small weekly wins instead of waiting for months.\n\nWe'd love to hear your perspective — how do you handle busy days? Drop your thoughts below! 👇`,
                hashtags: [`#${cleanCity}Community`, `#${cleanNiche.replace(/\s+/g, '')}Discussion`, '#CommunityFirst', '#LocalBusiness', '#DailyInspiration'],
                post_type: 'static',
                best_time: '1:00 PM - 3:00 PM',
                cta: 'Join the conversation in the comments below!',
                visual_prompt: `Authentic, relatable photo of real community members in ${cleanCity} engaged in session or workshop.`
            },
            linkedin: {
                day: (date || 1),
                platform: 'LinkedIn',
                hook: `Most people treat ${cleanNiche} as a hobby. The top 1% treat it as an optimization system. 💼`,
                caption: `${contextPrefix}Over the past year analyzing performance in ${cleanCity}, one pattern stands out clearly:\n\nSuccess isn't about brute force. It's about systemic execution.\n\n📌 3 Core Takeaways:\n• Inputs matter more than outcomes: Focus on daily cadence.\n• Friction reduction: Remove decision fatigue before you start.\n• Feedback loops: What gets measured gets managed.\n\nThe framework is simple, but execution requires discipline.\n\nAgree or disagree? What's your framework for sustainable progress?\n\n♻️ Repost if you found this perspective insightful.`,
                hashtags: [`#${cleanNiche.replace(/\s+/g, '')}`, '#Leadership', '#SystemicThinking', '#Productivity', '#ProfessionalGrowth', '#B2BStrategy'],
                post_type: 'carousel',
                best_time: '8:00 AM - 10:00 AM',
                cta: 'Follow for weekly strategic breakdowns and repost to your network.',
                visual_prompt: `Minimalist, dark-mode PDF document presentation slide deck. Clean Swiss typography with structured bullet icons and executive color palette.`
            }
        }
    };
}
function generateFallbackCalendar(input) {
    const { niche, platform, city, brandName } = input;
    const cleanNiche = niche || 'business';
    const cleanCity = city || 'your city';
    const isReel = platform.toLowerCase().includes('reel');
    const calendar = [];
    for (let i = 1; i <= 30; i++) {
        calendar.push({
            day: i,
            hook: `Day ${i}: Proven ${cleanNiche} breakthrough in ${cleanCity} 🔥`,
            caption: `Consistency is the secret weapon of high achievers in ${cleanCity}. Today we're breaking down actionable tactic #${i} to help you grow with ${brandName || 'our brand'}.\n\nDrop a comment if you are with us!`,
            hashtags: [`#${cleanNiche.replace(/\s+/g, '')}`, `#${cleanCity.replace(/\s+/g, '')}`, '#DailyGrowth', '#ViralisAI', '#Trending'],
            post_type: isReel ? (i % 2 === 0 ? 'reel' : 'carousel') : (i % 3 === 0 ? 'carousel' : 'static'),
            best_time: '6:00 PM - 8:00 PM',
            cta: 'Tap follow for daily actionable insights!',
            visual_prompt: `Bold, eye-catching visual showcasing tip #${i} with high contrast layout.`
        });
    }
    return calendar;
}
/**
 * Generates a 30-day social media calendar using the Gemini API with fallback.
 */
async function generate30DayCalendar(input) {
    const prompt = buildPrompt(input);
    for (const modelName of CANDIDATE_MODELS) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const parsedJson = JSON.parse(jsonMatch[0]);
                if (Array.isArray(parsedJson) && parsedJson.length === 30) {
                    console.log(`✅ Generated 30-day calendar using ${modelName}`);
                    return parsedJson;
                }
            }
        }
        catch (err) {
            console.warn(`Model ${modelName} calendar generation failed: ${err.message}. Trying next model...`);
        }
    }
    console.warn("Using fallback calendar generator due to AI service limits.");
    return generateFallbackCalendar(input);
}
function buildDailyPrompt(input) {
    const { niche, platform, city, description, brandName, date, context } = input;
    return `
    You are VIRALIS AI, an expert social media content strategist.
    Your task is to generate social media post strategy variations AND platform-specific posts for a specific date, tailored to the brand's positioning and recent performance.

    INPUTS:
    - Target Date: "${date}"
    - Brand: "${brandName || 'the brand'}" (${niche})
    - Platform: "${platform}"
    - Location: "${city}"
    - Extra Context: "${description || ''}"

    STRATEGIC CONTEXT:
    - Brand Positioning: "${context.brandPositioning}"
    - Recent Performance: "${context.recentStats}"

    GENERATE:
    1. 3 Strategy Variations:
       - "viral": High energy, controversial or surprising hook, short & punchy caption.
       - "reach": Broad appeal, relatable content, uses trending audio/concepts.
       - "niche": Deep dive, industry specific, educational authority.
    2. 4 Tailored Platform Posts in "platformPosts":
       - "instagram": Optimized for Instagram Feed & multi-slide Carousel.
       - "reels": High-impact 30s video script with visual cues and audio prompt.
       - "facebook": Conversational, community discussion starter.
       - "linkedin": Professional authority, formatted with clear bullets and strategic takeaways.

    OUTPUT FORMAT:
    Return ONLY a valid JSON object with keys "viral", "reach", "niche", and "platformPosts". Do not include markdown codeblocks or preamble. Structure:
    {
      "viral": {
        "day": "${date}",
        "hook": "string",
        "caption": "string",
        "hashtags": ["string"],
        "post_type": "carousel" | "reel" | "story" | "static",
        "best_time": "string",
        "cta": "string",
        "visual_prompt": "string",
        "script": "string"
      },
      "reach": { ...same structure },
      "niche": { ...same structure },
      "platformPosts": {
        "instagram": { ...same structure },
        "reels": { ...same structure, "script": "string" },
        "facebook": { ...same structure },
        "linkedin": { ...same structure }
      }
    }
  `;
}
async function generateDailyPost(input) {
    const prompt = buildDailyPrompt(input);
    for (const modelName of CANDIDATE_MODELS) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsedJson = JSON.parse(jsonMatch[0]);
                if (parsedJson.viral && parsedJson.reach && parsedJson.niche) {
                    console.log(`✅ Generated daily post variations using ${modelName}`);
                    return parsedJson;
                }
            }
        }
        catch (error) {
            console.warn(`Model ${modelName} failed for daily post: ${error.message}. Trying next candidate...`);
        }
    }
    console.warn("Using smart fallback post variations generator.");
    return generateFallbackVariations(input);
}
//# sourceMappingURL=aiContentService.js.map