import { Injectable, Logger } from '@nestjs/common';
import { GmailService } from '../gmail/gmail.service';
import { DriveService } from '../drive/drive.service';

@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);

  constructor(
    private readonly gmailService: GmailService,
    private readonly driveService: DriveService,
  ) {}

  async processInbox(userId: string) {
    // Scan Gmail for financial emails with attachments
    type Email = {
  id: string;
  sender: string;
  subject: string;
  date: string;
  invoiceNumber: string | null;
  attachments: { filename: string; data: Buffer }[];
};

    const emails: Email[] = await this.gmailService.processFinancialEmails(userId);
    
    if (!emails.length) {
      this.logger.log('No financial emails to process.');
      return [];
    }

    // Preparing files for Drive upload
    const filesToUpload = emails.flatMap(email =>
      email.attachments.map(att => ({
        filename: att.filename,
        data: att.data,
        sender: email.sender,
        invoiceNumber: email.invoiceNumber,
        date: email.date,
      })),
    );

    // Uploading to Drive
    const uploadedFileIds = await this.driveService.uploadFiles(userId, filesToUpload);

    // Applying Gmail label
    await this.gmailService.applyLabel(userId, emails.map(e => e.id));

    this.logger.log(`Processed ${uploadedFileIds.length} attachments and uploaded to Drive.`);
    return uploadedFileIds;
  }
}
