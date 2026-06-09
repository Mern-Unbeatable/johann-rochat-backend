// helpers.js - Add these methods

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../../config/config.js';

export class Helpers {
  static hashPassword(password) {
    return bcrypt.hash(password, 10);
  }

  static comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  static generateAccessToken(payload) {
    return jwt.sign(payload, config.JWT_TOKEN, {
      expiresIn: '7d',
    });
  }

  static generateRefreshToken(payload) {
    return jwt.sign(payload, config.JWT_REFRESH_TOKEN, {
      expiresIn: '7d',
    });
  }

  static verifyRefreshToken(token) {
    return jwt.verify(token, config.JWT_REFRESH_TOKEN);
  }

  static generatePasswordResetToken(payload) {
    return jwt.sign(
      {
        id: payload.id,
        email: payload.email,
        type: 'password-reset',
      },
      config.JWT_TOKEN,
      { expiresIn: '1h' },
    );
  }

  static verifyPasswordResetToken(token) {
    try {
      const decoded = jwt.verify(token, config.JWT_TOKEN);
      if (decoded.type && decoded.type !== 'password-reset') {
        return null;
      }
      return decoded;
    } catch (error) {
      return null;
    }
  }

  // NEW: Generate temporary reset token for OTP flow (expires in 10 minutes)
  static generateTempResetToken(payload) {
    return jwt.sign(
      {
        id: payload.id,
        email: payload.email,
        type: 'temp-reset',
      },
      config.JWT_TOKEN,
      { expiresIn: '10m' } // 10 minutes
    );
  }

  // NEW: Verify temporary reset token
  static verifyTempResetToken(token) {
    try {
      const decoded = jwt.verify(token, config.JWT_TOKEN);
      if (decoded.type && decoded.type !== 'temp-reset') {
        return null;
      }
      return decoded;
    } catch (error) {
      return null;
    }
  }
}