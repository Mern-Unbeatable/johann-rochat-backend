import express from 'express';
import { authMiddleware } from '../../shared/globals/helpers/auth-middleware.js';
import { authController } from './auth.controller.js';

const router = express.Router();
router.post('/signup', authController.signUp);
router.post('/verify-signup-otp', authController.verifySignupOtp);
router.post('/signin', authController.signIn);
router.post('/verify-login-otp', authController.verifyLoginOtp);
router.post('/resend-otp', authController.resendOtp);
router.post('/refresh-token', authController.refreshToken);
router.post('/signout', authMiddleware.protect, authController.signOut);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.patch('/change-password', authMiddleware.protect, authController.changePassword);
router.post('/verify-reset-otp', authController.verifyResetOtp);
router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleCallback);
export const authRoutes = router;
