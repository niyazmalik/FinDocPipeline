import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { AuthService } from '../auth/auth.service';
import { Readable } from 'stream';

@Injectable()
export class DriveService {
    private readonly logger = new Logger(DriveService.name);
    private readonly folderId = process.env.DRIVE_FOLDER_ID;

    constructor(private readonly authService: AuthService) { }

    async uploadFiles(
        userId: string,
        files: { filename: string; data: Buffer; sender: string; invoiceNumber: string | null; date: string }[],
    ) {
        if (!this.folderId) {
            throw new Error('Drive folder ID not set in environment variables.');
        }

        const oauth2Client = await this.authService.getAuthenticatedUser(userId);
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Checking if folder exists
        try {
            const folder = await drive.files.get({
                fileId: this.folderId,
                fields: 'id, name, mimeType',
            });

            if (folder.data.mimeType !== 'application/vnd.google-apps.folder') {
                throw new Error('Provided DRIVE_FOLDER_ID is not a folder.');
            }
        } catch (err) {
            throw new Error('Drive folder not found or inaccessible.');
        }

        const uploaded: string[] = [];

        for (const file of files) {
            const ext = file.filename.split('.').pop(); // pdf, xls, etc.
            const safeSender = file.sender.replace(/[^a-zA-Z0-9]/g, '_'); // remove special chars
            const safeInvoice = file.invoiceNumber || 'NoInvoice';
            const safeDate = new Date(file.date).toISOString().split('T')[0]; // YYYY-MM-DD

            const structuredName = `${safeSender}_${safeInvoice}_${safeDate}.${ext}`;

            const bufferStream = new Readable();
            bufferStream.push(file.data);
            bufferStream.push(null);

            const res = await drive.files.create({
                requestBody: {
                    name: structuredName,
                    parents: [this.folderId],
                },
                media: {
                    mimeType: 'application/octet-stream',
                    body: bufferStream,
                },
            });

            uploaded.push(res.data.id!);
            this.logger.log(`Uploaded ${structuredName} to Drive`);
        }

        return uploaded;
    }
}
