        export type ScannedEmail = {
            id: string;
            sender: string;
            subject: string;
            date: string;
            invoiceNumber: string | null;
            attachments: { filename: string; data: Buffer }[];
        };