'use client';

import { useState, useEffect, useRef } from 'react';
import {
  CreditCard,
  Plus,
  Edit,
  Trash2,
  Search,
  ChevronUp,
  ChevronDown,
  Filter,
  MoreVertical
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import PlanModal from '@/components/PlanModal';
import DeletePlanModal from './DeletePlanModal';
import { Plan } from '@/types';
import { Status } from '@/components/ui';

interface PlanWithDetails extends Plan {
  id: string;
  isActive: boolean;
}

type SortField = 'name' | 'price' | 'permissions' | 'database' | 'status';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'inactive';

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanWithDetails | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<PlanWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Search, filter, and sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const menuRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    loadData();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
      if (openMenuId) {
        const menuElement = menuRefs.current.get(openMenuId);
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setOpenMenuId(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const plansData = await apiClient.get<PlanWithDetails[]>('/api/plans');
      setPlans(plansData);
    } catch (error: any) {
      console.error('Failed to load plans:', error);
      notificationService.error(error.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = () => {
    setEditingPlan(null);
    setShowPlanModal(true);
  };

  const handleEditPlan = (plan: PlanWithDetails) => {
    setEditingPlan(plan);
    setShowPlanModal(true);
    setOpenMenuId(null);
  };

  const handleDeleteClick = (plan: PlanWithDetails) => {
    setDeletingPlan(plan);
    setShowDeleteModal(true);
    setOpenMenuId(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPlan) return;

    setIsDeleting(true);
    try {
      await apiClient.delete(`/api/plans/${deletingPlan.id}`);
      notificationService.success('Plan deleted successfully');
      setShowDeleteModal(false);
      setDeletingPlan(null);
      loadData();
    } catch (error: any) {
      notificationService.error(error.message || 'Failed to delete plan');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter and sort plans
  const getFilteredAndSortedPlans = () => {
    let filtered = [...plans];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (plan) =>
          plan.name.toLowerCase().includes(query) ||
          (plan.price?.toString() || '').includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((plan) =>
        statusFilter === 'active' ? plan.isActive : !plan.isActive
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'price':
          aValue = a.price || 0;
          bValue = b.price || 0;
          break;
        case 'permissions':
          aValue = Object.keys(a.allowedPermissions || {}).length;
          bValue = Object.keys(b.allowedPermissions || {}).length;
          break;
        case 'database':
          aValue = a.databasePermissions?.allowedIsolationLevels?.length || 0;
          bValue = b.databasePermissions?.allowedIsolationLevels?.length || 0;
          break;
        case 'status':
          aValue = a.isActive ? 1 : 0;
          bValue = b.isActive ? 1 : 0;
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  };

  const filteredPlans = getFilteredAndSortedPlans();

  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Bulk selection
  const toggleSelectAll = () => {
    if (selectedPlans.size === filteredPlans.length) {
      setSelectedPlans(new Set());
    } else {
      setSelectedPlans(new Set(filteredPlans.map((p) => p.id)));
    }
  };

  const toggleSelectPlan = (planId: string) => {
    const newSelected = new Set(selectedPlans);
    if (newSelected.has(planId)) {
      newSelected.delete(planId);
    } else {
      newSelected.add(planId);
    }
    setSelectedPlans(newSelected);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronUp className="h-4 w-4 text-gray-300" />;
    }
    return sortOrder === 'asc' ?
      <ChevronUp className="h-4 w-4 text-gray-600" /> :
      <ChevronDown className="h-4 w-4 text-gray-600" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <h1 className="text-3xl font-bold text-[#5B5FC7]">Plan Management</h1>
      </div>

      {/* Search and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          {/* Search Bar */}
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search plans"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FC7] focus:border-transparent text-sm"
            />
          </div>
        </div>
        <div className='flex gap-4'>
          {/* Filters Button */}
          <button className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-500">
            <span>Filters</span>
            <Filter className="h-4 w-4" />
          </button>

          {/* Status Dropdown */}
          <div className="relative" ref={statusDropdownRef}>
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-500 w-full sm:w-auto"
            >
              <span>Status</span>
              <ChevronDown className="h-4 w-4" />
            </button>

            {showStatusDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                {(['all', 'active', 'inactive'] as StatusFilter[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(status);
                      setShowStatusDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      statusFilter === status ? 'bg-gray-100 font-medium text-[#5B5FC7]' : 'text-gray-700'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Create Plan Button */}
          <button
            onClick={handleCreatePlan}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#5B5FC7] hover:bg-[#4B4CB2] text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>Create Plan</span>
          </button>
        </div>
      </div>

      {filteredPlans.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 text-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 bg-gray-100 rounded-full">
              <CreditCard className="h-12 w-12 text-gray-400" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery || statusFilter !== 'all' ? 'No plans found' : 'No plans yet'}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by creating your first plan'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <button
                  onClick={handleCreatePlan}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#5B5FC7] hover:bg-[#4B4CB2] text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Your First Plan</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedPlans.size === filteredPlans.length && filteredPlans.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-[#5B5FC7] focus:ring-[#5B5FC7]"
                    />
                  </th>
                  <th
                    className="px-6 py-3 text-left text-[16px] font-semibold text-gray-900 cursor-pointer select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Name</span>
                      <SortIcon field="name" />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-[16px] font-semibold text-gray-900 cursor-pointer select-none"
                    onClick={() => handleSort('price')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Price</span>
                      <SortIcon field="price" />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-[16px] font-semibold text-gray-900 cursor-pointer select-none hidden md:table-cell"
                    onClick={() => handleSort('permissions')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Permissions</span>
                      <SortIcon field="permissions" />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-[16px] font-semibold text-gray-900 cursor-pointer select-none hidden lg:table-cell"
                    onClick={() => handleSort('database')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Database Isolation</span>
                      <SortIcon field="database" />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-[16px] font-semibold text-gray-900 cursor-pointer select-none"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Status</span>
                      <SortIcon field="status" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-[16px] font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedPlans.has(plan.id)}
                        onChange={() => toggleSelectPlan(plan.id)}
                        className="rounded border-gray-300 text-[#5B5FC7] focus:ring-[#5B5FC7]"
                      />
                    </td>
                    <td className="px-6 py-4 text-[16px] font-bold text-gray-900">
                      {plan.name}
                    </td>
                    <td className="px-6 py-4 text-[16px] text-gray-700">
                      {plan.price ? (
                        <span className="font-semibold">
                          ${plan.price}/{plan.billingPeriod || 'month'}
                        </span>
                      ) : (
                        <span className="text-gray-500">Free</span>
                      )}
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-[14px] font-medium bg-blue-50 border border-[#007DD0] text-[#007DD0]">
                        {Object.keys(plan.allowedPermissions || {}).length} Permissions
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      {plan.databasePermissions ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-[14px] font-medium bg-[#FFF5F5] border border-[#D60000] text-[#D60000] w-fit">
                            {plan.databasePermissions.allowedIsolationLevels?.length || 0} Methods
                          </span>
                          {(plan.databasePermissions.allowCustomTables || plan.databasePermissions.allowCustomColumns) && (
                            <span className="text-xs text-gray-500">
                              {plan.databasePermissions.allowCustomTables && 'Custom Tables'}
                              {plan.databasePermissions.allowCustomTables && plan.databasePermissions.allowCustomColumns && ', '}
                              {plan.databasePermissions.allowCustomColumns && 'Custom Columns'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">Not configured</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Status status={plan.isActive ? 'active' : 'inactive'} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block" ref={(el) => {
                        if (el) {
                          menuRefs.current.set(plan.id, el);
                        } else {
                          menuRefs.current.delete(plan.id);
                        }
                      }}>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === plan.id ? null : plan.id)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MoreVertical className="h-5 w-5 text-gray-600" />
                        </button>

                        {openMenuId === plan.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                            <button
                              onClick={() => handleEditPlan(plan)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Edit className="h-4 w-4" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteClick(plan)}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showPlanModal && (
        <PlanModal
          plan={editingPlan}
          onClose={() => {
            setShowPlanModal(false);
            setEditingPlan(null);
            loadData();
          }}
          onSave={() => {
            loadData();
          }}
        />
      )}

      {showDeleteModal && deletingPlan && (
        <DeletePlanModal
          isOpen={showDeleteModal}
          plan={deletingPlan}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setShowDeleteModal(false);
            setDeletingPlan(null);
          }}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
