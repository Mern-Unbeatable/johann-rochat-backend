import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from '../../config/config.js';
import { authService } from './auth.services.js';
import { Helpers } from '../../shared/globals/helpers/helpers.js';

export const googleStrategy = new GoogleStrategy(
  {
    clientID: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    callbackURL: config.GOOGLE_CALLBACK_URL,
    scope: ['profile', 'email'],
    passReqToCallback: false,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {


      const email = profile.emails?.[0]?.value;
      const name = profile.displayName;
      const googleId = profile.id;

      if (!email) {
        return done(new Error('No email found from Google profile'), null);
      }

      let user = await authService.getUserByEmail(email);

      if (!user) {
        const randomPassword = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
        const hashedPassword = await authService.hashPassword(randomPassword);

        user = await authService.createUser({
          name: name,
          email: email,
          password: hashedPassword,
          googleId: googleId,
          consent: true,
          role: 'USER',
          credits: 1,
          freeAdUsed: false,
          isVerified: true,
        });


      } else if (!user.googleId) {

        await authService.linkGoogleAccount(user.id, googleId);
        user.googleId = googleId;
      }

      // Generate JWT tokens
      const tokens = {
        accessToken: Helpers.generateAccessToken({
          id: user.id,
          email: user.email,
          role: user.role,
        }),
        refreshToken: Helpers.generateRefreshToken({ id: user.id }),
      };

      return done(null, { user, tokens });
    } catch (error) {
      console.error('Google Strategy Error:', error);
      return done(error, null);
    }
  }
);