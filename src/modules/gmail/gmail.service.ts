import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { AuthService } from '../auth/auth.service';
import { ScannedEmail } from 'src/utils/types/scanned-email.type';
import { GeminiService } from '../gemini/gemini.service';

@Injectable()
export class GmailService {
    private readonly logger = new Logger(GmailService.name);
  
    constructor(
        private readonly authService: AuthService,
        private readonly geminiService: GeminiService,
    ) { }

    async processEmails(userId: string): Promise<ScannedEmail[]> {
        const oauth2Client = await this.authService.getAuthenticatedUser(userId);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Fetching message IDs only
        let messageIds: string[] = [];
        let nextPageToken: string | undefined;
        do {
            const res = await gmail.users.messages.list({
                userId: 'me',
                maxResults: 5,
                pageToken: nextPageToken,
            });

            const ids = res.data.messages?.map(m => m.id!).filter(Boolean) || [];
            messageIds = messageIds.concat(ids);
            nextPageToken = res.data.nextPageToken || undefined;
        } while (nextPageToken);

        type EmailMeta = {
            id: string;
            subject: string;
            sender: string;
            date: string;
            snippet: string;
            invoiceNumber: string | null;
            payload: any; // Gmail API payload (for attachments)
        };

        const emailsMeta: EmailMeta[] = [];

        // Collecting email metadata before Gemini batch classification...
        for (const id of messageIds) {
            const m = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });

            const headers = m.data.payload?.headers || [];
            const subject = headers.find(h => h.name === 'Subject')?.value || '';
            const sender = headers.find(h => h.name === 'From')?.value || '';
            const date = headers.find(h => h.name === 'Date')?.value || '';
            const snippet = m.data.snippet || '';

            const invoiceNumberMatch = subject.match(/\b\d{4,}\b/);
            const invoiceNumber = invoiceNumberMatch ? invoiceNumberMatch[0] : null;

            emailsMeta.push({
                id,
                subject,
                sender,
                date,
                snippet,
                invoiceNumber,
                payload: m.data.payload,
            });
        }

        // Classifying all collected emails in one Gemini call...
        const classifications = await this.geminiService.classifyEmailsBatch(
            emailsMeta.map(e => ({
                id: e.id,
                subject: e.subject,
                snippet: e.snippet,
            })),
        );

        const results: ScannedEmail[] = [];

        for (const email of emailsMeta) {
            const classification = classifications[email.id] || {
                category: 'non-financial',
                confidence: 0,
            };

            const attachments: { filename: string; data: Buffer }[] = [];

            if (classification.category === 'financial') {
                const parts = email.payload?.parts || [];
                for (const part of parts) {
                    if (part.filename && part.body?.attachmentId) {
                        const attach = await gmail.users.messages.attachments.get({
                            userId: 'me',
                            messageId: email.id,
                            id: part.body.attachmentId,
                        });
                        if (attach.data.data) {
                            const data = Buffer.from(attach.data.data, 'base64');
                            attachments.push({ filename: part.filename, data });
                        }
                    }
                }
            }

            results.push({
                id: email.id,
                sender: email.sender,
                subject: email.subject,
                invoiceNumber: email.invoiceNumber,
                date: email.date,
                attachments,
                classification,
                snippet: email.snippet,
            });

            await this.applyLabel(
                userId,
                [email.id],
                classification.category === 'financial'
                    ? 'Processed_Financial'
                    : 'Processed_NonFinancial',
            );
        }

        return results;
    }

    private async applyLabel(
        userId: string,
        messageIds: string[],
        labelName: string,
    ) {
        if (!messageIds.length) return;

        const oauth2Client = await this.authService.getAuthenticatedUser(userId);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

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