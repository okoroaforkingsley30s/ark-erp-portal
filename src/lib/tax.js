import { supabase } from "@/lib/supabaseClient";

const toAmount = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

export function calculateTaxAmount(taxableAmount, taxRate) {
  return Math.round((toAmount(taxableAmount) * toAmount(taxRate) / 100) * 100) / 100;
}

export async function fetchTaxCodes() {
  const { data, error } = await supabase
    .from("finance_tax_codes")
    .select("*")
    .eq("is_active", true)
    .order("tax_code", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchTaxRates(taxCodeId) {
  let query = supabase
    .from("finance_tax_rates")
    .select("*, finance_tax_codes(tax_code, tax_name, tax_type)")
    .eq("is_active", true)
    .order("effective_from", { ascending: false });

  if (taxCodeId) query = query.eq("tax_code_id", taxCodeId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createTaxTransactionDraft({
  taxCodeId,
  taxRateId,
  sourceModule = "finance",
  sourceTable,
  sourceId,
  taxableAmount,
  dueDate,
  currency = "NGN",
  paymentReference,
  notes,
  metadata = {},
}) {
  const { data, error } = await supabase.rpc("finance_create_tax_transaction_draft", {
    p_tax_code_id: taxCodeId,
    p_tax_rate_id: taxRateId || null,
    p_source_module: sourceModule,
    p_source_table: sourceTable,
    p_source_id: String(sourceId),
    p_taxable_amount: toAmount(taxableAmount),
    p_due_date: dueDate || null,
    p_currency: currency,
    p_payment_reference: paymentReference || null,
    p_notes: notes || null,
    p_metadata: metadata,
  });

  if (error) throw error;
  return data;
}

export async function createTaxDraftJournal(taxTransactionId) {
  const { data, error } = await supabase.rpc("finance_create_tax_draft_journal_secure", {
    p_tax_transaction_id: taxTransactionId,
  });

  if (error) throw error;
  return data;
}

export async function fetchVatReport() {
  const { data, error } = await supabase
    .from("finance_vat_report_view")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchWhtReport() {
  const { data, error } = await supabase
    .from("finance_wht_report_view")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchPayeReport() {
  const { data, error } = await supabase
    .from("finance_paye_report_view")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchTaxLiabilityReport() {
  const { data, error } = await supabase
    .from("finance_tax_liability_report_view")
    .select("*")
    .order("tax_code", { ascending: true });

  if (error) throw error;
  return data || [];
}
