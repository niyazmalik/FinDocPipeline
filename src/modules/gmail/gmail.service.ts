import { Injectable, Logger } from '@nestjs/common';
import { gmail_v1, google } from 'googleapis';
import { AuthService } from '../auth/auth.service';
import { EmailMeta } from 'src/utils/types/email-meta.type';
import { GeminiService } from '../gemini/gemini.service';

@Injectable()
export class GmailService {
    private readonly logger = new Logger(GmailService.name);

    constructor(
        private readonly authService: AuthService,
        private readonly geminiService: GeminiService,
    ) { }

    async processEmails(userId: string): Promise<EmailMeta[]> {
        const oauth2Client = await this.authService.getAuthenticatedUser(userId);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Fetching just 5 emails by message IDs...
        const res = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 5,
        });

        const messageIds = res.data.messages?.map(m => m.id!) || [];

        // let messageIds: string[] = [];
        // let nextPageToken: string | undefined;
        // do {
        //     const res = await gmail.users.messages.list({
        //         userId: 'me',
        //         maxResults: 5,
        //         pageToken: nextPageToken,
        //     });

        //     const ids = res.data.messages?.map(m => m.id!).filter(Boolean) || [];
        //     messageIds = messageIds.concat(ids);
        //     nextPageToken = res.data.nextPageToken || undefined;
        // } while (nextPageToken);


        // collecting lightweight metadata...no attachments yet...
        const emailsMeta: (Omit<EmailMeta, "attachments" | "classification"> & { payload?: gmail_v1.Schema$MessagePart })[] = [];

        for (const id of messageIds) {
            const m = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
            const headers = m.data.payload?.headers || [];

            const subject = this.getHeader(headers, 'Subject');
            const sender = this.getHeader(headers, 'From');
            const date = this.getHeader(headers, 'Date');
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
                payload: m.data.payload ?? undefined,
            });
        }

        // classifying in batch using Gemini
        const classifications = await this.geminiService.classifyEmailsBatch(
            emailsMeta.map(e => ({
                id: e.id,
                subject: e.subject,
                snippet: e.snippet,
            }))
        );

        // Step 3: fetch attachments only for financial emails
        const results: EmailMeta[] = [];

        for (const email of emailsMeta) {
            const classification = classifications[email.id] || { category: 'non-financial', confidence: 0 };
            let attachments: { filename: string; data: Buffer }[] | undefined;

            if (classification.category === 'financial') {
                attachments = [];

                const collectParts = async (parts?: gmail_v1.Schema$MessagePart[]) => {
                    if (!parts) return;
                    for (const part of parts) {
                        if (part.filename && part.body?.attachmentId) {
                            const attach = await gmail.users.messages.attachments.get({
                                userId: 'me',
                                messageId: email.id,
                                id: part.body.attachmentId,
                            });
                            if (attach.data.data) {
                                attachments!.push({
                                    filename: part.filename,
                                    data: Buffer.from(attach.data.data, 'base64'),
                                });
                            }
                        }
                        // recursively checking if nested parts exist
                        if (part.parts) await collectParts(part.parts);
                    }
                };

                await collectParts(email.payload?.parts);
            }

            results.push({
                id: email.id,
                sender: email.sender,
                subject: email.subject,
                date: email.date,
                invoiceNumber: email.invoiceNumber,
                attachments,
                classification,
                snippet: email.snippet,
            });

            // Will handle this also to gemini once classification works flawlessly...
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

    private getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
        return headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
    }
}