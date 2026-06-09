import { config } from '../../config/config.js';
import { Logger } from '../../config/logger.js';
import { catchAsync } from '../../shared/globals/decorators/catch-async.js';
import { Helpers } from '../../shared/globals/helpers/helpers.js';
import { ResponseHandler } from '../../shared/globals/helpers/response.handler.js';
import { mailTransport } from '../../shared/services/emails/mail.transport.js';
import { authOtpService } from './auth.otp.service.js';
import { authService } from './auth.services.js';
import { verificationStore } from './auth.verification.store.js';
import {
  signupSchema,
  signinSchema,
  verifyOtpSchema,
  resendOtpSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.validation.js';

import passport from 'passport';
import { googleStrategy } from './google.strategy.js';

passport.use('google', googleStrategy);

class AuthController {
  constructor() {
    this.log = new Logger('AuthController');
  }

  _setAuthCookies(res, accessToken, refreshToken) {
    const secure = config.NODE_ENV !== 'development';

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  signUp = catchAsync(async (req, res) => {
    const { firstName, lastName, email, password } = signupSchema.parse(req.body);

    const name = `${firstName.trim()} ${lastName.trim()}`;

    this.log.info(`Signup attempt for email: ${email}`);

    const existingUser = await authService.getUserByEmail(email);
    if (existingUser) {
      if (!existingUser.isVerified) {
        const otp = authService.generateOtp();
        await authService.saveOtp(existingUser.id, otp, 'signup');

        await mailTransport
          .sendOtpEmail(existingUser.email, otp, existingUser.name, 'signup')
          .catch((err) => this.log.error(`OTP email failed: ${err.message}`));

        return ResponseHandler.success(res, {
          message:
            'Account already registered but not verified. A new OTP has been sent to your email.',
          data: { userId: existingUser.id, isVerified: false },
        });
      }

      throw new Error('Email is already in use');
    }

    const hashedPassword = await authService.hashPassword(password);

    const user = await authService.createUser({
      name,
      email,
      password: hashedPassword,
      consent: true,
      role: 'USER',
      credits: 1,
      freeAdUsed: false,
    });

    const otp = authService.generateOtp();
    await authService.saveOtp(user.id, otp, 'signup');

    await mailTransport
      .sendOtpEmail(user.email, otp, user.name, 'signup')
      .catch((err) => this.log.error(`OTP email failed for ${user.email}: ${err.message}`));

    this.log.info(`Signup OTP sent to: ${user.email} (userId: ${user.id})`);

    ResponseHandler.created(res, {
      message: 'Registration initiated. Please check your email for the 6-digit verification code.',
      data: {
        userId: user.id,
        email: user.email,
        isVerified: false,
        ...(config.NODE_ENV === 'development' && { otp }),
      },
    });
  });

  verifySignupOtp = catchAsync(async (req, res) => {
    const { email, otp } = verifyOtpSchema.parse(req.body);

    this.log.info(`Signup OTP verification for email: ${email}`);

    const user = await authOtpService.verifyOtpFlow({
      email,
      otp,
      expectedPurpose: 'signup',
    });

    await authService.markVerified(user.id);

    const tokens = await authOtpService.issueTokens(user);

    this._setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    ResponseHandler.created(res, {
      message: 'Email verified successfully. Welcome!',
      data: {
        user,
        ...tokens,
      },
    });
  });

  signIn = catchAsync(async (req, res) => {
    const { email, password } = signinSchema.parse(req.body);

    this.log.info(`Login attempt for email: ${email}`);

    const user = await authService.getUserByEmailWithPassword(email);
    if (!user) throw new Error('Invalid email or password');

    const isMatch = await authService.comparePassword(password, user.password);
    if (!isMatch) throw new Error('Invalid email or password');

    // Check if user is verified
    if (!user.isVerified) {
      throw new Error('Please verify your email first. Check your inbox for the verification code.');
    }

    // Generate tokens directly without OTP
    const tokens = {
      accessToken: Helpers.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
      }),
      refreshToken: Helpers.generateRefreshToken({ id: user.id }),
    };

    // Set cookies
    this._setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    // Remove sensitive data
    const { password: _, ...userWithoutPassword } = user;

    ResponseHandler.success(res, {
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        ...tokens,
      },
    });
  });
  verifyLoginOtp = catchAsync(async (req, res) => {
    const { email, otp } = verifyOtpSchema.parse(req.body);

    this.log.info(`Login OTP verification for email: ${email}`);

    const user = await authOtpService.verifyOtpFlow({
      email,
      otp,
      expectedPurpose: 'login',
    });

    const tokens = await authOtpService.issueTokens(user);

    this._setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    ResponseHandler.success(res, {
      message: 'Login successful',
      data: {
        user,
        ...tokens,
      },
    });
  });

  resendOtp = catchAsync(async (req, res) => {
    const { email, purpose } = resendOtpSchema.parse(req.body);

    this.log.info(`Resend OTP requested for: ${email}`);

    const user = await authService.getUserByEmail(email);
    if (!user) throw new Error('User not found');

    const otpPurpose = purpose ?? (user.isVerified ? 'login' : 'signup');

    const otp = authService.generateOtp();
    await authService.saveOtp(user.id, otp, otpPurpose);

    await mailTransport
      .sendOtpEmail(user.email, otp, user.name, otpPurpose)
      .catch((err) => this.log.error(`Resend OTP failed: ${err.message}`));

    this.log.info(`OTP resent to: ${user.email} (purpose: ${otpPurpose})`);

    ResponseHandler.success(res, {
      message: 'A new verification code has been sent to your email.',
      data: {
        email: user.email,
        ...(config.NODE_ENV === 'development' && { otp }),
      },
    });
  });

  refreshToken = catchAsync(async (req, res) => {
    let refreshToken = null;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      refreshToken = authHeader.substring(7);
    }

    if (!refreshToken) refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) throw new Error('Refresh token required');

    const decoded = Helpers.verifyRefreshToken(refreshToken);
    if (!decoded?.id) throw new Error('Invalid or expired refresh token');

    const user = await authService.getUserById(decoded.id);
    if (!user) throw new Error('User not found');

    const newAccessToken = Helpers.generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: config.NODE_ENV !== 'development',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    this.log.info(`Token refreshed for user: ${user.id}`);

    ResponseHandler.success(res, {
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          credits: user.credits,
          freeAdUsed: user.freeAdUsed,
        },
      },
    });
  });

  signOut = catchAsync(async (req, res) => {
    const userId = req.user?.id;
    this.log.info(`Signout for user: ${userId || 'unknown'}`);

    const cookieOptions = {
      httpOnly: true,
      secure: config.NODE_ENV !== 'development',
      sameSite: 'lax',
      path: '/',
    };

    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    res.clearCookie('userSession', cookieOptions);

    ResponseHandler.success(res, {
      message: 'Logged out successfully',
      data: { timestamp: new Date().toISOString() },
    });
  });


  forgotPassword = catchAsync(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    this.log.info(`Forgot password request for: ${email}`);

    const user = await authService.getUserByEmail(email);

    if (!user) {
      this.log.warn(`Forgot password attempt for non-existent email: ${email}`);
      throw new Error('No account found with this email address');
    }

    verificationStore.clearVerified(email);

    const otp = authService.generateOtp();
    await authService.saveOtp(user.id, otp, 'password_reset');

    try {
      await mailTransport.sendOtpEmail(user.email, otp, user.name, 'password_reset');
      this.log.info(`Password reset OTP sent to: ${user.email}`);
    } catch (emailError) {
      this.log.error(`Failed to send password reset OTP: ${emailError.message}`);
      throw new Error('Failed to send reset code. Please try again later.');
    }

    ResponseHandler.success(res, {
      message: 'A password reset code has been sent to your email address.',
      data: {
        email: user.email,
        ...(config.NODE_ENV === 'development' && { otp }),
      },
    });
  });
  resetPassword = catchAsync(async (req, res) => {
    const { newPassword, confirmPassword, email } = req.body;

    if (newPassword !== confirmPassword) {
      throw new Error("Passwords don't match");
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    if (!email) {
      throw new Error('Email is required');
    }

    if (!verificationStore.isVerified(email)) {
      throw new Error('Please verify your OTP first. OTP verification may have expired.');
    }

    const user = await authService.getUserByEmail(email);
    if (!user) throw new Error('User not found');

    const hashedPassword = await authService.hashPassword(newPassword);
    await authService.changePassword(user.id, hashedPassword);

    await authService.clearOtp(user.id);
    verificationStore.clearVerified(email);

    mailTransport
      .sendPasswordChangedEmail(user.email, user.name)
      .catch((err) => this.log.error(`Password changed email failed: ${err.message}`));

    this.log.info(`Password reset for user: ${user.id}`);

    ResponseHandler.success(res, {
      message: 'Password reset successfully. You can now login with your new password.',
    });
  });

  verifyResetOtp = catchAsync(async (req, res) => {
    const { otp, email } = req.body;

    if (!email) throw new Error('Email is required');
    if (!otp) throw new Error('OTP is required');

    this.log.info(`Password reset OTP verification for email: ${email}`);

    const user = await authOtpService.verifyOtpFlow({
      email,
      otp,
      expectedPurpose: 'password_reset',
    });

    verificationStore.setVerified(email);

    ResponseHandler.success(res, {
      message: 'OTP verified successfully. You can now reset your password.',
      data: {
        email: user.email,
        verified: true
      },
    });
  });



  changePassword = catchAsync(async (req, res) => {
    if (!req.user?.id) throw new Error('User not authenticated');

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const userId = req.user.id;

    const user = await authService.getUserByIdWithPassword(userId);
    if (!user) throw new Error('User not found');

    const isMatch = await authService.comparePassword(currentPassword, user.password);
    if (!isMatch) throw new Error('Current password is incorrect');

    const hashedPassword = await authService.hashPassword(newPassword);
    await authService.changePassword(userId, hashedPassword);

    mailTransport
      .sendPasswordChangedEmail(user.email, user.name)
      .catch((err) => this.log.error(`Password changed email failed: ${err.message}`));

    this.log.info(`Password changed for user: ${userId}`);

    ResponseHandler.updated(res, { message: 'Password changed successfully' });
  });

  googleAuth = catchAsync(async (req, res, next) => {

    passport.authenticate('google', {
      scope: ['profile', 'email'],
      session: false
    })(req, res, next);
  });

  googleCallback = catchAsync(async (req, res, next) => {


    passport.authenticate('google', { session: false }, async (err, data, info) => {
      if (err || !data) {
        console.error('Google auth error:', err);
        const errorMessage = err?.message || 'google_auth_failed';
        return res.redirect(`${config.FRONTEND_URL}/auth/login?error=${errorMessage}`);
      }

      const { user, tokens } = data;


      // Set cookies
      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: config.NODE_ENV !== 'development',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV !== 'development',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      const userData = encodeURIComponent(JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        credits: user.credits,
        isVerified: user.isVerified
      }));
      const redirectUrl = `${config.FRONTEND_URL}/auth/google-callback?token=${tokens.accessToken}&user=${userData}`;


      return res.redirect(redirectUrl);
    })(req, res, next);
  });


}

export const authController = new AuthController();
export { AuthController };