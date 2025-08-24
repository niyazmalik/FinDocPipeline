import { Injectable, Logger } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { DriveService } from 'src/modules/drive/drive.service';
import { GmailService } from 'src/modules/gmail/gmail.service';
import { SheetService } from 'src/modules/sheet/sheet.service';
import { EmailMeta } from 'src/common/types/email-meta.type';
import { GoogleDriveFile } from 'src/entities/google-drive-file.entity';
import { GoogleSheetsRecord } from 'src/entities/google-sheets-record.entity';
import { ProcessedEmail } from 'src/entities/processed-email.entity';
import { Email } from 'src/entities/email.entity';
import { User } from 'src/entities/user.entity';
import { resolveLabelFromClassification } from 'src/common/helpers/classification-label.helper';

@Injectable()
export class ScanService {
    private readonly logger = new Logger(ScanService.name);

    constructor(
        private readonly gmailService: GmailService,
        private readonly driveService: DriveService,
        private readonly sheetService: SheetService,
        private readonly dataSource: DataSource,

        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) {}

    async processInbox(userId: string) {
        // getting the emails
        const emails: EmailMeta[] =
            await this.gmailService.processEmails(userId);

        const user = await this.userRepo.findOneByOrFail({ id: userId });

        const savedEmailIds: string[] = [];

        for (const email of emails) {
            // Preparing the attachments (if any)
            const filesToUpload = email.attachments?.map((att) => ({
                filename: att.filename,
                data: att.data,
                sender: email.sender,
                invoiceNumber: email.invoiceNumber,
                date: email.date,
            }));

            // Step 1: External API calls (upload to Drive + log to Sheets)
            let uploadedFileIds: string[] = [];
            let generatedSheetRowIds: string[] = [];

            if (filesToUpload) {
                uploadedFileIds = await this.driveService.uploadFiles(
                    userId,
                    filesToUpload,
                );

                const sheetLogs = filesToUpload.map((file, idx) => ({
                    sender: file.sender,
                    subject: email.subject,
                    date: file.date,
                    invoiceNumber: file.invoiceNumber,
                    driveFileId: uploadedFileIds[idx],
                }));

                generatedSheetRowIds = await this.sheetService.logFiles(userId, sheetLogs);
            }

            /* Step 2: Using a transaction to maintain DB consistency.
               If any error occurs during this DB process, all changes will be rolled back. */
            await this.dataSource.transaction(async (manager) => {
                // Storing results of email classification and processing in the database
                const savedEmail = await manager.getRepository(Email).save({
                    gmail_message_id: email.id,
                    sender: email.sender,
                    subject: email.subject,
                    body_snippet: email.snippet,
                    date_received: new Date(email.date),
                    user,
                    is_processed: true,
                    google_label: resolveLabelFromClassification(email.classification),
                });

                savedEmailIds.push(savedEmail.id);

                if (filesToUpload && uploadedFileIds.length) {
                    // Saving the drive uploads data in database
                    const driveFiles = filesToUpload.map((file, idx) =>
                        manager.getRepository(GoogleDriveFile).create({
                            email: savedEmail,
                            file_id: uploadedFileIds[idx],
                            file_name: file.filename,
                            file_url: `https://drive.google.com/file/d/${uploadedFileIds[idx]}/view`,
                            folder_id: process.env.DRIVE_FOLDER_ID,
                        }),
                    );
                    await manager.getRepository(GoogleDriveFile).save(driveFiles);

                    // Saving the sheet logs data in database
                    const sheetRecords = driveFiles.map((file, idx) =>
                        manager.getRepository(GoogleSheetsRecord).create({
                            email: savedEmail,
                            file,
                            sheet_row_id: generatedSheetRowIds[idx],
                        }),
                    );
                    await manager.getRepository(GoogleSheetsRecord).save(sheetRecords);
                }

                /* Linking back to the original email and recording whether
                   it is financial along with Gemini confidence score in the database */
                const processed = manager.getRepository(ProcessedEmail).create({
                    email: savedEmail,
                    is_financial: email.classification.category.type === 'financial',
                    gemini_confidence_score: email.classification.confidence,
                    processed_date: new Date(),
                });
                await manager.getRepository(ProcessedEmail).save(processed);
            });
        }

        this.logger.log(`Processed ${savedEmailIds.length} emails for user ${userId}`);
        return savedEmailIds;
    }
}
