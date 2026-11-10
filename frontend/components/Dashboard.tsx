// 'use client';

// import { useState, useEffect } from 'react';
// import { useRouter } from 'next/navigation';
// import { Users, Shield, Key, Activity, FileText, Palette, TrendingUp, AlertCircle, ArrowRight } from 'lucide-react';
// import { apiClient } from '@/lib/api';
// import { API_ENDPOINTS } from '@/constants/routes';
// import { usePermissions } from '@/hooks/usePermissions';

// interface DashboardStats {
//   users: number;
//   roles: number;
//   apiKeys: number;
//   webhooks: number;
//   auditLogs: number;
//   themes: number;
// }

// export default function Dashboard() {
//   const router = useRouter();
//   const { hasPermission, loading: permissionsLoading } = usePermissions();
//   const [stats, setStats] = useState<DashboardStats>({
//     users: 0,
//     roles: 0,
//     apiKeys: 0,
//     webhooks: 0,
//     auditLogs: 0,
//     themes: 0,
//   });
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     // Wait for permissions to load before fetching dashboard data
//     if (!permissionsLoading) {
//       loadDashboardData();
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [permissionsLoading]);

//   const loadDashboardData = async () => {
//     try {
//       setLoading(true);

//       // Load stats based on permissions
//       const promises: Promise<any>[] = [];

//       if (hasPermission('user', 'read')) {
//         promises.push(
//           apiClient.get<any[]>(API_ENDPOINTS.USERS.BASE).then((users) => ({
//             key: 'users',
//             count: Array.isArray(users) ? users.length : 0,
//           })).catch(() => ({ key: 'users', count: 0 }))
//         );
//       }

//       if (hasPermission('role', 'read')) {
//         promises.push(
//           apiClient.get<any[]>(API_ENDPOINTS.ROLES.BASE).then((roles) => ({
//             key: 'roles',
//             count: Array.isArray(roles) ? roles.length : 0,
//           })).catch(() => ({ key: 'roles', count: 0 }))
//         );
//       }

//       if (hasPermission('api_key', 'read')) {
//         promises.push(
//           apiClient.get<any[]>(API_ENDPOINTS.API_KEYS.BASE).then((keys) => ({
//             key: 'apiKeys',
//             count: Array.isArray(keys) ? keys.length : 0,
//           })).catch(() => ({ key: 'apiKeys', count: 0 }))
//         );
//       }

//       if (hasPermission('webhook', 'read')) {
//         promises.push(
//           apiClient.get<any[]>(API_ENDPOINTS.WEBHOOKS.BASE).then((webhooks) => ({
//             key: 'webhooks',
//             count: Array.isArray(webhooks) ? webhooks.length : 0,
//           })).catch(() => ({ key: 'webhooks', count: 0 }))
//         );
//       }

//       if (hasPermission('audit_log', 'read')) {
//         promises.push(
//           apiClient.get(`${API_ENDPOINTS.AUDIT_LOGS.BASE}?limit=1`).then((response: any) => ({
//             key: 'auditLogs',
//             count: response.total || 0,
//           })).catch(() => ({ key: 'auditLogs', count: 0 }))
//         );
//       }

//       if (hasPermission('theme', 'read')) {
//         promises.push(
//           apiClient.get(API_ENDPOINTS.THEME.BASE).then(() => ({
//             key: 'themes',
//             count: 1, // Theme is a single resource
//           })).catch(() => ({ key: 'themes', count: 0 }))
//         );
//       }

//       const results = await Promise.all(promises);

//       const newStats: DashboardStats = {
//         users: 0,
//         roles: 0,
//         apiKeys: 0,
//         webhooks: 0,
//         auditLogs: 0,
//         themes: 0,
//       };

//       results.forEach((result) => {
//         if (result.key in newStats) {
//           (newStats as any)[result.key] = result.count;
//         }
//       });

//       setStats(newStats);
//     } catch (error) {
//       console.error('Failed to load dashboard data:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const statCards = [
//     {
//       label: 'Users',
//       value: stats.users,
//       icon: Users,
//       color: 'bg-blue-500',
//       permission: hasPermission('user', 'read'),
//       onClick: () => router.push('/users'),
//     },
//     {
//       label: 'Roles',
//       value: stats.roles,
//       icon: Shield,
//       color: 'bg-purple-500',
//       permission: hasPermission('role', 'read'),
//       onClick: () => router.push('/roles'),
//     },
//     {
//       label: 'API Keys',
//       value: stats.apiKeys,
//       icon: Key,
//       color: 'bg-green-500',
//       permission: hasPermission('api_key', 'read'),
//       onClick: () => router.push('/api-keys'),
//     },
//     {
//       label: 'Webhooks',
//       value: stats.webhooks,
//       icon: Activity,
//       color: 'bg-orange-500',
//       permission: hasPermission('webhook', 'read'),
//       onClick: () => router.push('/webhooks'),
//     },
//     {
//       label: 'Audit Logs',
//       value: stats.auditLogs,
//       icon: FileText,
//       color: 'bg-indigo-500',
//       permission: hasPermission('audit_log', 'read'),
//       onClick: () => router.push('/audit'),
//     },
//     {
//       label: 'Themes',
//       value: stats.themes,
//       icon: Palette,
//       color: 'bg-pink-500',
//       permission: hasPermission('theme', 'read'),
//       onClick: () => router.push('/theme'),
//     },
//   ].filter((card) => card.permission);

//   // Show loading state while permissions are loading or data is loading
//   if (permissionsLoading || loading) {
//     return (
//       <div className="p-6">
//         <div className="animate-pulse space-y-4">
//           <div className="h-8 bg-gray-200 rounded w-1/4"></div>
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//             {[1, 2, 3].map((i) => (
//               <div key={i} className="h-24 bg-gray-200 rounded"></div>
//             ))}
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="p-4 sm:p-6 space-y-6">
//       <div>
//         <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
//         <p className="text-gray-600">Welcome to your admin dashboard</p>
//       </div>

