'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import type { DailyPoint } from '@/lib/mockData';
import { formatUsdcDollar } from '@/lib/formatters';

interface RevenueChartProps { data: DailyPoint[] }

function tickFormatter(value: number) {
  return formatUsdcDollar(value);
}

export default function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#028090" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#028090" stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={tickFormatter} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v: number) => [formatUsdcDollar(v), 'Revenue']}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#028090"
            strokeWidth={2}
            fill="url(#revenueGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
