import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { User } from '../models/User';
import { generateToken, setTokenCookie } from '../middleware/auth';
import { storeOAuthState, getOAuthState, linkAnonQuota } from '../services/redis';
import { getAnonId } from '../middleware/anonId';
import { env } from '../utils/env';
import { logger } from '../utils/logger';

const router = Router();

// Google OAuth client
const oauth2Client = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

/**
 * GET /auth/google/init
 * Initialize Google OAuth flow with PKCE
 */
router.get('/init', async (req: Request, res: Response) => {
  try {
    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state and code verifier in Redis
    await storeOAuthState(state, {
      codeVerifier,
      redirectTo: req.query.redirect_uri as string || env.OAUTH_SUCCESS_URL
    });

    // Build authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    logger.info('Google OAuth initiated', { state });
    res.redirect(authUrl);
  } catch (error) {
    logger.error('Google OAuth init error:', error);
    res.status(500).json({ error: 'Failed to initialize OAuth' });
  }
});

/**
 * GET /auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      logger.error('Google OAuth error:', error);
      return res.redirect(`${env.OAUTH_SUCCESS_URL}?error=oauth_denied`);
    }

    if (!code || !state) {
      logger.error('Missing code or state in OAuth callback');
      return res.redirect(`${env.OAUTH_SUCCESS_URL}?error=invalid_callback`);
    }

    // Retrieve and validate state
    const stateData = await getOAuthState(state as string);
    if (!stateData) {
      logger.error('Invalid or expired OAuth state');
      return res.redirect(`${env.OAUTH_SUCCESS_URL}?error=invalid_state`);
    }

    const { codeVerifier, redirectTo } = stateData;

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken({
      code: code as string,
      code_verifier: codeVerifier,
    });

    if (!tokens.id_token) {
      logger.error('No ID token received from Google');
      return res.redirect(`${env.OAUTH_SUCCESS_URL}?error=no_id_token`);
    }

    // Verify ID token
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      logger.error('Invalid ID token payload');
      return res.redirect(`${env.OAUTH_SUCCESS_URL}?error=invalid_token`);
    }

    // Validate required fields
    if (!payload.email || !payload.email_verified || !payload.sub) {
      logger.error('Missing required fields in ID token', { payload });
      return res.redirect(`${env.OAUTH_SUCCESS_URL}?error=missing_fields`);
    }

    if (!payload.email_verified) {
      logger.error('Email not verified', { email: payload.email });
      return res.redirect(`${env.OAUTH_SUCCESS_URL}?error=email_not_verified`);
    }

    // Find or create user
    const user = await User.findOrCreateByGoogle(payload.email, {
      sub: payload.sub,
      name: payload.name,
      picture: payload.picture,
    });

    // Generate JWT token
    const token = generateToken(user._id.toString(), user.email);

    // Link anonymous quota if anon cookie exists
    const anonId = getAnonId(req);
    if (anonId) {
      try {
        const linkResult = await linkAnonQuota(user._id.toString(), anonId);
        if (linkResult.linked) {
          logger.info(`Linked ${linkResult.count} anonymous enhancements to user ${user._id}`);
        }
      } catch (error) {
        logger.error('Failed to link anonymous quota:', error);
      }
    }

    // Determine redirect URL
    const successUrl = redirectTo || env.OAUTH_SUCCESS_URL;
    
    // For Chrome extension, return HTML that posts message to opener
    if (req.headers['user-agent']?.includes('Chrome') && req.query.extension === 'true') {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Successful</title>
        </head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'oauth_success',
                token: '${token}',
                user: {
                  id: '${user._id}',
                  email: '${user.email}',
                  emailVerified: ${user.emailVerified}
                }
              }, '*');
              window.close();
            } else {
              window.location.href = '${successUrl}?token=${token}';
            }
          </script>
          <p>Authentication successful. You can close this window.</p>
        </body>
        </html>
      `;
      res.send(html);
    } else {
      // For web app, set cookie and redirect
      setTokenCookie(res, token);
      res.redirect(`${successUrl}?success=true`);
    }

    logger.info('Google OAuth successful', { userId: user._id, email: user.email });
  } catch (error) {
    logger.error('Google OAuth callback error:', error);
    res.redirect(`${env.OAUTH_SUCCESS_URL}?error=oauth_failed`);
  }
});

export default router;
