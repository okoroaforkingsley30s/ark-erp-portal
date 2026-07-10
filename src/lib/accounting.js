import { supabase } from "@/lib/supabaseClient";

const toAmount = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const roundMoney = (value) => Math.round(toAmount(value) * 100) / 100;

export function validateBalancedJournalEntries(lines = []) {
  const totals = lines.reduce(
    (acc, line) => {
      const debit = roundMoney(line?.debit);
      const credit = roundMoney(line?.credit);

      if (debit > 0 && credit > 0) {
        acc.errors.push("A journal line cannot have both debit and credit.");
      }

      if (debit <= 0 && credit <= 0) {
        acc.errors.push("Each journal line must have either a debit or credit amount.");
      }

      acc.debitTotal += debit;
      acc.creditTotal += credit;
      return acc;
    },
    { debitTotal: 0, creditTotal: 0, errors: [] }
  );

  totals.debitTotal = roundMoney(totals.debitTotal);
  totals.creditTotal = roundMoney(totals.creditTotal);
  totals.lineCount = lines.length;
  totals.isBalanced =
    lines.length >= 2 &&
    totals.debitTotal > 0 &&
    totals.debitTotal === totals.creditTotal &&
    totals.errors.length === 0;

  if (lines.length < 2) {
    totals.errors.push("A journal needs at least two lines.");
  }

  if (totals.debitTotal !== totals.creditTotal) {
    totals.errors.push("Total debit must equal total credit.");
  }

  return totals;
}

export async function generateJournalNumber(prefix = "JV", journalDate = new Date()) {
  const date =
    journalDate instanceof Date
      ? journalDate.toISOString().slice(0, 10)
      : journalDate;

  const { data, error } = await supabase.rpc("finance_generate_journal_no", {
    p_prefix: prefix,
    p_journal_date: date,
  });

  if (error) throw error;
  return data;
}

export async function calculateAccountStatement({
  accountId,
  fromDate,
  toDate,
  limit = 500,
} = {}) {
  if (accountId) {
    const { data, error } = await supabase.rpc("finance_calculate_account_statement", {
      p_account_id: accountId,
      p_from_date: fromDate || null,
      p_to_date: toDate || null,
    });

    if (error) throw error;
    return (data || []).slice(0, limit);
  }

  let query = supabase
    .from("finance_account_statement_view")
    .select("*")
    .order("journal_date", { ascending: true })
    .order("created_at", { ascending: true })
    .order("line_no", { ascending: true })
    .limit(limit);

  if (accountId) query = query.eq("account_id", accountId);
  if (fromDate) query = query.gte("journal_date", fromDate);
  if (toDate) query = query.lte("journal_date", toDate);

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

export async function calculateTrialBalance({
  accountType,
  fromDate,
  toDate,
  limit = 500,
} = {}) {
  const { data, error } = await supabase.rpc("finance_calculate_trial_balance", {
    p_from_date: fromDate || null,
    p_to_date: toDate || null,
  });

  if (error) throw error;

  const rows = accountType
    ? (data || []).filter((row) => row.account_type === accountType)
    : data || [];

  return rows.slice(0, limit);
}

export async function validatePostedJournalBalance(journalId) {
  const { data, error } = await supabase.rpc("finance_validate_balanced_journal", {
    p_journal_id: journalId,
  });

  if (error) throw error;
  return data === true;
}

export async function createReversalJournal({
  journalId,
  createdBy,
  createdByName,
  narration,
}) {
  const { data, error } = await supabase.rpc("finance_create_reversal_journal", {
    p_original_journal_id: journalId,
    p_created_by: createdBy || null,
    p_created_by_name: createdByName || null,
    p_narration: narration || null,
  });

  if (error) throw error;
  return data;
}
