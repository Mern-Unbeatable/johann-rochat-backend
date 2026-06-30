import bcrypt from 'bcrypt';
import { prisma } from '../../config/db.js';

class AuthService {
  generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async saveOtp(userId, otp, purpose) {
    const hashedOtp = await bcrypt.hash(otp, 10);
    return prisma.user.update({
      where: { id: userId },
      data: {
        otpCode: hashedOtp,
        otpExpires: new Date(Date.now() + 10 * 60 * 1000),
        otpPurpose: purpose,
      },
    });
  }

  async verifyOtp(userId, plainOtp) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        otpCode: true,
        otpExpires: true,
        otpPurpose: true,
      },
    });

    if (!user || !user.otpCode) return { valid: false, reason: 'No OTP found' };
    if (user.otpExpires < new Date()) return { valid: false, reason: 'OTP expired' };

    const isMatch = await bcrypt.compare(plainOtp, user.otpCode);
    if (!isMatch) return { valid: false, reason: 'Invalid OTP' };

    return { valid: true, purpose: user.otpPurpose };
  }

  async clearOtp(userId) {
    return prisma.user.update({
      where: { id: userId },
      data: { otpCode: null, otpExpires: null, otpPurpose: null },
    });
  }

  async markVerified(userId) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: true,
        otpCode: null,
        otpExpires: null,
        otpPurpose: null,
      },
    });
  }

  async getUserByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        credits: true,
        freeAdUsed: true,
        stripeCustomerId: true,
        consentGiven: true,
        consentDate: true,
        isVerified: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getUserByEmailWithPassword(email) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        credits: true,
        freeAdUsed: true,
        stripeCustomerId: true,
        isVerified: true,
        googleId: true,
      },
    });
  }

  async getUserById(id) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        credits: true,
        freeAdUsed: true,
        stripeCustomerId: true,
        consentGiven: true,
        isVerified: true,
        googleId: true,
        createdAt: true,
      },
    });
  }

  async getUserByIdWithPassword(id) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        credits: true,
        freeAdUsed: true,
        isVerified: true,
        googleId: true,
      },
    });
  }

  async getUserByGoogleId(googleId) {
    return prisma.user.findUnique({
      where: { googleId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        credits: true,
        freeAdUsed: true,
        isVerified: true,
      },
    });
  }

  async linkGoogleAccount(userId, googleId) {
    return prisma.user.update({
      where: { id: userId },
      data: { googleId },
    });
  }

  async getUserByResetToken(id) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        resetPasswordToken: true,
        resetPasswordExpires: true,
      },
    });
  }

  async createUser(data) {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: data.password,
        googleId: data.googleId || null,
        role: data.role || 'USER',
        credits: data.credits || 1,
        freeAdUsed: data.freeAdUsed || false,
        consentGiven: data.consent || false,
        consentDate: data.consent ? new Date() : null,
        isVerified: data.isVerified || false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        credits: true,
        freeAdUsed: true,
        consentGiven: true,
        isVerified: true,
        googleId: true,
        createdAt: true,
      },
    });
  }

  async changePassword(id, hashedPassword) {
    return prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  async savePasswordResetToken(userId, hashedToken, expiresAt) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: expiresAt,
      },
    });
  }

  async updatePasswordAndClearResetToken(userId, hashedPassword) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });
  }

  async verifyResetToken(plainToken, hashedToken) {
    if (!hashedToken) return false;
    return bcrypt.compare(plainToken, hashedToken);
  }

  async hashPassword(password) {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}

export const authService = new AuthService();