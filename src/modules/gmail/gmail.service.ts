import { Injectable, Logger } from '@nestjs/common';
import { gmail_v1, google } from 'googleapis';
import { AuthService } from '../auth/auth.service';
import { EmailMeta } from 'src/common/types/email-meta.type';
import { GeminiService } from '../gemini/gemini.service';
import { resolveLabelFromClassification } from 'src/common/helpers/classification-label.helper';
import { fetchUnprocessedEmails } from 'src/common/helpers/email-fetcher.helper';
import { EmailNormalizer } from 'src/common/helpers/email-nomalizer.helper';

@Injectable()
export class GmailService {
    private readonly logger = new Logger(GmailService.name);

    constructor(
        private readonly authService: AuthService,
        private readonly geminiService: GeminiService,
    ) { }

    // Caching for thread positions per request
    private threadIndexCache = new Map<
        string, // threadId
        { indexByMessageId: Record<string, number> }
    >();

    /**
     * Building (and caching) per-thread index for messages from the OTHER party (exclude the own messages).
     */
    private async buildThreadIndex(
        gmail: gmail_v1.Gmail,
        threadId: string,
        userEmail: string
    ) {
        const cached = this.threadIndexCache.get(threadId);
        if (cached) return cached;

        const t = await gmail.users.threads.get({
            userId: 'me',
            id: threadId,
            format: 'full',
        });

        const messages = t.data.messages ?? [];

        // Only keeping other-party messages
        const items = messages
            .map(m => {
                const headers = m.payload?.headers || [];
                const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
                const fromEmail = EmailNormalizer.normalizeSender(from);
                const internalDate = m.internalDate ? Number(m.internalDate) : 0;
                return { id: m.id!, fromEmail, internalDate };
            })
            .filter(x => x.fromEmail !== userEmail);

        // Sorting by time
        items.sort((a, b) => a.internalDate - b.internalDate);

        // Assigning the index
        const indexByMessageId: Record<string, number> = {};
        items.forEach((it, idx) => {
            indexByMessageId[it.id] = idx; // 0 = original, 1 = 1st reply, etc.
        });

        const built = { indexByMessageId };
        this.threadIndexCache.set(threadId, built);
        return built;
    }

    /** Getting this message's replyIndex among OTHER-PARTY messages in the thread. */
    private async getMailIndexForMessage(
        gmail: gmail_v1.Gmail,
        threadId: string,
        messageId: string,
        userEmail: string
    ): Promise<number> {
        const ti = await this.buildThreadIndex(gmail, threadId, userEmail);
        return ti.indexByMessageId[messageId] ?? 0; // default to 0 if not found
    }

    async processEmails(userId: string): Promise<EmailMeta[]> {
        const oauth2Client = await this.authService.getAuthenticatedUser(userId);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Getting user’s own email (so we can exclude own messages)
        const userInfo = await gmail.users.getProfile({ userId: 'me' });
        const userEmail = userInfo.data.emailAddress || '';

        // Fetching all unprocessed email IDs
        const messageIds = await fetchUnprocessedEmails(gmail);
        this.logger.debug(`Total mails fetched: ${messageIds.length}`);

        // collecting lightweight metadata...no attachments yet...
        const emailsMeta: (Omit<EmailMeta, "attachments" | "classification" | "invoiceNumber"> &
        { payload?: gmail_v1.Schema$MessagePart })[] = [];

        for (const id of messageIds) {
            const m = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
            const headers = m.data.payload?.headers || [];

            const sender = this.getHeader(headers, 'From');
            const normalizedSender = EmailNormalizer.normalizeSender(sender);

            if (normalizedSender === userEmail) { // if me, then skipping...
                continue;
            }

            const subject = this.getHeader(headers, 'Subject');
            const date = this.getHeader(headers, 'Date');
            const snippet = m.data.snippet || '';
            const threadId = m.data.threadId || 'unknown-thread';

            const mailIndex = await this.getMailIndexForMessage(gmail, threadId, id, userEmail);

            const normalizedSubject = EmailNormalizer.normalizeSubject(subject, threadId, mailIndex);

            emailsMeta.push({
                id,
                subject: normalizedSubject,
                sender: normalizedSender,
                date,
                snippet,
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

        // fetching attachments only for financial emails
        const results: EmailMeta[] = [];

        for (const email of emailsMeta) {
            const classification = classifications[email.id] || { category: 'non-financial', confidence: 0 };
            let attachments: { filename: string; data: Buffer }[] | undefined;
            let invoiceNumber: string | null = null;

            if (classification.category.type === 'financial') {

                const invoiceNumberMatch = email.subject.match(/(?:INV|Invoice|Bill|Receipt|#)?[-_ ]?\d{4,}/i);
                invoiceNumber = invoiceNumberMatch ? invoiceNumberMatch[0] : null;

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
                invoiceNumber,
                attachments,
                classification,
                snippet: email.snippet,
            });

            // Will handle this also to gemini once classification works flawlessly...
            await this.applyLabel(
                userId,
                [email.id],
                resolveLabelFromClassification(classification),
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

    private async countRepliesInThread(gmail: any, threadId: string): Promise<number> {
        const res = await gmail.users.threads.get({ userId: 'me', id: threadId });
        return res.data.messages?.length ? res.data.messages.length - 1 : 0;
        // -1 because the first message is not a "reply"
    }
}