import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, icon: Icon, trend, trendLabel, className }) {
  return (
    <Card className={cn("p-5 relative overflow-hidden group hover:shadow-lg transition-shadow", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {trend !== undefined && (
            <p className={cn(
              "text-xs font-medium",
              trend >= 0 ? "text-green-600" : "text-red-500"
            )}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% {trendLabel || 'from last month'}
            </p>
          )}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        )}
      </div>
    </Card>
  );
}