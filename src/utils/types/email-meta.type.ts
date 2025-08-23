export type EmailClassification = {
    category: 'financial' | 'non-financial';
    confidence: number; // 0–1 or 0–100 depending on your model
};

export type EmailMeta = {
    id: string;
    sender: string;
    subject: string;
    date: string;
    invoiceNumber: string | null;
    attachments?: { filename: string; data: Buffer }[];
    classification: EmailClassification;
    snippet: string;
};