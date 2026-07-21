import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Package } from 'lucide-react';
import { usePrivateStorageUrl } from '@/hooks/usePrivateStorageUrl';

function PrivatePartPhoto({ value }) {
  const url = usePrivateStorageUrl(value, 'inventory');
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img src={url} alt="Faulty part" className="w-14 h-14 object-cover rounded-lg border" />
    </a>
  );
}

const REQ_STATUS = {
  pending: {
    label: 'Pending',
    color: 'bg-amber-500/15 text-amber-300 border-amber-200',
  },
  approved: {
    label: 'Approved',
    color: 'bg-green-500/15 text-green-300 border-green-200',
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-500/15 text-red-300 border-red-200',
  },
  dispatched: {
    label: 'Dispatched',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  received: {
    label: 'Received',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
  },
};

const URGENCY = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-50 text-blue-700',
  high: 'bg-amber-500/15 text-amber-300',
  critical: 'bg-red-500/15 text-red-300',
};

export default function RequestsPanel({
  requests = [],
  canManage,
  isEngineer,
  onAction,
}) {
  if (!requests.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>No spare part requests yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => {
        const status = req.status || req.request_status || 'pending';
        const sc = REQ_STATUS[status] || REQ_STATUS.pending;

        return (
          <Card key={req.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs text-muted-foreground">
                    {req.request_number || req.id}
                  </span>

                  <Badge
                    variant="outline"
                    className={`${sc.color} text-[10px]`}
                  >
                    {sc.label}
                  </Badge>

                  <Badge
                    variant="outline"
                    className={`${
                      URGENCY[req.urgency] || URGENCY.medium
                    } text-[10px] border-0 capitalize`}
                  >
                    {req.urgency || 'medium'}
                  </Badge>

                  {req.category_filter && (
                    <Badge variant="outline" className="text-[10px]">
                      {req.category_filter}
                    </Badge>
                  )}
                </div>

                <p className="font-semibold text-sm">
                  {req.part_name || req.item_description || 'Unknown Part'}{' '}
                  <span className="font-normal text-muted-foreground">
                    × {req.quantity_requested || 1}
                  </span>
                </p>

                {req.part_number && (
                  <p className="font-mono text-xs text-muted-foreground">
                    {req.part_number}
                  </p>
                )}

                <p className="text-xs text-muted-foreground mt-0.5">
                  By:{' '}
                  <span className="font-medium">
                    {req.engineer_name || req.engineer_email || 'Unknown'}
                  </span>
                  {req.site_name ? ` · ${req.site_name}` : ''}
                </p>

                {req.reason && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Reason: {req.reason}
                  </p>
                )}
              </div>

              {req.faulty_part_photo && (
                <PrivatePartPhoto value={req.faulty_part_photo} />
              )}
            </div>

            {canManage && status === 'pending' && (
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => onAction(req, 'approved')}
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Approve
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-destructive"
                  onClick={() => onAction(req, 'rejected')}
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  Reject
                </Button>
              </div>
            )}

            {canManage && status === 'approved' && (
              <Button
                size="sm"
                className="w-full mt-3"
                variant="outline"
                onClick={() => onAction(req, 'dispatched')}
              >
                <Package className="w-3 h-3 mr-1" />
                Mark Dispatched & Deduct Stock
              </Button>
            )}

            {isEngineer && status === 'dispatched' && (
              <Button
                size="sm"
                className="w-full mt-3"
                onClick={() => onAction(req, 'received')}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Confirm Received
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
