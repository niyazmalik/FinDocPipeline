import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { AuthService } from '../auth/auth.service';
import { ScannedEmail } from 'src/utils/types/scanned-email.type';

@Injectable()
export class GmailService {
    private readonly logger = new Logger(GmailService.name);
    private keywords = ['invoice', 'receipt', 'bill'];
    private allowedSenders: string[] = [];

    constructor(
        private readonly authService: AuthService,

    ) { }

    async processFinancialEmails(userId: string): Promise<ScannedEmail[]> {
        const oauth2Client = await this.authService.getAuthenticatedUser(userId);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Constructing Gmail query
        let q = this.keywords.join(' OR ');
        if (this.allowedSenders.length > 0) {
            const senderQuery = this.allowedSenders.map((s) => `from:${s}`).join(' OR ');
            q += ` AND (${senderQuery})`;
        }

        // Only fetching emails with attachments
        q += ' has:attachment ';

        // Fetching message IDs only
        let messageIds: string[] = [];
        let nextPageToken: string | undefined;
        do {
            const res = await gmail.users.messages.list({
                userId: 'me',
                q,
                maxResults: 50,
                pageToken: nextPageToken,
            });

            const ids = res.data.messages?.map(m => m.id!).filter(Boolean) || [];
            messageIds = messageIds.concat(ids);
            nextPageToken = res.data.nextPageToken || undefined;
        } while (nextPageToken);

        const results: ScannedEmail[] = [];

        // Fetching each message and only keeping if financial attachments exist
        for (const id of messageIds) {
            const m = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });

            const headers = m.data.payload?.headers || [];
            const subject = headers.find(h => h.name === 'Subject')?.value || '';
            const sender = headers.find(h => h.name === 'From')?.value || '';
            const date = headers.find(h => h.name === 'Date')?.value || '';

            const invoiceNumberMatch = subject.match(/\b\d{4,}\b/);
            const invoiceNumber = invoiceNumberMatch ? invoiceNumberMatch[0] : null;

            const attachments: { filename: string; data: Buffer }[] = [];

            const parts = m.data.payload?.parts || [];
            for (const part of parts) {
                if (part.filename && part.body?.attachmentId) {
                    const isFinancial = /(invoice|reciept|receipt|bill)/i.test(part.filename);
                    /**  
                     * I have received a mail for my passport regarding appointment booking and it has an
                     * attachment [AppointmnetReciept.pdf]...Clearly receipt is a typo and that's
                     * why it was getting ignored, so I included it too ... 
                     **/

                    if (!isFinancial) continue;

                    const attach = await gmail.users.messages.attachments.get({
                        userId: 'me',
                        messageId: id,
                        id: part.body.attachmentId,
                    });

                    if (attach.data.data) {
                        const data = Buffer.from(attach.data.data, 'base64');
                        attachments.push({ filename: part.filename, data });
                    }
                }
            }

            // Only pushing emails with financial attachments
            if (attachments.length > 0) {
                results.push({ id, sender, subject, date, invoiceNumber, attachments });
            }
        }
        return results;
    }

    async applyLabel(userId: string, messageIds: string[]) {
        if (!messageIds.length) return;

        const oauth2Client = await this.authService.getAuthenticatedUser(userId);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const labelName = 'Processed_Financial';

        // Ensure label exists
        const labelsRes = await gmail.users.labels.list({ userId: 'me' });
        let label = labelsRes.data.labels?.find((l) => l.name === labelName);

        if (!label) {
            const newLabel = await gmail.users.labels.create({
                userId: 'me',
                requestBody: {
                    name: labelName,
                    labelListVisibility: 'labelShow',
                    messageListVisibility: 'show',
                },
            });
            label = newLabel.data;
        }

        // Applying label to each message
        await gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: {
                ids: messageIds,
                addLabelIds: [label.id!],
            },
        });

        this.logger.log(`Applied label "${labelName}" to ${messageIds.length} emails.`);
    }
}