import { Request, Response } from 'express';
import mongoose from 'mongoose';
export interface ProcessCallPayload {
    businessId?: string;
    brandId?: string;
    callerNumber?: string;
    callerName?: string;
    email?: string;
    transcript?: string;
    duration?: number;
    sentiment?: 'positive' | 'neutral' | 'negative' | string;
    audioUrl?: string;
    status?: string;
    notes?: string;
    userInterested?: boolean;
}
export declare class VoiceController {
    static processCallRecord(data: ProcessCallPayload): Promise<{
        lead: mongoose.Document<unknown, {}, import("../models/Lead").ILead, {}, {}> & import("../models/Lead").ILead & Required<{
            _id: mongoose.Types.ObjectId;
        }> & {
            __v: number;
        };
        transcript: (mongoose.Document<unknown, {}, import("../models/Transcript").ITranscript, {}, {}> & import("../models/Transcript").ITranscript & Required<{
            _id: mongoose.Types.ObjectId;
        }> & {
            __v: number;
        }) | null;
    } | null>;
    static handleWebhook(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=voiceController.d.ts.map