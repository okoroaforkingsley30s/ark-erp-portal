import { fmt } from '@/lib/financePortalModel';

export default function OperationalFundCard({
  icon: Icon,
  iconClassName,
  valueClassName,
  label,
  count,
  amount,
  loading,
  error,
  showAmount = true,
  onClick,
}) {
  const value = loading ? '...' : error ? '!' : count;
  const detail = loading
    ? 'Loading live values...'
    : error
      ? 'Unable to load live values'
      : showAmount
        ? `${label} · ${fmt(amount)}`
        : label;
  const CardElement = onClick ? 'button' : 'div';

  return (
    <CardElement
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={
        'w-full rounded-xl border bg-slate-900/50 p-4 text-left ' +
        (onClick ? 'transition hover:border-primary/60 hover:bg-slate-900' : '')
      }
    >
      <Icon className={`w-5 h-5 mb-2 ${iconClassName}`} />
      <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </CardElement>
  );
}
