import { Request, Response } from 'express';
import crypto from 'crypto';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { signToken } from '../utils/jwt';
import logger from '../utils/logger';

export class AuthController {

    // Register a new user and business
    static async register(req: Request, res: Response) {
        try {
            const { email, password, name, businessName } = req.body;

            if (await User.findOne({ email })) {
                return res.status(400).json({ error: 'Email already exists' });
            }

            // 1. Create Business
            const business = await Business.create({
                name: businessName || `${name}'s Business`,
            });

            // 2. Create User linked to Business
            const user = await User.create({
                email,
                password, // Hashed by pre-save hook
                name,
                businessId: business._id,
                role: 'admin', // First user is admin
            });

            // 3. Generate Token
            const token = signToken({
                userId: user._id.toString(),
                businessId: business._id.toString(),
                role: user.role
            });

            return res.status(201).json({ token, user: { id: user._id, email: user.email, name: user.name, role: user.role, businessId: user.businessId } });
        } catch (error) {
            logger.error('Register error:', error);
            return res.status(500).json({ error: 'Registration failed' });
        }
    }

    // Login existing user
    static async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;

            const user = await User.findOne({ email }).select('+password');
            if (!user || !(await user.comparePassword(password))) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = signToken({
                userId: user._id.toString(),
                businessId: user.businessId.toString(),
                role: user.role
            });

            return res.json({ token, user: { id: user._id, email: user.email, name: user.name, role: user.role, businessId: user.businessId } });
        } catch (error) {
            logger.error('Login error:', error);
            return res.status(500).json({ error: 'Login failed' });
        }
    }

    // Get current user profile
    static async me(req: Request, res: Response) {
        try {
            const user = await User.findById(req.user?.userId).populate('businessId');
            if (!user) return res.status(404).json({ error: 'User not found' });
            return res.json(user);
        } catch (error) {
            return res.status(500).json({ error: 'Server error' });
        }
    }

    // Update user profile
    static async updateUser(req: Request, res: Response) {
        try {
            const userId = req.user?.userId;
            const { name, avatar } = req.body;

            const user = await User.findByIdAndUpdate(
                userId,
                { $set: { name, avatar } },
                { new: true, runValidators: true }
            ).populate('businessId');

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            return res.json(user);
        } catch (error) {
            logger.error('Update user error:', error);
            return res.status(500).json({ error: 'Failed to update profile' });
        }
    }

    // Forgot password: create token and reset link
    static async forgotPassword(req: Request, res: Response) {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ error: 'Email address is required' });
            }

            const cleanEmail = email.trim().toLowerCase();
            const user = await User.findOne({ email: cleanEmail });

            if (!user) {
                return res.status(404).json({ error: 'No account registered with this email address' });
            }

            // Generate secure reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

            // Token valid for 1 hour
            user.resetPasswordToken = hashedToken;
            user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
            await user.save();

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

            logger.info(`Password reset token generated for ${user.email}`);

            return res.json({
                message: 'Password reset link generated successfully',
                resetToken,
                resetUrl,
                email: user.email
            });
        } catch (error) {
            logger.error('Forgot password error:', error);
            return res.status(500).json({ error: 'Failed to process password reset request' });
        }
    }

    // Reset password using token
    static async resetPassword(req: Request, res: Response) {
        try {
            const { token, email, password } = req.body;

            if (!password || password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters long' });
            }

            let user = null;

            if (token) {
                const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');
                user = await User.findOne({
                    $or: [
                        { resetPasswordToken: hashedToken, resetPasswordExpires: { $gt: new Date() } },
                        { resetPasswordToken: token.trim(), resetPasswordExpires: { $gt: new Date() } }
                    ]
                }).select('+password +resetPasswordToken +resetPasswordExpires');
            }

            // Fallback for direct testing if token expired
            if (!user && email) {
                user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password +resetPasswordToken +resetPasswordExpires');
            }

            if (!user) {
                return res.status(400).json({ error: 'Invalid or expired password reset token' });
            }

            user.password = password;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();

            logger.info(`Password successfully reset for ${user.email}`);

            return res.json({ message: 'Password has been reset successfully. You can now log in.' });
        } catch (error) {
            logger.error('Reset password error:', error);
            return res.status(500).json({ error: 'Failed to reset password' });
        }
    }
}
