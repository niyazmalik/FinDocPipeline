import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { EmailClassification } from 'src/common/types/email-meta.type';
import { buildEmailClassifierPrompt } from 'src/common/prompts/email-classifier.prompt';

@Injectable()
export class GeminiService {
    private readonly logger = new Logger(GeminiService.name);
    private readonly genAI: GoogleGenerativeAI;

    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    }

    /**
     * Classifying emails into financial or non-financial (with subtypes).
     * Returns a record keyed by email ID.
     */
    async classifyEmailsBatch(emails: { id: string; subject: string; snippet: string }[],
    ): Promise<Record<string, EmailClassification>> {
        if (!emails.length) return {};

        const model = this.genAI.getGenerativeModel(
            { model: 'gemini-2.5-pro' },
            { apiVersion: 'v1beta' },
        );

        const emailsJson = emails.map(e => ({
            id: e.id,
            subject: e.subject,
            body: e.snippet,
        }));

        const prompt = buildEmailClassifierPrompt(emailsJson);

        try {
            this.logger.debug('Sending prompt to Gemini...');
            const res = await model.generateContent(prompt);
            const raw = res?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (!raw) {
                this.logger.error('Gemini returned empty response for batch classification');
                return this.fallbackClassification(emails);
            }

            this.logger.debug(`Raw Gemini response: ${raw}`);

            // Removing markdown fences like ```json ... ```
            const cleaned = raw.replace(/```json|```/g, '').trim();
            this.logger.debug(`Cleaned response: ${cleaned}`);

            const parsed = JSON.parse(cleaned) as {
                id: string;
                category: string;
                confidence: number;
            }[];
            this.logger.debug(`Parsed JSON: ${JSON.stringify(parsed, null, 2)}`);

            const result: Record<string, EmailClassification> = {};
            for (const item of parsed) {
                const cat = this.parseCategory(item.category);
                result[item.id] = {
                    category: cat,
                    confidence: this.clampConfidence(item.confidence),
                };
            }
            this.logger.debug(`Final classification result: ${JSON.stringify(result, null, 2)}`);
            return result;
        } catch (err) {
            this.logger.error('Failed to classify emails with Gemini, so going for fallback', err);
            return this.fallbackClassification(emails);
        }
    }

    /** Ensuring confidence is between 0 and 1 */
    private clampConfidence(value: number): number {
        if (typeof value !== 'number' || isNaN(value)) return 0;
        return Math.min(1, Math.max(0, value));
    }

    /** Converting string category into structured EmailClassification */
    private parseCategory(raw: string): EmailClassification['category'] {
        if (raw === 'financial') {
            return { type: 'financial' };
        }

        if (raw.startsWith('non-financial:')) {
            const subType = raw.split(':')[1] as
                | 'personal'
                | 'appointments'
                | 'government'
                | 'other';
            if (['personal', 'appointments', 'government', 'other'].includes(subType)) {
                return { type: 'non-financial', subType };
            }
        }

        // default fallback
        this.logger.warn(`Unexpected category string from Gemini: ${raw}`);
        return { type: 'non-financial', subType: 'other' };
    }

    /** Fallback classification if Gemini fails */
    private fallbackClassification(
        emails: { id: string; subject: string; snippet: string }[],
    ): Record<string, EmailClassification> {
        const fallback: Record<string, EmailClassification> = {};
        for (const e of emails) {
            fallback[e.id] = {
                category: { type: 'non-financial', subType: 'other' },
                confidence: 0,
            };
        }
        return fallback;
    }
}

