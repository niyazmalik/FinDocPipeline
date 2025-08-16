import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class SheetService {
  private readonly logger = new Logger(SheetService.name);

  constructor(private readonly authService: AuthService) {}

  // Spreadsheet ID from env
  private readonly spreadsheetId = process.env.SHEET_SPREADSHEET_ID;

  /**
   * Logs a single file/email info to Google Sheets
   */
  async logFile(
    userId: string,
    data: {
      sender: string;
      subject: string;
      date: string;
      invoiceNumber: string | null;
      driveFileId: string;
    },
  ) {
    if (!this.spreadsheetId) {
      throw new Error('SHEET_SPREADSHEET_ID not set in environment variables.');
    }

    const oauth2Client = await this.authService.getAuthenticatedUser(userId);
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    const row = [
      data.sender,
      data.subject,
      data.date,
      data.invoiceNumber ?? '',
      data.driveFileId,
    ];

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [row],
        },
      });
      this.logger.log(`Logged file ${data.driveFileId} to Google Sheets.`);
    } catch (err) {
      this.logger.error('Failed to log to Google Sheets', err);
      throw err;
    }
  }

  /**
   * Logs multiple files at once
   */
  async logFiles(userId: string, files: {
    sender: string;
    subject: string;
    date: string;
    invoiceNumber: string | null;
    driveFileId: string;
  }[]) {
    for (const file of files) {
      await this.logFile(userId, file);
    }
  }
}
