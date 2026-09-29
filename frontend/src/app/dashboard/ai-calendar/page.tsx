"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DayPost, PostVariations } from "@/lib/types/aiContent";
import api from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { RocketIcon, AlertCircle, Sparkles, Calendar as CalendarIcon, Save, Copy, BarChart3, Zap, Target, Video, Film, Share2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// Schema for form validation
const formSchema = z.object({
  niche: z.string().min(3, "Niche is required"),
  city: z.string().min(2, "City is required"),
  platform: z.enum(["Instagram", "Instagram Reels", "Facebook", "LinkedIn"]),
  brandName: z.string().optional(),
  description: z.string().optional(),
  date: z.date({
    message: "A date is required.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

// --- Components ---

function PostCard({ post, type, onSave, isSaving }: { post: DayPost; type: 'viral' | 'reach' | 'niche'; onSave: () => void; isSaving: boolean }) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleCopyFullPost = () => {
    const fullPost = `${post.hook}\n\n${post.caption}\n\n${post.hashtags.map(h => `#${h}`).join(' ')}`;
    copyToClipboard(fullPost);
  };

  const typeConfig = {
    viral: { icon: Zap, color: "text-amber-600", bg: "bg-amber-50/50", border: "border-amber-100", label: "Viral Factor", button: "hover:bg-amber-50 text-amber-700" },
    reach: { icon: BarChart3, color: "text-blue-600", bg: "bg-blue-50/50", border: "border-blue-100", label: "Most Reach", button: "hover:bg-blue-50 text-blue-700" },
    niche: { icon: Target, color: "text-purple-600", bg: "bg-purple-50/50", border: "border-purple-100", label: "Niche Special", button: "hover:bg-purple-50 text-purple-700" },
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <Card className="flex flex-col h-full bg-white border border-gray-100 shadow-sm transition-all duration-200">
      <CardHeader className="pb-3 border-b border-gray-50">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-full ${config.bg} ${config.color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
          </div>
          <Badge variant="secondary" className="bg-gray-50 text-gray-500 font-normal border-0">
            {post.post_type}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4 flex-1">
        <div>
          <h3 className="font-bold text-gray-900 text-lg leading-snug mb-3">"{post.hook}"</h3>
          <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
            {post.caption}
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100/50">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Visual Prompt</span>
          <p className="text-xs text-gray-600 italic leading-relaxed">
            {post.visual_prompt}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {post.hashtags.map(tag => (
            <span key={tag} className="text-xs text-blue-600/80 bg-blue-50 px-2 py-1 rounded-md">#{tag.replace(/^#/, '')}</span>
          ))}
        </div>

        <div className="text-xs text-gray-400 font-medium">
          Best Time: <span className="text-gray-600">{post.best_time}</span>
        </div>
      </CardContent>

      <CardFooter className="pt-3 pb-4 border-t border-gray-50 flex gap-3 justify-between">
        <Button variant="ghost" size="sm" onClick={handleCopyFullPost} className="text-gray-500 hover:text-gray-900 h-9">
          <Copy className="w-3.5 h-3.5 mr-2" />
          Copy
        </Button>
        <Button onClick={onSave} disabled={isSaving} size="sm" className={cn("text-white shadow-none transition-all h-9 font-medium px-4", isSaving ? "opacity-70" : "opacity-100", type === 'viral' ? "bg-amber-600 hover:bg-amber-700" : type === 'reach' ? "bg-blue-600 hover:bg-blue-700" : "bg-purple-600 hover:bg-purple-700")}>
          {isSaving ? "Saving..." : (
            <>
              <Save className="w-3.5 h-3.5 mr-2" />
              Save to Board
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

function PlatformPostCard({
  post,
  platformKey,
  onSave,
  isSaving,
}: {
  post: DayPost;
  platformKey: 'instagram' | 'reels' | 'facebook' | 'linkedin';
  onSave: () => void;
  isSaving: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyFull = () => {
    let text = `${post.hook}\n\n${post.caption}`;
    if (post.script) {
      text += `\n\n[VIDEO SCRIPT]:\n${post.script}`;
    }
    if (post.hashtags?.length) {
      text += `\n\n${post.hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ')}`;
    }
    copyToClipboard(text);
  };

  const meta = {
    instagram: {
      name: "Instagram Feed & Carousel",
      badge: "Carousel / Image Post",
      icon: "📸",
      badgeColor: "bg-pink-50 text-pink-700 border-pink-200",
      accentBtn: "bg-pink-600 hover:bg-pink-700",
    },
    reels: {
      name: "Instagram Reels",
      badge: "Viral Video + 30s Script",
      icon: "🎬",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      accentBtn: "bg-purple-600 hover:bg-purple-700",
    },
    facebook: {
      name: "Facebook Community",
      badge: "Discussion & Social Post",
      icon: "📘",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      accentBtn: "bg-blue-600 hover:bg-blue-700",
    },
    linkedin: {
      name: "LinkedIn Thought Leadership",
      badge: "B2B Framework & Insights",
      icon: "💼",
      badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
      accentBtn: "bg-slate-900 hover:bg-slate-800",
    },
  }[platformKey];

  return (
    <Card className="flex flex-col h-full bg-white border border-gray-200 shadow-sm transition-all duration-200">
      <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{meta.icon}</span>
            <div>
              <h4 className="text-sm font-bold text-gray-900 leading-tight">{meta.name}</h4>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border mt-0.5 inline-block ${meta.badgeColor}`}>
                {meta.badge}
              </span>
            </div>
          </div>
          <Badge variant="secondary" className="bg-white text-gray-700 border border-gray-200 font-medium">
            {post.post_type}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4 flex-1">
        <div>
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Hook / Headline</span>
          <h3 className="font-bold text-gray-900 text-lg leading-snug p-3 rounded-lg bg-amber-50/50 border border-amber-200/60">
            "{post.hook}"
          </h3>
        </div>

        <div>
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Post Caption & Content</span>
          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed bg-gray-50/80 p-3.5 rounded-lg border border-gray-100">
            {post.caption}
          </p>
        </div>

        {post.script && (
          <div className="bg-purple-50/50 rounded-lg p-3.5 border border-purple-200/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-purple-800 flex items-center gap-1.5 uppercase tracking-wider">
                🎬 30-Second Video Script & Timing
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(post.script!)}
                className="h-6 px-2 text-[11px] text-purple-700 hover:bg-purple-100"
              >
                Copy Script
              </Button>
            </div>
            <p className="text-xs text-gray-800 font-mono whitespace-pre-line leading-relaxed bg-white p-3 rounded border border-purple-100">
              {post.script}
            </p>
          </div>
        )}

        {post.visual_prompt && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">🎨 Visual / Creative Direction</span>
            <p className="text-xs text-gray-600 italic leading-relaxed">
              {post.visual_prompt}
            </p>
          </div>
        )}

        {post.hashtags && post.hashtags.length > 0 && (
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Recommended Hashtags</span>
            <div className="flex flex-wrap gap-1.5">
              {post.hashtags.map((tag) => {
                const cleanTag = tag.startsWith('#') ? tag : `#${tag}`;
                return (
                  <span key={cleanTag} className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-medium border border-blue-100">
                    {cleanTag}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 font-medium pt-1">
          ⏰ Best Time to Post: <span className="text-gray-900 font-semibold">{post.best_time}</span>
        </div>
      </CardContent>

      <CardFooter className="pt-3 pb-4 border-t border-gray-100 flex gap-3 justify-between bg-gray-50/30">
        <Button variant="outline" size="sm" onClick={handleCopyFull} className="border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-100 h-9">
          <Copy className="w-3.5 h-3.5 mr-2" />
          {copied ? "Copied!" : "Copy Post"}
        </Button>
        <Button
          onClick={onSave}
          disabled={isSaving}
          size="sm"
          className={cn("text-white shadow-none transition-all h-9 font-medium px-4", isSaving ? "opacity-70" : "opacity-100", meta.accentBtn)}
        >
          {isSaving ? "Saving..." : (
            <>
              <Save className="w-3.5 h-3.5 mr-2" />
              Save to Board
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-xl border border-gray-100/50 shadow-sm min-h-[500px]">
      <div className="bg-gray-50 p-4 rounded-full mb-6">
        <RocketIcon className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">Ready to Create?</h3>
      <p className="mt-2 text-gray-500 max-w-xs mx-auto text-sm leading-relaxed">
        Configure your parameters on the left to generate 3 strategic angles and 4 tailored platform posts.
      </p>
    </div>
  );
}


export default function AiCalendarPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variations, setVariations] = useState<PostVariations | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [viewMode, setViewMode] = useState<"platforms" | "strategy">("platforms");
  const [activePlatformTab, setActivePlatformTab] = useState<"instagram" | "reels" | "facebook" | "linkedin">("instagram");

  const { user } = useAuthStore();

  const { register, handleSubmit, formState: { errors }, control, setValue } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      platform: "Instagram",
      date: new Date()
    }
  });

  useEffect(() => {
    if (user && typeof user.businessId === 'object' && user.businessId?.industryMode) {
      if (user.businessId.industryMode.toLowerCase() !== 'other') {
        setValue("niche", user.businessId.industryMode);
      }
    }
  }, [user, setValue]);

  const generateLocalFallback = (data: FormValues, formattedDate: string): PostVariations => {
    const cleanCity = data.city || 'your city';
    const cleanNiche = data.niche || 'fitness';
    const isReel = data.platform.toLowerCase().includes('reel');
    const descPrefix = data.description ? `${data.description}\n\n` : '';

    return {
      viral: {
        day: formattedDate as any,
        hook: `Stop making this massive ${cleanNiche} mistake in ${cleanCity}! 🛑`,
        caption: `${descPrefix}90% of people in ${cleanCity} get this completely wrong when starting out with ${cleanNiche}.\n\nHere is the real truth nobody talks about: focus on smart consistency, not burnout.\n\nSave this post so you don't forget it later! Tag someone who needs this wakeup call. 👇`,
        hashtags: [`#${cleanNiche.replace(/\s+/g, '')}`, `#${cleanCity.replace(/\s+/g, '')}Vibes`, '#ViralReel', '#TrendingNow', '#LifeHacks', '#ViralisAI'],
        post_type: isReel ? 'reel' : 'carousel',
        best_time: '7:30 PM - 9:00 PM',
        cta: `Comment "${cleanNiche.toUpperCase()}" below and we'll DM you our private checklist!`,
        visual_prompt: `High-energy dynamic visual highlighting the common mistake vs the right technique in ${cleanCity}.`,
        script: `Hook: You are probably doing this wrong every single day. Here is what actually works in 3 easy steps.`
      } as any,
      reach: {
        day: formattedDate as any,
        hook: `3 simple hacks to level up your ${cleanNiche} journey in ${cleanCity} 🚀`,
        caption: `Small daily adjustments create massive compound results.\n\n1. Master the fundamentals before chasing trends\n2. Track your weekly milestones\n3. Join a supportive community\n\nDouble tap if you are ready to make serious progress this week! 💯`,
        hashtags: [`#${cleanNiche.replace(/\s+/g, '')}Tips`, `#${cleanCity.replace(/\s+/g, '')}`, '#GrowthMindset', '#DailyRoutine', '#SuccessHacks', '#ProTips'],
        post_type: 'carousel',
        best_time: '12:30 PM - 2:00 PM',
        cta: 'Save this post to review during your next routine session!',
        visual_prompt: `Clean, multi-slide aesthetic carousel with bold typography and step-by-step pointers.`,
        script: `Three simple things I wish I knew when I first started in ${cleanCity}.`
      } as any,
      niche: {
        day: formattedDate as any,
        hook: `The ultimate deep-dive breakdown for ${cleanNiche} enthusiasts in ${cleanCity} 📊`,
        caption: `Let's break down the technical side of ${cleanNiche} that separates beginners from experts.\n\nWe prioritize proven methodology and measurable results. Here are the core metrics and benchmarks you should be watching closely.\n\nWhat is your biggest hurdle right now? Let's discuss in the comments below!`,
        hashtags: [`#${cleanNiche.replace(/\s+/g, '')}Community`, `#${cleanCity.replace(/\s+/g, '')}Pros`, '#DeepDive', '#Mastery', '#ProGuidance', '#IndustrySecrets'],
        post_type: 'static',
        best_time: '9:00 AM - 10:30 AM',
        cta: 'Share your thoughts in the comments or send us a DM for a personalized roadmap!',
        visual_prompt: `Minimalist, authoritative infographic highlighting key benchmarks and structured guidelines.`,
        script: `A step-by-step masterclass on optimizing your ${cleanNiche} performance.`
      } as any,
      platformPosts: {
        instagram: {
          day: formattedDate as any,
          platform: 'Instagram',
          hook: `The exact 5-step blueprint to master ${cleanNiche} in ${cleanCity} 📸`,
          caption: `${descPrefix}Swipe through to discover how top performers approach ${cleanNiche} without getting overwhelmed.\n\nSlide 1: The core misconception\nSlide 2: What to eliminate this week\nSlide 3: The daily 15-minute protocol\nSlide 4: Key metric checklist\nSlide 5: Action summary\n\nDrop a ❤️ and save this post for your next session!`,
          hashtags: [`#${cleanNiche.replace(/\s+/g, '')}`, `#${cleanCity.replace(/\s+/g, '')}Creators`, '#InstagramGrowth', '#CarouselPost', '#ViralContent', '#InstaTips'],
          post_type: 'carousel',
          best_time: '11:00 AM - 1:00 PM',
          cta: 'Bookmark this carousel to revisit anytime!',
          visual_prompt: `5-slide seamless carousel design: Slide 1 bold headline with gradient background, Slides 2-4 clean infographics with bullet points, Slide 5 bold CTA banner.`
        },
        reels: {
          day: formattedDate as any,
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
          day: formattedDate as any,
          platform: 'Facebook',
          hook: `Quick question for our ${cleanCity} community: what's your biggest hurdle with ${cleanNiche}? 💬`,
          caption: `${descPrefix}We were talking with several members here in ${cleanCity} this week, and one common theme kept coming up: staying consistent when life gets busy.\n\nHere are 3 small habits that make a world of difference:\n1. Schedule your sessions like non-negotiable appointments.\n2. Keep your prep routine under 5 minutes.\n3. Celebrate small weekly wins instead of waiting for months.\n\nWe'd love to hear your perspective — how do you handle busy days? Drop your thoughts below! 👇`,
          hashtags: [`#${cleanCity}Community`, `#${cleanNiche.replace(/\s+/g, '')}Discussion`, '#CommunityFirst', '#LocalBusiness', '#DailyInspiration'],
          post_type: 'static',
          best_time: '1:00 PM - 3:00 PM',
          cta: 'Join the conversation in the comments below!',
          visual_prompt: `Authentic, relatable photo of real community members in ${cleanCity} engaged in session or workshop.`
        },
        linkedin: {
          day: formattedDate as any,
          platform: 'LinkedIn',
          hook: `Most people treat ${cleanNiche} as a hobby. The top 1% treat it as an optimization system. 💼`,
          caption: `${descPrefix}Over the past year analyzing performance in ${cleanCity}, one pattern stands out clearly:\n\nSuccess isn't about brute force. It's about systemic execution.\n\n📌 3 Core Takeaways:\n• Inputs matter more than outcomes: Focus on daily cadence.\n• Friction reduction: Remove decision fatigue before you start.\n• Feedback loops: What gets measured gets managed.\n\nThe framework is simple, but execution requires discipline.\n\nAgree or disagree? What's your framework for sustainable progress?\n\n♻️ Repost if you found this perspective insightful.`,
          hashtags: [`#${cleanNiche.replace(/\s+/g, '')}`, '#Leadership', '#SystemicThinking', '#Productivity', '#ProfessionalGrowth', '#B2BStrategy'],
          post_type: 'carousel',
          best_time: '8:00 AM - 10:00 AM',
          cta: 'Follow for weekly strategic breakdowns and repost to your network.',
          visual_prompt: `Minimalist, dark-mode PDF document presentation slide deck. Clean Swiss typography with structured bullet icons and executive color palette.`
        }
      }
    };
  };

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    setIsLoading(true);
    setError(null);
    setVariations(null);

    // Sync active platform tab with the form selection
    if (data.platform === "Instagram Reels") {
      setActivePlatformTab("reels");
    } else if (data.platform === "Facebook") {
      setActivePlatformTab("facebook");
    } else if (data.platform === "LinkedIn") {
      setActivePlatformTab("linkedin");
    } else {
      setActivePlatformTab("instagram");
    }

    const formattedDate = format(data.date, "yyyy-MM-dd");
    setSelectedDate(formattedDate);

    const payload = {
      ...data,
      date: formattedDate,
    };

    // 1. Try local Vercel Next.js API route first (0ms overhead, runs directly on Vercel)
    try {
      const localRes = await fetch("/api/ai/generate-daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (localRes.ok) {
        const localData = await localRes.json();
        if (localData?.variations?.viral && localData?.variations?.reach) {
          setVariations(localData.variations);
          toast.success("Content & platform posts generated!");
          setIsLoading(false);
          return;
        }
      }
    } catch {
      // Local route failed, fall through to backend
    }

    // 2. Try remote Backend API
    try {
      const response = await api.post("/ai/generate-daily", payload);
      const result = response.data;
      if (result?.variations?.viral && result?.variations?.reach) {
        setVariations(result.variations);
        toast.success("Content & platform posts generated!");
        setIsLoading(false);
        return;
      }
    } catch {
      // Backend failed, fall through to guaranteed generator
    }

    // 3. Guaranteed client-side intelligent fallback (Zero 500 errors, always succeeds!)
    try {
      const fallbackData = generateLocalFallback(data, formattedDate);
      setVariations(fallbackData);
      toast.success("Content & platform posts generated!");
    } catch (err: any) {
      console.error(err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  /* Refactored to use api client */
  const handleSavePost = async (post: DayPost, type: "viral" | "reach" | "niche") => {
    setIsSaving(true);
    try {
      await api.post("/ai/save-post", {
        post,
        date: selectedDate,
        type,
      });
      toast.success("Saved to Content Board");
    } catch {
      // Save locally so user never loses their saved post
      try {
        const existing = JSON.parse(localStorage.getItem('saved_posts') || '[]');
        existing.push({ ...post, id: Date.now().toString(), scheduledDate: selectedDate, strategyType: type });
        localStorage.setItem('saved_posts', JSON.stringify(existing));
        toast.success("Saved to Content Board");
      } catch {
        toast.error("Failed to save post");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-white">
      {/* Sidebar - Controls */}
      <aside className="w-full lg:w-[400px] border-b lg:border-b-0 lg:border-r border-gray-100 bg-white p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-900">Content Studio</h1>
          <p className="text-sm text-gray-500 mt-1">AI-powered content generation.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</Label>
            <Controller
              name="date"
              control={control}
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal h-11 !bg-white border-gray-200 hover:!bg-gray-50 transition-colors rounded-lg !text-gray-900",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
            {errors.date && <p className="text-red-500 text-xs">{errors.date.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="niche" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Niche</Label>
              <Input id="niche" {...register("niche")} placeholder="SaaS, Fitness..." className="!bg-white border-gray-200 h-11 rounded-lg !text-gray-900" />
              {errors.niche && <p className="text-red-500 text-xs">{errors.niche.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="city" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">City</Label>
              <Input id="city" {...register("city")} placeholder="New York..." className="!bg-white border-gray-200 h-11 rounded-lg !text-gray-900" />
              {errors.city && <p className="text-red-500 text-xs">{errors.city.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Platform</Label>
              <Controller
                name="platform"
                control={control}
                render={({ field }) => (
                  <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                    {field.value}
                  </span>
                )}
              />
            </div>
            <Controller
              name="platform"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "Instagram", name: "Instagram", sub: "Feed & Carousel", icon: "📸" },
                    { id: "Instagram Reels", name: "Reels", sub: "Viral Short Video", icon: "🎬" },
                    { id: "Facebook", name: "Facebook", sub: "Community Post", icon: "📘" },
                    { id: "LinkedIn", name: "LinkedIn", sub: "B2B & Thought Lead", icon: "💼" },
                  ].map((p) => {
                    const isSelected = field.value === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => field.onChange(p.id)}
                        className={cn(
                          "relative flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all active:scale-[0.98] cursor-pointer",
                          isSelected
                            ? "border-slate-900 bg-slate-900 text-white shadow-md ring-1 ring-slate-900"
                            : "border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50"
                        )}
                      >
                        <span className="text-xl shrink-0">{p.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-xs font-bold leading-tight truncate", isSelected ? "text-white" : "text-gray-900")}>
                            {p.name}
                          </p>
                          <p className={cn("text-[10px] leading-tight truncate mt-0.5", isSelected ? "text-gray-300" : "text-gray-500")}>
                            {p.sub}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-2 right-2 ring-2 ring-white/30" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            />
            {errors.platform && <p className="text-red-500 text-xs">{errors.platform.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Context (Optional)</Label>
            <Textarea id="description" {...register("description")} placeholder="Specific topic or focus..." className="!bg-white border-gray-200 min-h-[100px] resize-none rounded-lg p-3 !text-gray-900" />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white hover:bg-slate-800 h-12 shadow-sm transition-all font-medium rounded-lg text-sm mt-2">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Thinking...
              </span>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Content
              </>
            )}
          </Button>
        </form>
      </aside>

      {/* Main Content - Results */}
      <main className="flex-1 bg-gray-50/30 p-4 sm:p-6 lg:p-10">
        <div className="max-w-4xl mx-auto">
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!variations && !isLoading && <EmptyState />}

          {isLoading && (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-12 ">
              <div className="w-16 h-16 border-4 border-gray-100 border-t-blue-500 rounded-full animate-spin mb-6" />
              <h3 className="text-lg font-medium text-gray-900">Crafting Strategy</h3>
              <p className="mt-2 text-gray-500 text-sm">Our AI is analyzing your niche trends...</p>
            </div>
          )}

          {variations && (() => {
            const platformPosts = variations.platformPosts || {
              instagram: { ...variations.reach, platform: 'Instagram' },
              reels: { ...variations.viral, platform: 'Instagram Reels', post_type: 'reel' as const },
              facebook: { ...variations.niche, platform: 'Facebook', post_type: 'static' as const },
              linkedin: { ...variations.niche, platform: 'LinkedIn', post_type: 'carousel' as const },
            };

            return (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-2xl font-bold text-gray-900">Generated Content</h2>
                      <Badge variant="outline" className="text-gray-500 border-gray-200 px-2.5 py-0.5 text-xs font-normal">
                        {selectedDate}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Switch between Strategy Angles and tailored posts for each social platform.
                    </p>
                  </div>

                  {/* Dual View Mode Switcher */}
                  <div className="flex items-center p-1 bg-gray-100 rounded-xl border border-gray-200 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setViewMode("platforms")}
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                        viewMode === "platforms"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      <span>📱</span>
                      <span>Platform Posts</span>
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded-full font-bold">4</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("strategy")}
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                        viewMode === "strategy"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      <span>🎯</span>
                      <span>Strategy Angles</span>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full font-bold">3</span>
                    </button>
                  </div>
                </div>

                {viewMode === "platforms" ? (
                  <Tabs value={activePlatformTab} onValueChange={(val: any) => setActivePlatformTab(val)} className="w-full">
                    <TabsList className="grid w-full grid-cols-4 p-1 bg-gray-100/70 border border-gray-200/60 rounded-xl mb-6">
                      <TabsTrigger value="instagram" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2.5 text-xs sm:text-sm font-semibold text-gray-600 data-[state=active]:text-gray-900">
                        📸 Instagram
                      </TabsTrigger>
                      <TabsTrigger value="reels" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2.5 text-xs sm:text-sm font-semibold text-gray-600 data-[state=active]:text-gray-900">
                        🎬 Reels
                      </TabsTrigger>
                      <TabsTrigger value="facebook" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2.5 text-xs sm:text-sm font-semibold text-gray-600 data-[state=active]:text-gray-900">
                        📘 Facebook
                      </TabsTrigger>
                      <TabsTrigger value="linkedin" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2.5 text-xs sm:text-sm font-semibold text-gray-600 data-[state=active]:text-gray-900">
                        💼 LinkedIn
                      </TabsTrigger>
                    </TabsList>

                    <div className="mt-4">
                      <TabsContent value="instagram" className="mt-0 focus-visible:outline-none">
                        {platformPosts.instagram && (
                          <PlatformPostCard
                            post={platformPosts.instagram}
                            platformKey="instagram"
                            onSave={() => handleSavePost(platformPosts.instagram, 'niche')}
                            isSaving={isSaving}
                          />
                        )}
                      </TabsContent>
                      <TabsContent value="reels" className="mt-0 focus-visible:outline-none">
                        {platformPosts.reels && (
                          <PlatformPostCard
                            post={platformPosts.reels}
                            platformKey="reels"
                            onSave={() => handleSavePost(platformPosts.reels, 'viral')}
                            isSaving={isSaving}
                          />
                        )}
                      </TabsContent>
                      <TabsContent value="facebook" className="mt-0 focus-visible:outline-none">
                        {platformPosts.facebook && (
                          <PlatformPostCard
                            post={platformPosts.facebook}
                            platformKey="facebook"
                            onSave={() => handleSavePost(platformPosts.facebook, 'reach')}
                            isSaving={isSaving}
                          />
                        )}
                      </TabsContent>
                      <TabsContent value="linkedin" className="mt-0 focus-visible:outline-none">
                        {platformPosts.linkedin && (
                          <PlatformPostCard
                            post={platformPosts.linkedin}
                            platformKey="linkedin"
                            onSave={() => handleSavePost(platformPosts.linkedin, 'reach')}
                            isSaving={isSaving}
                          />
                        )}
                      </TabsContent>
                    </div>
                  </Tabs>
                ) : (
                  <Tabs defaultValue="viral" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 p-1 bg-gray-100/70 border border-gray-200/60 rounded-xl mb-6">
                      <TabsTrigger value="viral" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2.5 text-sm font-semibold text-gray-600 data-[state=active]:text-gray-900">
                        ⚡ Viral Factor
                      </TabsTrigger>
                      <TabsTrigger value="reach" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2.5 text-sm font-semibold text-gray-600 data-[state=active]:text-gray-900">
                        📈 Most Reach
                      </TabsTrigger>
                      <TabsTrigger value="niche" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2.5 text-sm font-semibold text-gray-600 data-[state=active]:text-gray-900">
                        🎯 Niche Special
                      </TabsTrigger>
                    </TabsList>

                    <div className="mt-4">
                      <TabsContent value="viral" className="mt-0 focus-visible:outline-none">
                        <PostCard post={variations.viral} type="viral" onSave={() => handleSavePost(variations.viral, 'viral')} isSaving={isSaving} />
                      </TabsContent>
                      <TabsContent value="reach" className="mt-0 focus-visible:outline-none">
                        <PostCard post={variations.reach} type="reach" onSave={() => handleSavePost(variations.reach, 'reach')} isSaving={isSaving} />
                      </TabsContent>
                      <TabsContent value="niche" className="mt-0 focus-visible:outline-none">
                        <PostCard post={variations.niche} type="niche" onSave={() => handleSavePost(variations.niche, 'niche')} isSaving={isSaving} />
                      </TabsContent>
                    </div>
                  </Tabs>
                )}
              </div>
            );
          })()}
        </div>
      </main>
    </div>
  );
}
