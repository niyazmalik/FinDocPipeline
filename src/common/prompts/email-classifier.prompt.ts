export function buildEmailClassifierPrompt(
  emailsJson: { id: string; subject: string; body: string }[],
): string {
  return `
You are an email classifier.
Classify EACH email into one of the following categories:

1. "financial" → invoices, salary slips, tax, bank, payments, receipts.
2. "non-financial:personal" → personal/family/friend messages.
3. "non-financial:appointments" → booking confirmations, hospital visits, passport seva, tickets.
4. "non-financial:government" → Aadhaar, PAN, tax dept., govt notifications.
5. "non-financial:other" → newsletters, promotions, spam, updates, uncategorized.

Return a JSON array ONLY in this format:
[
  {
    "id": "<email-id>",
    "category": "financial" | "non-financial:personal" | "non-financial:appointments" | "non-financial:government" | "non-financial:other",
    "confidence": number  // between 0 and 1
  },
  ...
]

Emails:
${JSON.stringify(emailsJson, null, 2)}
  `;
}