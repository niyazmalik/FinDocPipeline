import { gmail_v1, google } from 'googleapis';

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
function buildExclusionQuery(): string {
  const base = '-in:spam -in:trash';
  const excludeLabels = PROCESSED_LABELS.map(l => `-label:${l}`).join(' ');
  return `${base} ${excludeLabels}`;
}

/**
 * Fetching all unprocessed emails from INBOX (paginated).
 */
export async function fetchUnprocessedEmails(
  gmail: gmail_v1.Gmail,
  maxResultsPerPage = 100,
): Promise<string[]> {
  let messageIds: string[] = [];
  let nextPageToken: string | undefined;

  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults: maxResultsPerPage,
      q: buildExclusionQuery(),
      pageToken: nextPageToken,
    });

    const ids = res.data.messages?.map(m => m.id!).filter(Boolean) || [];
    messageIds = messageIds.concat(ids);
    nextPageToken = res.data.nextPageToken || undefined;
  } while (nextPageToken);

  return messageIds;
}