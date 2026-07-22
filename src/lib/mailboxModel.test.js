import { describe, expect, it } from 'vitest';
import { groupMailboxThreads, isInMailboxFolder, replyRecipients } from './mailboxModel';

describe('ARK Mail mailbox model', () => {
  it('keeps Reply All To and CC separate and removes the signed-in mailbox', () => {
    expect(replyRecipients({
      sender_email: 'Client <client@example.com>',
      recipient_email: 'staff@arktechnologiesgroup.com, colleague@example.com',
      cc: 'manager@example.com, staff@arktechnologiesgroup.com',
    }, 'staff@arktechnologiesgroup.com', true)).toEqual({
      to: 'client@example.com',
      cc: 'colleague@example.com, manager@example.com',
    });
  });

  it('uses Gmail labels for folder membership', () => {
    const mail = { label_ids: ['INBOX', 'UNREAD', 'STARRED'], is_starred: true };
    expect(isInMailboxFolder(mail, 'inbox')).toBe(true);
    expect(isInMailboxFolder(mail, 'starred')).toBe(true);
    expect(isInMailboxFolder({ ...mail, is_trash: true }, 'inbox')).toBe(false);
  });

  it('shows one latest list row per Gmail conversation', () => {
    const rows = groupMailboxThreads([
      { id: '1', gmail_thread_id: 't', received_at: '2026-01-01T00:00:00Z' },
      { id: '2', gmail_thread_id: 't', received_at: '2026-01-02T00:00:00Z' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: '2', thread_count: 2 });
  });
});
