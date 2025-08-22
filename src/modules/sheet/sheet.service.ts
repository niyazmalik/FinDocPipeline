import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class SheetService {
  private readonly logger = new Logger(SheetService.name);

  constructor(private readonly authService: AuthService) { }

  private readonly spreadsheetId = process.env.SHEET_SPREADSHEET_ID;

  /**
   * Logs a single file/email info to Google Sheets
   * Returns the row index where it was inserted
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
  ): Promise<string> {
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
      // append row
      await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [row],
        },
      });

      // fetch row count (to know last written row index)
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A:A',
      });

      const rowIndex = res.data.values?.length ?? 0;
      const sheetRowId = `row_${rowIndex}`;

      this.logger.log(
        `Logged file ${data.driveFileId} to Google Sheets at row ${sheetRowId}.`,
      );

      return sheetRowId;
    } catch (err) {
      this.logger.error('Failed to log to Google Sheets', err);
      throw err;
    }
  }

  /**
   * Logs multiple files at once
   * Returns an array of generated row IDs
   */
  async logFiles(
    userId: string,
    files: {
      sender: string;
      subject: string;
      date: string;
      invoiceNumber: string | null;
      driveFileId: string;
    }[],
  ): Promise<string[]> {
    const rowIds: string[] = [];
    for (const file of files) {
      const rowId = await this.logFile(userId, file);
      rowIds.push(rowId);
    }
    return rowIds;
  }
}
