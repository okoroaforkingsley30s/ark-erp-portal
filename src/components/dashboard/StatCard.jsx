import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  className
}) {
  return (
    <Card
      className={cn(
        `
        p-5
        relative
        overflow-hidden
        border
        border-white/10
        bg-[#102969]/90
        backdrop-blur-xl
        shadow-[0_0_30px_rgba(0,0,0,0.25)]
        hover:border-[#ff5a00]/30
        hover:shadow-[0_0_40px_rgba(255,90,0,0.12)]
        transition-all
        duration-300
        rounded-3xl
        group
        `,
        className
      )}
    >
      <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-[#ff5a00]/10 via-transparent to-transparent pointer-events-none" />

      <div className="relative flex items-start justify-between">

        <div className="space-y-2">

          <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-[0.25em]">
            {title}
          </p>

          <p className="text-3xl font-black tracking-tight text-white">
            {value}
          </p>

          {trend !== undefined && (
            <div
              className={cn(
                `
                inline-flex
                items-center
                gap-1
                px-2.5
                py-1
                rounded-full
                text-[11px]
                font-semibold
                border
                `,
                trend >= 0
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20'
                  : 'bg-red-500/10 text-red-300 border-red-400/20'
              )}
            >
              <span>
                {trend >= 0 ? '↑' : '↓'}
              </span>

              <span>
                {Math.abs(trend)}%
              </span>

              <span className="opacity-80">
                {trendLabel || 'from last month'}
              </span>
            </div>
          )}

        </div>

        {Icon && (
          <div
            className="
              w-12
              h-12
              rounded-2xl
              bg-[#ff5a00]/15
              border
              border-[#ff5a00]/20
              flex
              items-center
              justify-center
              group-hover:scale-110
              group-hover:bg-[#ff5a00]/20
              transition-all
              duration-300
              shadow-[0_0_20px_rgba(255,90,0,0.12)]
            "
          >
            <Icon className="w-6 h-6 text-[#ff5a00]" />
          </div>
        )}

      </div>
    </Card>
  );
}