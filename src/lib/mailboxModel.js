export const MAILBOX_FOLDERS = [
  'inbox',
  'starred',
  'snoozed',
  'sent',
  'drafts',
  'scheduled',
  'all',
  'spam',
  'trash',
];

export function normalizeAddress(value = '') {
  const text = String(value || '').trim();
  const match = text.match(/<([^>]+)>/);
  return (match?.[1] || text).trim().toLowerCase();
}

export function splitAddressList(value = '') {
  return String(value || '')
    .split(',')
    .map(normalizeAddress)
    .filter(Boolean);
}

export function uniqueAddressList(values = []) {
  return [...new Set(values.map(normalizeAddress).filter(Boolean))];
}

export function replyRecipients(message, ownAddress, replyAll = false) {
  const own = normalizeAddress(ownAddress);
  const sender = normalizeAddress(message?.sender_email);
  const originalTo = splitAddressList(message?.recipient_email);
  const originalCc = splitAddressList(message?.cc);
  const sentByOwner = sender === own || message?.is_sent || message?.direction === 'sent';

  if (!replyAll) {
    return {
      to: sentByOwner ? originalTo.join(', ') : sender,
      cc: '',
    };
  }

  const to = uniqueAddressList(sentByOwner ? originalTo : [sender])
    .filter((email) => email !== own);
  const cc = uniqueAddressList([
    ...(sentByOwner ? [] : originalTo),
    ...originalCc,
  ]).filter((email) => email !== own && !to.includes(email));

  return { to: to.join(', '), cc: cc.join(', ') };
}

export function isInMailboxFolder(message, folder) {
  const labels = Array.isArray(message?.label_ids) ? message.label_ids : [];
  if (folder === 'starred') return Boolean(message?.is_starred || labels.includes('STARRED')) && !message?.is_trash;
  if (folder === 'snoozed') return Boolean(message?.is_snoozed) && !message?.is_trash;
  if (folder === 'sent') return Boolean(message?.is_sent || message?.direction === 'sent' || labels.includes('SENT'));
  if (folder === 'drafts') return Boolean(message?.is_draft || labels.includes('DRAFT'));
  if (folder === 'scheduled') return message?.folder === 'scheduled';
  if (folder === 'spam') return Boolean(message?.is_spam || labels.includes('SPAM'));
  if (folder === 'trash') return Boolean(message?.is_trash || labels.includes('TRASH'));
  if (folder === 'all') return !message?.is_trash && !message?.is_spam;
  return labels.includes('INBOX') && !message?.is_trash && !message?.is_spam;
}

export function groupMailboxThreads(messages = []) {
  const groups = new Map();
  for (const message of messages) {
    const key = message.gmail_thread_id || message.id;
    const current = groups.get(key);
    if (!current || new Date(message.received_at || message.created_at) > new Date(current.received_at || current.created_at)) {
      groups.set(key, { ...message, thread_count: (current?.thread_count || 0) + 1 });
    } else {
      current.thread_count = (current.thread_count || 1) + 1;
    }
  }
  return [...groups.values()].sort(
    (a, b) => new Date(b.received_at || b.created_at) - new Date(a.received_at || a.created_at),
  );
}