//       {statCards.length === 0 ? (
//         <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center space-x-3">
//           <AlertCircle className="h-5 w-5 text-yellow-600" />
//           <p className="text-sm text-yellow-800">
//             You don&apos;t have permission to view any dashboard statistics.
//           </p>
//         </div>
//       ) : (
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
//           {statCards.map((card) => {
//             const Icon = card.icon;
//             return (
//               <button
//                 key={card.label}
//                 onClick={card.onClick}
//                 className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md hover:border-primary-300 transition-all text-left group"
//               >
//                 <div className="flex items-center justify-between">
//                   <div>
//                     <p className="text-sm text-gray-600 mb-1">{card.label}</p>
//                     <p className="text-2xl sm:text-3xl font-bold text-gray-900">{card.value}</p>
//                   </div>
//                   <div className={`${card.color} p-3 rounded-lg group-hover:scale-110 transition-transform`}>
//                     <Icon className="h-6 w-6 text-white" />
//                   </div>
//                 </div>
//                 <div className="mt-2 flex items-center text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
//                   <span className="text-sm font-medium">View details</span>
//                   <ArrowRight className="h-4 w-4 ml-1" />
//                 </div>
//               </button>
//             );
//           })}
//         </div>
//       )}

//       <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
//         <div className="flex items-center space-x-2 mb-4">
//           <TrendingUp className="h-5 w-5 text-primary-600" />
//           <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
//         </div>
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//           {hasPermission('user', 'create') && (
//             <button
//               onClick={() => router.push('/users')}
//               className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
//             >
//               <Users className="h-5 w-5 text-primary-600 mb-2" />
//               <p className="font-medium text-gray-900">Create User</p>
//               <p className="text-sm text-gray-600">Add a new user to your organization</p>
//             </button>
//           )}
//           {hasPermission('role', 'create') && (
//             <button
//               onClick={() => router.push('/roles')}
//               className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
//             >
//               <Shield className="h-5 w-5 text-primary-600 mb-2" />
//               <p className="font-medium text-gray-900">Create Role</p>
//               <p className="text-sm text-gray-600">Define a new role with permissions</p>
//             </button>
//           )}
//           {hasPermission('api_key', 'create') && (
//             <button
//               onClick={() => router.push('/api-keys')}
//               className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
//             >
//               <Key className="h-5 w-5 text-primary-600 mb-2" />
//               <p className="font-medium text-gray-900">Create API Key</p>
//               <p className="text-sm text-gray-600">Generate a new API key for integrations</p>
//             </button>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MoreHorizontal } from "lucide-react";

export default function Dashboard() {
  const projects = [
    { name: "Data Analytics", date: "03-11-2025" },
    { name: "Machine Learning", date: "05-15-2025" },
    { name: "Artificial Intelligence", date: "08-20-2025" },
    { name: "Cloud Computing", date: "04-10-2025" },
    { name: "Big Data", date: "06-01-2025" },
    { name: "Cybersecurity", date: "09-30-2025" },
    { name: "Blockchain Technology", date: "02-14-2025" },
    { name: "Internet of Things", date: "07-18-2025" },
    { name: "Augmented Reality", date: "10-05-2025" },
    { name: "DevOps Practices", date: "01-25-2025" },
    { name: "5G Technology", date: "07-25-2025" },
    { name: "Virtual Reality", date: "11-15-2025" },
    { name: "Cloud Security", date: "05-10-2025" },
    { name: "Artificial Intelligence", date: "09-05-2025" },
    { name: "Blockchain Integration", date: "12-20-2025" },
    { name: "Internet of Things", date: "04-30-2025" },
    { name: "Edge Computing", date: "08-22-2025" },
    { name: "Data Analytics", date: "01-18-2026" },
  ];

  return (
    <div className="p-6 sm:p-8 bg-white min-h-full">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Hey, Kumari</h1>
        <p className="text-gray-500 mt-1 text-sm">Start to work around new DMN's</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {/* No. of Projects Card */}
        <Card className="p-6 bg-gray-50 border-0 shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-2">No.of Projects</p>
              <p className="text-4xl font-bold text-gray-900">12757</p>
            </div>
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="#E5E7EB"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="#3B82F6"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray="176"
                  strokeDashoffset="26"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </Card>

        {/* Credits Left Card (Red) */}
        <Card className="p-6 bg-gray-50 border-0 shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-2">Credits left</p>
              <p className="text-4xl font-bold text-red-600">972/1000</p>
            </div>
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="#E5E7EB"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="#EF4444"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray="176"
                  strokeDashoffset="18"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </Card>

        {/* Credits Left Card (Gray) */}
        <Card className="p-6 bg-gray-50 border-0 shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-2">Credits left</p>
              <p className="text-4xl font-bold text-gray-900">972/1000</p>
            </div>
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="#E5E7EB"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="#6B7280"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray="176"
                  strokeDashoffset="18"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </Card>
      </div>

      {/* Projects Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-5 text-gray-900">Projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project, index) => (
            <Card
              key={index}
              className="p-5 bg-gray-50 border-0 shadow-none hover:bg-gray-100 transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 text-base">{project.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{project.date}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                >
                  <MoreHorizontal className="w-4 h-4 text-gray-500" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Bottom User Info */}
      <div className="mt-12 flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src="" />
          <AvatarFallback className="bg-gray-200 text-gray-600">EC</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-sm text-gray-900">Emallia Caitin</p>
          <Badge variant="secondary" className="mt-1 text-xs">
            Free
          </Badge>
        </div>
      </div>
    </div>
  );
}