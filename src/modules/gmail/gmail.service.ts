import { Injectable } from '@nestjs/common';
import { google, gmail_v1 } from 'googleapis';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class GmailService {
    constructor(private readonly authService: AuthService) { }

    private keywords = ['invoice', 'receipt', 'bill'];
    private allowedSenders: string[] = [];

    async scanInbox(userId: string) {
        // Get fully authenticated OAuth2Client
        const oauth2Client = await this.authService.getAuthenticatedUser(userId);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Construct Gmail search query
        let q = this.keywords.join(' OR ');
        if (this.allowedSenders.length > 0) {
            const senderQuery = this.allowedSenders.map(s => `from:${s}`).join(' OR ');
            q += ` AND (${senderQuery})`;
        }

        let messages: gmail_v1.Schema$Message[] = [];
        let nextPageToken: string | undefined;

        // Pagination
        do {
            const res = await gmail.users.messages.list({
                userId: 'me',
                q,
                maxResults: 50,
                pageToken: nextPageToken,
            });

            messages = messages.concat(res.data.messages || []);
            nextPageToken = res.data.nextPageToken || undefined;
        } while (nextPageToken);

        const results: {
            id: string;
            sender: string;
            subject: string;
            date: string;
            invoiceNumber: string | null;
            attachments: { filename: string; data: Buffer }[];
        }[] = [];

        // Fetch each message
        for (const msg of messages) {
            const m = await gmail.users.messages.get({ userId: 'me', id: msg.id!, format: 'full' });

            const headers = m.data.payload?.headers || [];
            const subject = headers.find(h => h.name === 'Subject')?.value || '';
            const sender = headers.find(h => h.name === 'From')?.value || '';
            const date = headers.find(h => h.name === 'Date')?.value || '';

            // Extract invoice number from subject (4+ digits)
            const invoiceNumberMatch = subject.match(/\b\d{4,}\b/);
            const invoiceNumber = invoiceNumberMatch ? invoiceNumberMatch[0] : null;

            const attachments: { filename: string; data: Buffer }[] = [];

            const parts = m.data.payload?.parts || [];
            for (const part of parts) {
                if (part.filename && part.body?.attachmentId) {
                    const isFinancial = /(invoice|receipt|bill)/i.test(part.filename);
                    if (!isFinancial) continue;

                    const attach = await gmail.users.messages.attachments.get({
                        userId: 'me',
                        messageId: msg.id!,
                        id: part.body.attachmentId,
                    });

                    if (attach.data.data) {
                        const data = Buffer.from(attach.data.data, 'base64');
                        attachments.push({ filename: part.filename, data });
                    }
                }
            }

            results.push({ id: msg.id!, sender, subject, date, invoiceNumber, attachments });
        }

        return results;
    }
}
