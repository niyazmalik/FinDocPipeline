import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../../entities/user.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private oauth2Client: OAuth2Client;

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  getAuthUrl(): string {
    const SCOPES = [
      'openid',
      'profile',
      'email',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels',
      'https://www.googleapis.com/auth/drive',     // access user's Drive files
      'https://www.googleapis.com/auth/spreadsheets',   // access Google Sheets
    ];
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });
  }

  async handleCallback(code: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      const userInfo = await google.oauth2('v2').userinfo.get({ auth: this.oauth2Client });
      const email = userInfo.data.email;
      if (!email) throw new Error('Google did not return an email');

      let user = await this.userRepo.findOne({ where: { email } });
      if (!user) user = this.userRepo.create({ email });

      user.name = userInfo.data.name || '';
      user.picture = userInfo.data.picture || '';
      user.accessToken = tokens.access_token || '';
      user.refreshToken = tokens.refresh_token || user.refreshToken;
      user.scope = tokens.scope || '';
      user.tokenType = tokens.token_type || '';
      user.expiryDate = tokens.expiry_date ?? null;

      const savedUser = await this.userRepo.save(user);
      return { message: 'Login success', user: savedUser };
    } catch (err) {
      this.logger.error('Google login failed', err);
      throw err;
    }
  }

  async getAuthenticatedUser(userId: string): Promise<OAuth2Client> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const accessToken = user.decryptAccessToken();
    const refreshToken = user.decryptRefreshToken();
    if (!accessToken || !refreshToken) throw new Error('Tokens missing for user');

    try {
      // Refreshing if expired
      if (!user.expiryDate || user.expiryDate <= Date.now()) {
        this.oauth2Client.setCredentials({ refresh_token: refreshToken });
        const { credentials } = await this.oauth2Client.refreshAccessToken();

        if (!credentials.access_token) {
          throw new Error('Failed to refresh access token');
        }

        user.accessToken = credentials.access_token;
        user.expiryDate = credentials.expiry_date ?? null;
        await this.userRepo.save(user);
      }

      // Returning fully configured OAuth2Client
      this.oauth2Client.setCredentials({
        access_token: user.decryptAccessToken(),
        refresh_token: user.decryptRefreshToken(),
        expiry_date: user.expiryDate ?? undefined,
      });

      return this.oauth2Client;

    } catch (err) {
      if (err?.response?.data?.error === 'invalid_grant') {
        this.logger.warn(`User ${userId} refresh token invalid/revoked.`);
        throw new Error(
          'Refresh token expired or revoked. User must re-authenticate.'
        );
      }
      this.logger.error(`Unexpected error for user ${userId}:`, err);
      throw err; // re-throwing other unexpected errors
    }
  }

  async getUserByToken(token: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: [
        { accessToken: token },
        { refreshToken: token },
      ],
    });

    if (!user) {
      throw new Error('User not found for provided token');
    }

    return user;
  }
}
