import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { EmailClassification } from 'src/utils/types/email-meta.type';

@Injectable()
export class GeminiService {
    private readonly logger = new Logger(GeminiService.name);
    private readonly genAI: GoogleGenerativeAI;

    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    }

    async classifyEmailsBatch(
        emails: { id: string; subject: string; snippet: string }[],
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

        const prompt = `
      You are an email classifier.
      Classify EACH email into one of two categories: "financial" or "non-financial". 
      Also provide a confidence score between 0 and 1.

      ⚠️ IMPORTANT: Reply ONLY with valid JSON array in the following format:
      [
        {
          "id": "<email-id>",
          "category": "financial" | "non-financial",
          "confidence": number
        },
        ...
      ]

      Emails:
      ${JSON.stringify(emailsJson, null, 2)}
    `;

        const res = await model.generateContent(prompt);

        // Safely access nested response
        const raw =
            res?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

        if (!raw) {
            this.logger.error('Gemini returned empty response for batch classification');
            return {};
        }

        // remove markdown fences like ```json ... ```
        let cleaned = raw.replace(/```json|```/g, "").trim();

        try {
            const parsed = JSON.parse(cleaned) as {
                id: string;
                category: 'financial' | 'non-financial';
                confidence: number;
            }[];

            const result: Record<string, EmailClassification> = {};
            for (const item of parsed) {
                result[item.id] = {
                    category: item.category,
                    confidence: item.confidence,
                };
            }
            return result;
        } catch (err) {
            this.logger.error('Failed to parse Gemini batch response', err);
            return {};
        }
    }
}
