import { Injectable, Logger } from '@nestjs/common';
import { DriveService } from 'src/modules/drive/drive.service';
import { GmailService } from 'src/modules/gmail/gmail.service';
import { SheetService } from 'src/modules/sheet/sheet.service';
import { ScannedEmail } from 'src/utils/types/scanned-email.type';
import { InjectRepository } from '@nestjs/typeorm';
import { Email } from 'src/entities/email.entity';
import { User } from 'src/entities/user.entity';
import { Repository, DataSource } from 'typeorm';
import { GoogleDriveFile } from 'src/entities/google-drive-file.entity';
import { GoogleSheetsRecord } from 'src/entities/google-sheets-record.entity';
import { ProcessedEmail } from 'src/entities/processed-email.entity';

@Injectable()
export class ScanService {
    private readonly logger = new Logger(ScanService.name);

    constructor(
        private readonly gmailService: GmailService,
        private readonly driveService: DriveService,
        private readonly sheetService: SheetService,
        private readonly dataSource: DataSource,

        @InjectRepository(Email)
        private readonly emailRepo: Repository<Email>,

        @InjectRepository(User)
        private readonly userRepo: Repository<User>,

        @InjectRepository(GoogleDriveFile)
        private readonly driveRepo: Repository<GoogleDriveFile>,

        @InjectRepository(GoogleSheetsRecord)
        private readonly sheetRepo: Repository<GoogleSheetsRecord>,

        @InjectRepository(ProcessedEmail)
        private readonly processedRepo: Repository<ProcessedEmail>,
    ) { }

    async processInbox(userId: string) {
        const emails: ScannedEmail[] =
            await this.gmailService.processFinancialEmails(userId);

        if (!emails.length) {
            this.logger.log('No financial emails to process.');
            return [];
        }

        const user = await this.userRepo.findOneByOrFail({ id: userId });

        // Use a transaction to keep consistency
        return this.dataSource.transaction(async (manager) => {
            const savedEmails: Email[] = [];

            for (const email of emails) {
                //  Save Email
                const savedEmail = await manager.getRepository(Email).save(
                    manager.getRepository(Email).create({
                        gmail_message_id: email.id,
                        sender: email.sender,
                        subject: email.subject,
                        body_snippet: "",
                        date_received: new Date(email.date),
                        user,
                        is_processed: true,
                        google_label: null, // will be updated after Gmail label applied
                    }),
                );

                savedEmails.push(savedEmail);

                // Prepare and upload attachments
                const filesToUpload = email.attachments.map((att) => ({
                    filename: att.filename,
                    data: att.data,
                    sender: email.sender,
                    invoiceNumber: email.invoiceNumber,
                    date: email.date,
                }));

                const uploadedFileIds = await this.driveService.uploadFiles(
                    userId,
                    filesToUpload,
                );

                // Save GoogleDriveFile records
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

                // Log into Sheets
                const sheetLogs = filesToUpload.map((file, idx) => ({
                    sender: file.sender,
                    subject: email.subject,
                    date: file.date,
                    invoiceNumber: file.invoiceNumber,
                    driveFileId: uploadedFileIds[idx],
                }));
                await this.sheetService.logFiles(userId, sheetLogs);

                const generatedSheetRowIds = await this.sheetService.logFiles(userId, sheetLogs);

                // Save GoogleSheetsRecord
                const sheetRecords = driveFiles.map((file, idx) =>
                    manager.getRepository(GoogleSheetsRecord).create({
                        email: savedEmail,
                        file,
                        sheet_row_id: generatedSheetRowIds[idx],
                    }),
                );
                await manager.getRepository(GoogleSheetsRecord).save(sheetRecords);

                // 6. Link into ProcessedEmail table
                const processed = manager.getRepository(ProcessedEmail).create({
                    email: savedEmail,
                    is_financial: true,
                    processed_date: new Date(),
                    gemini_confidence_score: 0,
                });
                await manager.getRepository(ProcessedEmail).save(processed);

                // 7. Apply Gmail label & update email record
                await this.gmailService.applyLabel(userId, [email.id]);
                savedEmail.google_label = 'Financial-Processed'; // whatever label you apply
                await manager.getRepository(Email).save(savedEmail);
            }

            this.logger.log(`Processed ${savedEmails.length} emails for user ${userId}`);
            return savedEmails.map((e) => e.id);
        });
    }
}
