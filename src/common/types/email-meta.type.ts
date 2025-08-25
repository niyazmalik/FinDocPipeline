export type NonFinancialSubCategory =
  | 'personal'
  | 'appointments'
  | 'government'
  | 'other'; // newsletters, spam, promos, etc.

export type EmailCategory =
  | { type: 'financial' }
  | { type: 'non-financial'; subType: NonFinancialSubCategory };

export type EmailClassification = {
  category: EmailCategory;
  confidence: number;
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