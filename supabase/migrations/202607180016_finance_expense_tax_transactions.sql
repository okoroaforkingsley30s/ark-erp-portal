-- Section 3: transactional expense requests, payments, and tax drafts.
-- Run after 202607180015_database_exposure_lockdown.sql.

create or replace function public.finance_actor_identity()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', auth.uid(),
    'email', lower(coalesce(auth.jwt() ->> 'email', '')),
    'name', coalesce(
      nullif(trim(u.full_name), ''),
      nullif(auth.jwt() ->> 'email', ''),
      'Authenticated user'
    ),
    'department', nullif(trim(coalesce(u.department, up.department)), '')
  )
  from (select 1) seed
  left join lateral (
    select p.* from public.user_profiles p
    where lower(p.user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    limit 1
  ) up on true
  left join lateral (
    select x.* from public.users x
    where x.id = auth.uid() or lower(x.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    order by (x.id = auth.uid()) desc
    limit 1
  ) u on true;
$$;

create or replace function public.finance_save_expense_request_transaction(
  p_request_id uuid,
  p_submit boolean,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor jsonb;
  current_row public.finance_expense_requests%rowtype;
  saved public.finance_expense_requests%rowtype;
  old_status text;
  v_amount_requested numeric(18,2);
  request_no text;
  action_name text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' then raise exception 'Invalid request payload'; end if;
  actor := public.finance_actor_identity();
  v_amount_requested := round(coalesce(nullif(trim(p_payload ->> 'amount_requested'), '')::numeric, 0), 2);
  if length(trim(coalesce(p_payload ->> 'expense_category', ''))) < 2 then raise exception 'Expense category is required'; end if;
  if length(trim(coalesce(p_payload ->> 'purpose', ''))) < 3 then raise exception 'Purpose is required'; end if;
  if v_amount_requested <= 0 then raise exception 'Amount requested must be greater than zero'; end if;

  if p_request_id is not null then
    select * into current_row from public.finance_expense_requests where id = p_request_id for update;
    if not found then raise exception 'Expense request not found'; end if;
    if current_row.requester_user_id is distinct from auth.uid() and not public.finance_is_privileged_expense_role() then
      raise exception 'You may only edit your own expense request';
    end if;
    if current_row.status not in ('draft', 'returned_for_correction') then raise exception 'Only draft or returned requests can be edited'; end if;
    old_status := current_row.status;
    update public.finance_expense_requests set
      expense_category = left(trim(p_payload ->> 'expense_category'), 120),
      purpose = left(trim(p_payload ->> 'purpose'), 500),
      description = nullif(left(trim(p_payload ->> 'description'), 2000), ''),
      supplier_name = nullif(left(trim(p_payload ->> 'supplier_name'), 200), ''),
      supplier_email = nullif(lower(left(trim(p_payload ->> 'supplier_email'), 320)), ''),
      beneficiary_name = nullif(left(trim(p_payload ->> 'beneficiary_name'), 200), ''),
      amount_requested = v_amount_requested,
      currency = upper(left(coalesce(nullif(trim(p_payload ->> 'currency'), ''), 'NGN'), 3)),
      required_date = nullif(trim(p_payload ->> 'required_date'), '')::date,
      status = case when p_submit then 'submitted' else 'draft' end,
      current_approval_stage = case when p_submit then 'management_review' else 'requester' end,
      next_approver_role = case when p_submit then 'manager' else null end,
      submitted_at = case when p_submit then coalesce(current_row.submitted_at, now()) else current_row.submitted_at end,
      updated_by = auth.uid()
    where id = p_request_id returning * into saved;
    action_name := case when p_submit then 'submitted' else 'updated' end;
  else
    request_no := public.finance_generate_expense_request_no(current_date);
    old_status := null;
    insert into public.finance_expense_requests (
      request_number, requester_user_id, requester_email, requester_name, department,
      expense_category, purpose, description, supplier_name, supplier_email,
      beneficiary_name, amount_requested, currency, required_date, status,
      current_approval_stage, next_approver_role, submitted_at, created_by, updated_by
    ) values (
      request_no, auth.uid(), actor ->> 'email', actor ->> 'name', actor ->> 'department',
      left(trim(p_payload ->> 'expense_category'), 120), left(trim(p_payload ->> 'purpose'), 500),
      nullif(left(trim(p_payload ->> 'description'), 2000), ''), nullif(left(trim(p_payload ->> 'supplier_name'), 200), ''),
      nullif(lower(left(trim(p_payload ->> 'supplier_email'), 320)), ''), nullif(left(trim(p_payload ->> 'beneficiary_name'), 200), ''),
      v_amount_requested, upper(left(coalesce(nullif(trim(p_payload ->> 'currency'), ''), 'NGN'), 3)),
      nullif(trim(p_payload ->> 'required_date'), '')::date, case when p_submit then 'submitted' else 'draft' end,
      case when p_submit then 'management_review' else 'requester' end, case when p_submit then 'manager' else null end,
      case when p_submit then now() else null end, auth.uid(), auth.uid()
    ) returning * into saved;
    action_name := case when p_submit then 'submitted' else 'created' end;
  end if;

  insert into public.finance_expense_request_history
    (expense_request_id, actor_user_id, actor_email, actor_name, action, previous_status, new_status, comments)
  values (saved.id, auth.uid(), actor ->> 'email', actor ->> 'name', action_name, old_status, saved.status,
    case when p_submit then 'Submitted for review' else 'Saved by requester' end);
  if p_submit then
    insert into public.finance_expense_request_approvals
      (expense_request_id, approval_stage, approver_user_id, approver_email, approver_name, decision, previous_status, new_status, comments)
    values (saved.id, 'requester_submission', auth.uid(), actor ->> 'email', actor ->> 'name', 'submitted', coalesce(old_status, 'draft'), 'submitted', 'Submitted for review');
  end if;
  return to_jsonb(saved);
end;
$$;

create or replace function public.finance_submit_expense_request_transaction(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.finance_expense_requests%rowtype; actor jsonb; old_status text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  actor := public.finance_actor_identity();
  select * into r from public.finance_expense_requests where id = p_request_id for update;
  if not found then raise exception 'Expense request not found'; end if;
  if r.requester_user_id is distinct from auth.uid() then raise exception 'You may only submit your own expense request'; end if;
  if r.status not in ('draft','returned_for_correction') then raise exception 'Only draft or returned requests can be submitted'; end if;
  if r.amount_requested <= 0 then raise exception 'Amount requested must be greater than zero'; end if;
  old_status := r.status;
  update public.finance_expense_requests set status='submitted', current_approval_stage='management_review',
    next_approver_role='manager', submitted_at=coalesce(submitted_at,now()), updated_by=auth.uid()
  where id=p_request_id returning * into r;
  insert into public.finance_expense_request_approvals
    (expense_request_id,approval_stage,approver_user_id,approver_email,approver_name,decision,previous_status,new_status,comments)
  values (r.id,'requester_submission',auth.uid(),actor->>'email',actor->>'name','submitted',old_status,'submitted','Submitted for review');
  insert into public.finance_expense_request_history
    (expense_request_id,actor_user_id,actor_email,actor_name,action,previous_status,new_status,comments)
  values (r.id,auth.uid(),actor->>'email',actor->>'name','submitted',old_status,'submitted','Submitted for review');
  return to_jsonb(r);
end; $$;

create or replace function public.finance_decide_expense_request_transaction(
  p_request_id uuid, p_decision text, p_comments text default null
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.finance_expense_requests%rowtype; actor jsonb; role_name text; old_status text; next_status text; next_stage text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if p_decision not in ('approved','rejected','returned_for_correction','approved_for_payment') then raise exception 'Unsupported decision'; end if;
  if p_decision in ('rejected','returned_for_correction') and length(trim(coalesce(p_comments,''))) < 2 then raise exception 'A reason is required'; end if;
  actor := public.finance_actor_identity(); role_name := public.finance_current_user_role();
  select * into r from public.finance_expense_requests where id=p_request_id for update;
  if not found then raise exception 'Expense request not found'; end if;
  if r.requester_user_id = auth.uid() then raise exception 'Creators cannot approve their own expense requests'; end if;
  old_status := r.status;
  if p_decision = 'approved_for_payment' then
    if not public.finance_is_privileged_expense_role() then raise exception 'Finance permission is required'; end if;
    if r.status <> 'pending_finance_review' then raise exception 'Request is not awaiting Finance review'; end if;
    next_status := 'approved_for_payment'; next_stage := 'payment';
  else
    if not public.finance_is_expense_approver_role() then raise exception 'Approval permission is required'; end if;
    if r.status not in ('submitted','pending_approval') then raise exception 'Request is not awaiting management approval'; end if;
    next_status := case p_decision when 'approved' then 'pending_finance_review' else p_decision end;
    next_stage := case p_decision when 'approved' then 'finance_review' when 'returned_for_correction' then 'requester' else 'closed' end;
  end if;
  update public.finance_expense_requests set status=next_status,current_approval_stage=next_stage,
    next_approver_role=case when next_status='pending_finance_review' then 'finance' else null end,
    amount_approved=case when p_decision='approved' then amount_requested else amount_approved end,
    approved_at=case when p_decision='approved' then now() else approved_at end,
    rejected_at=case when p_decision='rejected' then now() else rejected_at end,
    returned_at=case when p_decision='returned_for_correction' then now() else returned_at end,
    finance_reviewed_at=case when p_decision='approved_for_payment' then now() else finance_reviewed_at end,
    updated_by=auth.uid() where id=p_request_id returning * into r;
  insert into public.finance_expense_request_approvals
    (expense_request_id,approval_stage,approver_role,approver_user_id,approver_email,approver_name,decision,comments,previous_status,new_status)
  values(r.id,coalesce(r.current_approval_stage,'management_review'),role_name,auth.uid(),actor->>'email',actor->>'name',p_decision,nullif(trim(p_comments),''),old_status,next_status);
  insert into public.finance_expense_request_history
    (expense_request_id,actor_user_id,actor_email,actor_name,action,previous_status,new_status,comments)
  values(r.id,auth.uid(),actor->>'email',actor->>'name',p_decision,old_status,next_status,nullif(trim(p_comments),''));
  return to_jsonb(r);
end; $$;

create or replace function public.finance_record_expense_payment_transaction(
  p_request_id uuid, p_amount numeric, p_payment_method text, p_payment_reference text,
  p_bank_account_id uuid, p_payment_date date, p_notes text,
  p_expense_account_id uuid, p_credit_account_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.finance_expense_requests%rowtype; actor jsonb; payment public.finance_expense_payments%rowtype;
  paid_total numeric(18,2); approved_total numeric(18,2); journal jsonb; v_journal_id uuid; legacy_id text;
  next_status text; expense_no text;
begin
  if auth.uid() is null or not public.finance_is_privileged_expense_role() then raise exception 'Finance permission is required'; end if;
  actor := public.finance_actor_identity();
  select * into r from public.finance_expense_requests where id=p_request_id for update;
  if not found then raise exception 'Expense request not found'; end if;
  if r.requester_user_id = auth.uid() then raise exception 'Creators cannot pay their own expense requests'; end if;
  if r.status not in ('approved_for_payment','partially_paid') then raise exception 'Request is not approved for payment'; end if;
  approved_total := round(r.amount_approved,2);
  if p_amount is null or round(p_amount,2) <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if length(trim(coalesce(p_payment_method,''))) < 2 then raise exception 'Payment method is required'; end if;
  if p_payment_date is null or p_payment_date > current_date + 1 then raise exception 'Invalid payment date'; end if;
  if not exists(select 1 from public.finance_accounts where id=p_expense_account_id and is_active) or
     not exists(select 1 from public.finance_accounts where id=p_credit_account_id and is_active) then raise exception 'Invalid or inactive journal account'; end if;
  select coalesce(sum(amount_paid),0) into paid_total from public.finance_expense_payments
    where expense_request_id=r.id and payment_status='paid';
  paid_total := round(paid_total + p_amount,2);
  if paid_total > approved_total then raise exception 'Payment exceeds the approved remaining amount'; end if;
  insert into public.finance_expense_payments(expense_request_id,payment_number,amount_paid,payment_method,payment_reference,
    bank_account_id,payment_date,payment_status,paid_by,paid_by_email,paid_by_name,notes)
  values(r.id,public.finance_generate_expense_payment_no(p_payment_date),round(p_amount,2),left(trim(p_payment_method),100),
    nullif(left(trim(p_payment_reference),200),''),p_bank_account_id,p_payment_date,'paid',auth.uid(),actor->>'email',actor->>'name',nullif(left(trim(p_notes),2000),''))
  returning * into payment;
  journal := public.finance_create_source_journal_transaction('finance_expense_payments',payment.id::text,p_payment_date,
    'Expense request payment '||r.request_number||' - '||r.purpose,
    jsonb_build_array(
      jsonb_build_object('account_id',p_expense_account_id,'debit',round(p_amount,2),'credit',0,'description',r.purpose,'department',r.department),
      jsonb_build_object('account_id',p_credit_account_id,'debit',0,'credit',round(p_amount,2),'description',coalesce(nullif(trim(p_payment_reference),''),payment.payment_number),'department',r.department)
    ));
  v_journal_id := (journal->>'id')::uuid;
  update public.finance_expense_payments set journal_id=v_journal_id where id=payment.id;
  legacy_id := r.resulting_expense_id;
  if legacy_id is null then
    expense_no := 'EXP-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS');
    insert into public.expenses(category,amount,currency,payment_method,description,staff_responsible,staff_email,
      approval_status,approved_by,approved_date,expense_date,notes,expense_number,expense_request_id,expense_source_type,updated_at,created_at)
    values(r.expense_category,paid_total,r.currency,p_payment_method,r.purpose,coalesce(r.beneficiary_name,r.requester_name),r.requester_email,
      'approved',actor->>'email',now(),p_payment_date,r.description,expense_no,r.id,'request_generated',now(),now()) returning id::text into legacy_id;
  else
    update public.expenses set amount=paid_total,payment_method=p_payment_method,expense_date=p_payment_date,updated_at=now()
    where id::text=legacy_id;
  end if;
  next_status := case when paid_total >= approved_total then 'paid' else 'partially_paid' end;
  update public.finance_expense_requests set amount_paid=paid_total,payment_status=next_status,status=next_status,
    paid_at=case when next_status='paid' then now() else paid_at end,resulting_expense_id=legacy_id,
    resulting_journal_id=coalesce(resulting_journal_id,v_journal_id),updated_by=auth.uid() where id=r.id returning * into r;
  insert into public.finance_expense_request_history(expense_request_id,actor_user_id,actor_email,actor_name,action,
    previous_status,new_status,comments,metadata)
  values(r.id,auth.uid(),actor->>'email',actor->>'name',case when next_status='paid' then 'final_payment_recorded' else 'partial_payment_recorded' end,
    case when next_status='paid' and paid_total=p_amount then 'approved_for_payment' else 'partially_paid' end,next_status,nullif(trim(p_notes),''),
    jsonb_build_object('payment_number',payment.payment_number,'amount_paid',round(p_amount,2),'journal_id',v_journal_id));
  return jsonb_build_object('request',to_jsonb(r),'payment',to_jsonb(payment)||jsonb_build_object('journal_id',v_journal_id),'journal_id',v_journal_id,'expense_id',legacy_id);
end; $$;

create or replace function public.finance_create_tax_transaction_draft(
  p_tax_code_id uuid, p_tax_rate_id uuid, p_source_module text, p_source_table text, p_source_id text,
  p_taxable_amount numeric, p_due_date date, p_currency text, p_payment_reference text, p_notes text, p_metadata jsonb
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare code public.finance_tax_codes%rowtype; rate_value numeric(9,4); actor jsonb; saved public.finance_tax_transactions%rowtype;
begin
  if auth.uid() is null or not public.finance_is_write_role() then raise exception 'Finance write permission is required'; end if;
  if p_source_table not in ('invoices','expenses','payments','payroll','vendor_bills','purchases','lpos','other') then raise exception 'Unsupported tax source'; end if;
  if length(trim(coalesce(p_source_id,'')))=0 or length(p_source_id)>200 then raise exception 'A valid source id is required'; end if;
  if p_taxable_amount is null or p_taxable_amount < 0 then raise exception 'Taxable amount cannot be negative'; end if;
  select * into code from public.finance_tax_codes where id=p_tax_code_id and is_active;
  if not found then raise exception 'Tax code is invalid or inactive'; end if;
  if p_tax_rate_id is not null then
    select rate_percent into rate_value from public.finance_tax_rates
      where id=p_tax_rate_id and tax_code_id=p_tax_code_id and is_active
        and effective_from<=coalesce(p_due_date,current_date) and (effective_to is null or effective_to>=coalesce(p_due_date,current_date));
    if not found then raise exception 'Tax rate is invalid, inactive, or outside its effective period'; end if;
  else
    select rate_percent into rate_value from public.finance_tax_rates where tax_code_id=p_tax_code_id and is_active
      and effective_from<=coalesce(p_due_date,current_date) and (effective_to is null or effective_to>=coalesce(p_due_date,current_date))
      order by is_default desc,effective_from desc limit 1;
    if rate_value is null then raise exception 'No effective tax rate exists for this tax code'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tax_code_id::text||':'||p_source_table||':'||p_source_id,0));
  select * into saved from public.finance_tax_transactions where tax_code_id=p_tax_code_id and source_table=p_source_table and source_id=p_source_id;
  if found then return to_jsonb(saved)||jsonb_build_object('created',false); end if;
  actor:=public.finance_actor_identity();
  insert into public.finance_tax_transactions(tax_transaction_no,tax_code_id,tax_rate_id,source_module,source_table,source_id,
    taxable_amount,tax_rate,tax_amount,currency,tax_authority,due_date,status,payment_reference,notes,metadata,created_by,created_by_name)
  values(public.finance_generate_tax_no('TAX',coalesce(p_due_date,current_date)),p_tax_code_id,p_tax_rate_id,
    left(coalesce(nullif(trim(p_source_module),''),'finance'),100),p_source_table,trim(p_source_id),round(p_taxable_amount,2),rate_value,
    round(p_taxable_amount*rate_value/100,2),upper(left(coalesce(nullif(trim(p_currency),''),'NGN'),3)),code.tax_authority,p_due_date,'draft',
    nullif(left(trim(p_payment_reference),200),''),nullif(left(trim(p_notes),2000),''),coalesce(p_metadata,'{}'::jsonb),auth.uid(),actor->>'name')
  returning * into saved;
  insert into public.finance_audit_logs(entity_table,entity_id,action,new_value,changed_by,changed_by_name)
  values('finance_tax_transactions',saved.id::text,'tax_draft_created',to_jsonb(saved),auth.uid(),actor->>'name');
  return to_jsonb(saved)||jsonb_build_object('created',true);
end; $$;

revoke all on function public.finance_actor_identity() from public, anon;
revoke all on function public.finance_save_expense_request_transaction(uuid,boolean,jsonb) from public, anon;
revoke all on function public.finance_submit_expense_request_transaction(uuid) from public, anon;
revoke all on function public.finance_decide_expense_request_transaction(uuid,text,text) from public, anon;
revoke all on function public.finance_record_expense_payment_transaction(uuid,numeric,text,text,uuid,date,text,uuid,uuid) from public, anon;
revoke all on function public.finance_create_tax_transaction_draft(uuid,uuid,text,text,text,numeric,date,text,text,text,jsonb) from public, anon;
grant execute on function public.finance_save_expense_request_transaction(uuid,boolean,jsonb) to authenticated;
grant execute on function public.finance_submit_expense_request_transaction(uuid) to authenticated;
grant execute on function public.finance_decide_expense_request_transaction(uuid,text,text) to authenticated;
grant execute on function public.finance_record_expense_payment_transaction(uuid,numeric,text,text,uuid,date,text,uuid,uuid) to authenticated;
grant execute on function public.finance_create_tax_transaction_draft(uuid,uuid,text,text,text,numeric,date,text,text,text,jsonb) to authenticated;
