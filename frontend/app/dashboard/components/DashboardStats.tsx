'use client';

import { Layout, Users, TrendingUp, CheckCircle, ClockCircle, Target } from '@mynaui/icons-react';

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  iconBgColor?: string;
  iconColor?: string;
}

function StatsCard({ icon, label, value, iconBgColor = 'bg-blue-50', iconColor = 'text-blue-600' }: StatsCardProps) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 flex items-center gap-3">
      <div className={`w-11 h-11 ${iconBgColor} rounded-lg flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

interface DashboardStatsProps {
  workspaceCount?: number;
}

export default function DashboardStats({ workspaceCount = 12 }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-8">
      {/* Workspaces Card */}
      <StatsCard
        icon={<Layout className="w-5 h-5 text-blue-600" />}
        label="Total Workspaces"
        value={workspaceCount}
        iconBgColor="bg-blue-50"
      />

      {/* Active Users Card */}
      {/* <StatsCard
        icon={<Users className="w-5 h-5 text-purple-600" />}
        label="Active Users"
        value="2,847"
        iconBgColor="bg-purple-50"
      /> */}

      {/* Success Rate Card */}
      {/* <StatsCard
        icon={<CheckCircle className="w-5 h-5 text-green-600" />}
        label="Success Rate"
        value="94.2%"
        iconBgColor="bg-green-50"
      /> */}

      {/* Performance Card */}
      {/* <StatsCard
        icon={<TrendingUp className="w-5 h-5 text-orange-600" />}
        label="Performance"
        value="+12.5%"
        iconBgColor="bg-orange-50"
      /> */}

      {/* Avg. Response Time Card */}
      <StatsCard
        icon={<ClockCircle className="w-5 h-5 text-indigo-600" />}
        label="Avg. Response"
        value="1.2s"
        iconBgColor="bg-indigo-50"
      />

      {/* Completion Rate Card */}
      <StatsCard
        icon={<Target className="w-5 h-5 text-pink-600" />}
        label="Completion"
        value="87.3%"
        iconBgColor="bg-pink-50"
      />
    </div>
  );
}
