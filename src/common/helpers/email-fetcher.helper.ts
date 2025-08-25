import { gmail_v1 } from 'googleapis';

const PROCESSED_LABELS = [
  'Financial',
  'Personal',
  'Appointment',
  'Government',
  'Other',
];

/**
 * Building Gmail search query to exclude spam, trash, and processed labels.
 */
function buildExclusionQuery(existingLabels: string[]): string {
  const base = '-in:spam -in:trash newer_than:30d';

  const validExclusions = PROCESSED_LABELS.filter(label =>
    existingLabels.includes(label),
  );

  const excludeLabels = validExclusions.map(l => `-label:${l}`).join(' ');
  return `${base} ${excludeLabels}`;
}

/**
 * Fetching all unprocessed emails from INBOX (paginated).
 */
export async function fetchUnprocessedEmails(
  gmail: gmail_v1.Gmail,
  maxResultsPerPage = 10,
): Promise<string[]> {
  let messageIds: string[] = [];
  let nextPageToken: string | undefined;

  // Fetching existing labels...
  const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
  const existingLabels = labelsResponse.data.labels?.map(l => l.name!) || [];

  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults: maxResultsPerPage,
      q: buildExclusionQuery(existingLabels),
      pageToken: nextPageToken,
    });

    const ids = res.data.messages?.map(m => m.id!).filter(Boolean) || [];
    messageIds = messageIds.concat(ids);
    nextPageToken = res.data.nextPageToken || undefined;
  } while (nextPageToken);

  return messageIds;
}