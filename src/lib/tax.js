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
  taxRate,
  taxAuthority,
  dueDate,
  currency = "NGN",
  paymentReference,
  notes,
  metadata = {},
  createdBy,
  createdByName,
}) {
  const taxAmount = calculateTaxAmount(taxableAmount, taxRate);

  const { data: taxTransactionNo, error: noError } = await supabase.rpc(
    "finance_generate_tax_no",
    {
      p_prefix: "TAX",
      p_tax_date: dueDate || new Date().toISOString().slice(0, 10),
    }
  );

  if (noError) throw noError;

  const { data, error } = await supabase
    .from("finance_tax_transactions")
    .insert({
      tax_transaction_no: taxTransactionNo,
      tax_code_id: taxCodeId,
      tax_rate_id: taxRateId || null,
      source_module: sourceModule,
      source_table: sourceTable,
      source_id: String(sourceId),
      taxable_amount: toAmount(taxableAmount),
      tax_rate: toAmount(taxRate),
      tax_amount: taxAmount,
      currency,
      tax_authority: taxAuthority,
      due_date: dueDate || null,
      status: "draft",
      payment_reference: paymentReference || null,
      notes: notes || null,
      metadata,
      created_by: createdBy || null,
      created_by_name: createdByName || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function createTaxDraftJournal(taxTransactionId, user = {}) {
  const { data, error } = await supabase.rpc("finance_create_tax_draft_journal", {
    p_tax_transaction_id: taxTransactionId,
    p_created_by: user.id || null,
    p_created_by_name: user.full_name || user.name || user.email || null,
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
