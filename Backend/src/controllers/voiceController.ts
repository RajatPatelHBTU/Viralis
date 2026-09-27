import { Request, Response } from 'express';
import { Lead } from '../models/Lead';
import { Transcript } from '../models/Transcript';
import { User } from '../models/User';
import { Business } from '../models/Business';
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

export class VoiceController {
    static async processCallRecord(data: ProcessCallPayload) {
        let businessId = data.businessId || data.brandId;

        // 1. Resolve Business
        if (!businessId || !mongoose.isValidObjectId(businessId)) {
            const adminUser = await User.findOne({ role: 'admin' });
            if (adminUser && adminUser.businessId) {
                businessId = adminUser.businessId.toString();
            } else {
                const anyBusiness = await Business.findOne();
                if (anyBusiness) {
                    businessId = anyBusiness._id.toString();
                }
            }
        }

        if (!businessId || !mongoose.isValidObjectId(businessId)) {
            console.warn('⚠️ No valid businessId found for voice call processing');
            return null;
        }

        const callerNumber = data.callerNumber || 'web-call';
        const callerName = data.callerName || 'Web Visitor';
        const email = data.email || '';
        const isGenericPhone = callerNumber === 'web-call' || callerNumber === 'web-form';

        // 2. Find or Create Lead
        let lead = null;
        if (email) {
            lead = await Lead.findOne({ businessId, email });
        }
        if (!lead && !isGenericPhone) {
            lead = await Lead.findOne({ businessId, phone: callerNumber });
        }

        if (!lead) {
            lead = await Lead.create({
                businessId: new mongoose.Types.ObjectId(businessId),
                name: callerName,
                phone: isGenericPhone ? '' : callerNumber,
                email: email,
                status: data.userInterested ? 'qualified' : 'new',
                source: 'Voice Call',
                score: data.userInterested ? 70 : 30,
                notes: data.notes || (data.userInterested ? 'High-intent lead captured from AI Voice Call' : 'Auto-created from AI Voice Call')
            });
            console.log('✅ Created new lead from voice call:', lead._id);
        } else {
            if (callerName && callerName !== 'Web Visitor' && (!lead.name || lead.name === 'Web Visitor')) {
                lead.name = callerName;
            }
            if (email && !lead.email) {
                lead.email = email;
            }
            if (!isGenericPhone && !lead.phone) {
                lead.phone = callerNumber;
            }
            if (data.userInterested) {
                lead.status = 'qualified';
                lead.score = Math.max(lead.score || 0, 70);
            }
            if (data.notes) {
                lead.notes = lead.notes ? `${lead.notes} | ${data.notes}` : data.notes;
            }
            lead.updatedAt = new Date();
            await lead.save();
            console.log('✅ Updated existing lead from voice call:', lead._id);
        }

        // 3. Create Transcript
        let callRecord = null;
        if (data.transcript) {
            const validSentiment: 'positive' | 'neutral' | 'negative' =
                data.sentiment === 'positive' || data.sentiment === 'negative' ? data.sentiment : 'neutral';

            callRecord = await Transcript.create({
                businessId: new mongoose.Types.ObjectId(businessId),
                leadId: lead?._id,
                text: data.transcript,
                audioUrl: data.audioUrl,
                durationSeconds: data.duration || 0,
                sentiment: validSentiment,
                intent: data.userInterested ? 'Booking / Purchase Inquiry' : 'General Inquiry',
                createdAt: new Date()
            });
            console.log('✅ Saved Transcript:', callRecord._id);

            if (lead) {
                lead.transcriptId = callRecord._id as any;
                await lead.save();
            }
        }

        return { lead, transcript: callRecord };
    }

    static async handleWebhook(req: Request, res: Response) {
        try {
            console.log('Received Voice Webhook:', req.body);
            const result = await VoiceController.processCallRecord(req.body);
            return res.json({ success: true, message: 'Webhook processed', data: result });
        } catch (error) {
            console.error('Voice Webhook Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}
