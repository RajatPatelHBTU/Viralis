"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceController = void 0;
const Lead_1 = require("../models/Lead");
const Transcript_1 = require("../models/Transcript");
const User_1 = require("../models/User");
const Business_1 = require("../models/Business");
const mongoose_1 = __importDefault(require("mongoose"));
class VoiceController {
    static async processCallRecord(data) {
        let businessId = data.businessId || data.brandId;
        // 1. Resolve Business
        if (!businessId || !mongoose_1.default.isValidObjectId(businessId)) {
            const adminUser = await User_1.User.findOne({ role: 'admin' });
            if (adminUser && adminUser.businessId) {
                businessId = adminUser.businessId.toString();
            }
            else {
                const anyBusiness = await Business_1.Business.findOne();
                if (anyBusiness) {
                    businessId = anyBusiness._id.toString();
                }
            }
        }
        if (!businessId || !mongoose_1.default.isValidObjectId(businessId)) {
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
            lead = await Lead_1.Lead.findOne({ businessId, email });
        }
        if (!lead && !isGenericPhone) {
            lead = await Lead_1.Lead.findOne({ businessId, phone: callerNumber });
        }
        if (!lead) {
            lead = await Lead_1.Lead.create({
                businessId: new mongoose_1.default.Types.ObjectId(businessId),
                name: callerName,
                phone: isGenericPhone ? '' : callerNumber,
                email: email,
                status: data.userInterested ? 'qualified' : 'new',
                source: 'Voice Call',
                score: data.userInterested ? 70 : 30,
                notes: data.notes || (data.userInterested ? 'High-intent lead captured from AI Voice Call' : 'Auto-created from AI Voice Call')
            });
            console.log('✅ Created new lead from voice call:', lead._id);
        }
        else {
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
            const validSentiment = data.sentiment === 'positive' || data.sentiment === 'negative' ? data.sentiment : 'neutral';
            callRecord = await Transcript_1.Transcript.create({
                businessId: new mongoose_1.default.Types.ObjectId(businessId),
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
                lead.transcriptId = callRecord._id;
                await lead.save();
            }
        }
        return { lead, transcript: callRecord };
    }
    static async handleWebhook(req, res) {
        try {
            console.log('Received Voice Webhook:', req.body);
            const result = await VoiceController.processCallRecord(req.body);
            return res.json({ success: true, message: 'Webhook processed', data: result });
        }
        catch (error) {
            console.error('Voice Webhook Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.VoiceController = VoiceController;
//# sourceMappingURL=voiceController.js.map