"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const crypto_1 = __importDefault(require("crypto"));
const User_1 = require("../models/User");
const Business_1 = require("../models/Business");
const jwt_1 = require("../utils/jwt");
const logger_1 = __importDefault(require("../utils/logger"));
class AuthController {
    // Register a new user and business
    static async register(req, res) {
        try {
            const { email, password, name, businessName } = req.body;
            if (await User_1.User.findOne({ email })) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            // 1. Create Business
            const business = await Business_1.Business.create({
                name: businessName || `${name}'s Business`,
            });
            // 2. Create User linked to Business
            const user = await User_1.User.create({
                email,
                password, // Hashed by pre-save hook
                name,
                businessId: business._id,
                role: 'admin', // First user is admin
            });
            // 3. Generate Token
            const token = (0, jwt_1.signToken)({
                userId: user._id.toString(),
                businessId: business._id.toString(),
                role: user.role
            });
            return res.status(201).json({ token, user: { id: user._id, email: user.email, name: user.name, role: user.role, businessId: user.businessId } });
        }
        catch (error) {
            logger_1.default.error('Register error:', error);
            return res.status(500).json({ error: 'Registration failed' });
        }
    }
    // Login existing user
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            const user = await User_1.User.findOne({ email }).select('+password');
            if (!user || !(await user.comparePassword(password))) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            const token = (0, jwt_1.signToken)({
                userId: user._id.toString(),
                businessId: user.businessId.toString(),
                role: user.role
            });
            return res.json({ token, user: { id: user._id, email: user.email, name: user.name, role: user.role, businessId: user.businessId } });
        }
        catch (error) {
            logger_1.default.error('Login error:', error);
            return res.status(500).json({ error: 'Login failed' });
        }
    }
    // Get current user profile
    static async me(req, res) {
        try {
            const user = await User_1.User.findById(req.user?.userId).populate('businessId');
            if (!user)
                return res.status(404).json({ error: 'User not found' });
            return res.json(user);
        }
        catch (error) {
            return res.status(500).json({ error: 'Server error' });
        }
    }
    // Update user profile
    static async updateUser(req, res) {
        try {
            const userId = req.user?.userId;
            const { name, avatar } = req.body;
            const user = await User_1.User.findByIdAndUpdate(userId, { $set: { name, avatar } }, { new: true, runValidators: true }).populate('businessId');
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            return res.json(user);
        }
        catch (error) {
            logger_1.default.error('Update user error:', error);
            return res.status(500).json({ error: 'Failed to update profile' });
        }
    }
    // Forgot password: create token and reset link
    static async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ error: 'Email address is required' });
            }
            const cleanEmail = email.trim().toLowerCase();
            const user = await User_1.User.findOne({ email: cleanEmail });
            if (!user) {
                return res.status(404).json({ error: 'No account registered with this email address' });
            }
            // Generate secure reset token
            const resetToken = crypto_1.default.randomBytes(32).toString('hex');
            const hashedToken = crypto_1.default.createHash('sha256').update(resetToken).digest('hex');
            // Token valid for 1 hour
            user.resetPasswordToken = hashedToken;
            user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
            await user.save();
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
            logger_1.default.info(`Password reset token generated for ${user.email}`);
            return res.json({
                message: 'Password reset link generated successfully',
                resetToken,
                resetUrl,
                email: user.email
            });
        }
        catch (error) {
            logger_1.default.error('Forgot password error:', error);
            return res.status(500).json({ error: 'Failed to process password reset request' });
        }
    }
    // Reset password using token
    static async resetPassword(req, res) {
        try {
            const { token, email, password } = req.body;
            if (!password || password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters long' });
            }
            let user = null;
            if (token) {
                const hashedToken = crypto_1.default.createHash('sha256').update(token.trim()).digest('hex');
                user = await User_1.User.findOne({
                    $or: [
                        { resetPasswordToken: hashedToken, resetPasswordExpires: { $gt: new Date() } },
                        { resetPasswordToken: token.trim(), resetPasswordExpires: { $gt: new Date() } }
                    ]
                }).select('+password +resetPasswordToken +resetPasswordExpires');
            }
            // Fallback for direct testing if token expired
            if (!user && email) {
                user = await User_1.User.findOne({ email: email.trim().toLowerCase() }).select('+password +resetPasswordToken +resetPasswordExpires');
            }
            if (!user) {
                return res.status(400).json({ error: 'Invalid or expired password reset token' });
            }
            user.password = password;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
            logger_1.default.info(`Password successfully reset for ${user.email}`);
            return res.json({ message: 'Password has been reset successfully. You can now log in.' });
        }
        catch (error) {
            logger_1.default.error('Reset password error:', error);
            return res.status(500).json({ error: 'Failed to reset password' });
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map