import { CheckCircle2, Clock, FileText, PackageCheck, ShoppingCart, Wallet, XCircle } from 'lucide-react';
import OperationalFundCard from '@/components/finance/OperationalFundCard';

export default function FinanceOperationalSummary({
  dispatchFundStats, purchaseOrderStats, generalRequestStats, expenseRequestStats, expenseRequests,
  loadingDispatchFunds, loadingPurchaseOrders, loadingGeneralRequests, loadingExpenseRequests,
  dispatchFundsLoadFailed, purchaseOrdersLoadFailed, generalRequestsLoadFailed, expenseRequestsError,
  getExpenseRequestApprovedAmount, getExpenseRequestPaidTotal, setActiveFinanceTab, setFundFilter,
  setPoFilter, setGeneralRequestFilter, setExpenseRequestFilter,
}) {
  return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <OperationalFundCard
          icon={Wallet}
          iconClassName="text-amber-500"
          valueClassName="text-amber-500"
          label="Pending Dispatch Funds"
          count={dispatchFundStats.pendingCount}
          amount={dispatchFundStats.pendingAmount}
          loading={loadingDispatchFunds}
          error={dispatchFundsLoadFailed}
          onClick={() => {
            setActiveFinanceTab('dispatch-funds');
            setFundFilter('pending_review');
          }}
        />

        <OperationalFundCard
          icon={CheckCircle2}
          iconClassName="text-blue-500"
          valueClassName="text-blue-500"
          label="Approved Awaiting Disbursement"
          count={dispatchFundStats.approvedCount}
          amount={dispatchFundStats.approvedAmount}
          loading={loadingDispatchFunds}
          error={dispatchFundsLoadFailed}
          onClick={() => {
            setActiveFinanceTab('dispatch-funds');
            setFundFilter('approved');
          }}
        />

        <OperationalFundCard
          icon={PackageCheck}
          iconClassName="text-green-500"
          valueClassName="text-green-600"
          label="Disbursed"
          count={dispatchFundStats.disbursedCount}
          amount={dispatchFundStats.disbursedAmount}
          loading={loadingDispatchFunds}
          error={dispatchFundsLoadFailed}
          onClick={() => {
            setActiveFinanceTab('dispatch-funds');
            setFundFilter('disbursed');
          }}
        />

        <OperationalFundCard
          icon={XCircle}
          iconClassName="text-red-500"
          valueClassName="text-red-600"
          label="Rejected Dispatch Funds"
          count={dispatchFundStats.rejectedCount}
          amount={dispatchFundStats.rejectedAmount}
          loading={loadingDispatchFunds}
          error={dispatchFundsLoadFailed}
          onClick={() => {
            setActiveFinanceTab('dispatch-funds');
            setFundFilter('rejected');
          }}
        />

        <OperationalFundCard
          icon={ShoppingCart}
          iconClassName="text-cyan-500"
          valueClassName="text-cyan-500"
          label="PO Funds To Release"
          count={purchaseOrderStats.pendingReleaseCount}
          amount={purchaseOrderStats.pendingReleaseAmount}
          loading={loadingPurchaseOrders}
          error={purchaseOrdersLoadFailed}
          onClick={() => {
            setActiveFinanceTab('purchase-orders');
            setPoFilter('Pending Account Release');
          }}
        />

        <OperationalFundCard
          icon={FileText}
          iconClassName="text-purple-400"
          valueClassName="text-purple-300"
          label="General Requests Awaiting Finance"
          count={generalRequestStats.awaitingFinanceCount}
          amount={generalRequestStats.awaitingFinanceAmount}
          loading={loadingGeneralRequests}
          error={generalRequestsLoadFailed}
          onClick={() => {
            setActiveFinanceTab('general-requests');
            setGeneralRequestFilter('ready_for_disbursement');
          }}
        />

        <OperationalFundCard
          icon={PackageCheck}
          iconClassName="text-emerald-400"
          valueClassName="text-emerald-300"
          label="Historical Disbursed General Requests"
          count={generalRequestStats.disbursedCount}
          amount={generalRequestStats.disbursedAmount}
          loading={loadingGeneralRequests}
          error={generalRequestsLoadFailed}
          onClick={() => {
            setActiveFinanceTab('general-requests');
            setGeneralRequestFilter('disbursed');
          }}
        />

        <OperationalFundCard
          icon={Clock}
          iconClassName="text-amber-400"
          valueClassName="text-amber-300"
          label="Expense Requests Pending Approval"
          count={expenseRequestStats.pendingApproval + expenseRequestStats.pendingFinance}
          amount={expenseRequests
            .filter((request) =>
              ['submitted', 'pending_approval', 'pending_finance_review'].includes(request.status)
            )
            .reduce((sum, request) => sum + Number(request.amount_requested || 0), 0)}
          loading={loadingExpenseRequests}
          error={Boolean(expenseRequestsError)}
          onClick={() => {
            setActiveFinanceTab('expense-requests');
            setExpenseRequestFilter('pending');
          }}
        />

        <OperationalFundCard
          icon={CheckCircle2}
          iconClassName="text-indigo-400"
          valueClassName="text-indigo-300"
          label="Approved for Payment"
          count={expenseRequestStats.approvedForPayment}
          amount={expenseRequests
            .filter((request) => request.status === 'approved_for_payment')
            .reduce((sum, request) => sum + getExpenseRequestApprovedAmount(request), 0)}
          loading={loadingExpenseRequests}
          error={Boolean(expenseRequestsError)}
          onClick={() => {
            setActiveFinanceTab('expense-requests');
            setExpenseRequestFilter('approved_for_payment');
          }}
        />

        <OperationalFundCard
          icon={Wallet}
          iconClassName="text-blue-400"
          valueClassName="text-blue-300"
          label="Partially Paid"
          count={expenseRequestStats.partiallyPaid}
          amount={expenseRequests
            .filter((request) => request.status === 'partially_paid')
            .reduce((sum, request) => sum + getExpenseRequestPaidTotal(request), 0)}
          loading={loadingExpenseRequests}
          error={Boolean(expenseRequestsError)}
          onClick={() => {
            setActiveFinanceTab('expense-requests');
            setExpenseRequestFilter('partially_paid');
          }}
        />

        <OperationalFundCard
          icon={PackageCheck}
          iconClassName="text-green-400"
          valueClassName="text-green-300"
          label="Paid Expense Requests"
          count={expenseRequestStats.paid}
          amount={expenseRequests
            .filter((request) => request.status === 'paid')
            .reduce((sum, request) => sum + getExpenseRequestPaidTotal(request), 0)}
          loading={loadingExpenseRequests}
          error={Boolean(expenseRequestsError)}
          onClick={() => {
            setActiveFinanceTab('expense-requests');
            setExpenseRequestFilter('paid');
          }}
        />
      </div>
  );
}
