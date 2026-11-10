'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  ShieldCheck,
  X,
  Loader2,
  Search,
  SlidersHorizontal,
  ChevronDown,
  MoreVertical,
  ChevronUp,
  MoreHorizontal
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import ClientModal from '@/components/ClientModal';
import DeleteClientConfirmationModal from './DeleteClientConfirmationModal';
import { Client, Plan } from '@/types';
import { Filter } from '@mynaui/icons-react';
import { Status } from '@/components/ui';

interface ClientWithDates extends Client {
  id: string;
  createdAt: string;
  isActive: boolean;
}

type SortField = 'name' | 'subdomain' | 'plan' | 'database' | 'mfa' | 'status' | 'createdAt';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'inactive' | 'expired';

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithDates[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientWithDates | null>(null);
  const [showMFAConfirmModal, setShowMFAConfirmModal] = useState(false);
  const [mfaAction, setMfaAction] = useState<{ clientId: string; field: 'mfaRequired' | 'enforceMFA'; newValue: boolean; clientName: string } | null>(null);
  const [updatingMFA, setUpdatingMFA] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ClientWithDates | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New states for search, filter, and sort
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
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
        const menuRef = menuRefs.current.get(openMenuId);
        if (menuRef && !menuRef.contains(event.target as Node)) {
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
      const [clientsData, plansData] = await Promise.all([
        apiClient.get<ClientWithDates[]>('/api/clients'),
        apiClient.get<Plan[]>('/api/plans'),
      ]);
      // Ensure clientsData is always an array
      const clientsArray = Array.isArray(clientsData) ? clientsData : [];
      setClients(clientsArray);
      setPlans(plansData);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      notificationService.error(error.message || 'Failed to load clients');
      // Set empty array on error to prevent map error
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = () => {
    setEditingClient(null);
    setShowClientModal(true);
  };

  const handleEditClient = (client: ClientWithDates) => {
    setEditingClient(client);
    setShowClientModal(true);
  };

  const handleDeleteClient = (id: string) => {
    const client = clients.find((c) => c.id === id);
    if (client) {
      setClientToDelete(client);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!clientToDelete) return;

    setIsDeleting(true);
    try {
      await apiClient.delete(`/api/clients/${clientToDelete.id}`);
      notificationService.success('Client deleted successfully');
      setClientToDelete(null);
      loadData();
    } catch (error: any) {
      notificationService.error(error.message || 'Failed to delete client');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setClientToDelete(null);
  };

  const handleMFAToggle = (client: ClientWithDates, field: 'mfaRequired' | 'enforceMFA') => {
    const currentValue = client[field] || false;
    const newValue = !currentValue;

    setMfaAction({
      clientId: client.id!,
      field,
      newValue,
      clientName: client.name,
    });
    setShowMFAConfirmModal(true);
  };

  const handleMFAConfirm = async () => {
    if (!mfaAction) return;

    try {
      setUpdatingMFA(true);
      await apiClient.put(`/api/clients/${mfaAction.clientId}`, {
        [mfaAction.field]: mfaAction.newValue,
      });

      const fieldLabel = mfaAction.field === 'mfaRequired' ? 'MFA Required' : 'Enforce MFA';
      notificationService.success(`${fieldLabel} ${mfaAction.newValue ? 'enabled' : 'disabled'} successfully`);

      setShowMFAConfirmModal(false);
      setMfaAction(null);
      loadData();
    } catch (error: any) {
      notificationService.error(error.message || 'Failed to update MFA settings');
    } finally {
      setUpdatingMFA(false);
    }
  };

  const handleMFACancel = () => {
    setShowMFAConfirmModal(false);
    setMfaAction(null);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Get client status
  const getClientStatus = (client: ClientWithDates): 'active' | 'inactive' | 'expired' => {
    if (!client.isActive) return 'inactive';

    // Check if plan is expired (if plan has expiry date)
    if (client.plan && 'expiryDate' in client.plan) {
      const expiryDate = new Date((client.plan as any).expiryDate);
      if (expiryDate < new Date()) return 'expired';
    }

    return 'active';
  };

  // Filter and sort clients
  const getFilteredAndSortedClients = () => {
    let filtered = [...clients];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (client) =>
          client.name.toLowerCase().includes(query) ||
          client.subdomain?.toLowerCase().includes(query) ||
          client.plan?.name.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((client) => getClientStatus(client) === statusFilter);
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
        case 'subdomain':
          aValue = (a.subdomain || '').toLowerCase();
          bValue = (b.subdomain || '').toLowerCase();
          break;
        case 'plan':
          aValue = (a.plan?.name || '').toLowerCase();
          bValue = (b.plan?.name || '').toLowerCase();
          break;
        case 'database':
          aValue = (a.databaseConfig?.isolationLevel || '').toLowerCase();
          bValue = (b.databaseConfig?.isolationLevel || '').toLowerCase();
          break;
        case 'mfa':
          aValue = (a.mfaRequired ? 1 : 0) + (a.enforceMFA ? 1 : 0);
          bValue = (b.mfaRequired ? 1 : 0) + (b.enforceMFA ? 1 : 0);
          break;
        case 'status':
          aValue = getClientStatus(a);
          bValue = getClientStatus(b);
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
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

  const filteredClients = getFilteredAndSortedClients();

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
  const handleSelectAll = () => {
    if (selectedClients.size === filteredClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(filteredClients.map((c) => c.id)));
    }
  };

  const handleSelectClient = (clientId: string) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClients(newSelected);
  };

  // Truncate subdomain
  const truncateSubdomain = (subdomain: string | undefined, maxLength = 15) => {
    if (!subdomain) return '-';
    if (subdomain.length <= maxLength) return subdomain;
    return subdomain.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <h1 className="text-3xl font-medium text-[#5B5FC7]">Client Management</h1>
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          {/* Search Bar */}
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
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
                {(['all', 'active', 'inactive', 'expired'] as StatusFilter[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(status);
                      setShowStatusDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${statusFilter === status ? 'bg-gray-100 font-medium text-[#5B5FC7]' : 'text-gray-700'
                      }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add Clients Button */}
          <button
            onClick={handleCreateClient}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#5B5FC7] hover:bg-[#4B4CB2] text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>Add Clients</span>
          </button>
        </div>
      </div>

      {filteredClients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 text-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 bg-gray-100 rounded-full">
              <Building2 className="h-12 w-12 text-gray-400" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery || statusFilter !== 'all' ? 'No clients found' : 'No clients yet'}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by creating your first client'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <button
                  onClick={handleCreateClient}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#5B5FC7] hover:bg-[#4B4CB2] text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Your First Client</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {/* Checkbox Column */}
                  <th className="px-4 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={selectedClients.size === filteredClients.length && filteredClients.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-[#5B5FC7] border-gray-300 rounded focus:ring-[#5B5FC7] focus:ring-2"
                    />
                  </th>

                  {/* Sortable Headers */}
                  <th
                    onClick={() => handleSort('name')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span>Name</span>
                      <div className="flex flex-col">
                        <ChevronUp
                          className={`h-3 w-3 -mb-1 ${sortField === 'name' && sortOrder === 'asc' ? 'text-[#5B5FC7]' : 'text-gray-400'
                            }`}
                        />
                        <ChevronDown
                          className={`h-3 w-3 ${sortField === 'name' && sortOrder === 'desc' ? 'text-[#5B5FC7]' : 'text-gray-400'
                            }`}
                        />
                      </div>
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('subdomain')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span>Sub Domain</span>
                      <div className="flex flex-col">
                        <ChevronUp
                          className={`h-3 w-3 -mb-1 ${sortField === 'subdomain' && sortOrder === 'asc' ? 'text-[#5B5FC7]' : 'text-gray-400'
                            }`}
                        />
                        <ChevronDown
                          className={`h-3 w-3 ${sortField === 'subdomain' && sortOrder === 'desc' ? 'text-[#5B5FC7]' : 'text-gray-400'
                            }`}
                        />
                      </div>
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('plan')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span>Plan</span>
                      <div className="flex flex-col">
                        <ChevronUp
                          className={`h-3 w-3 -mb-1 ${sortField === 'plan' && sortOrder === 'asc' ? 'text-[#5B5FC7]' : 'text-gray-400'
                            }`}
                        />
                        <ChevronDown
                          className={`h-3 w-3 ${sortField === 'plan' && sortOrder === 'desc' ? 'text-[#5B5FC7]' : 'text-gray-400'
                            }`}
                        />
                      </div>
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('database')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span>Database</span>
                      <div className="flex flex-col">
                        <ChevronUp
                          className={`h-3 w-3 -mb-1 ${sortField === 'database' && sortOrder === 'asc' ? 'text-[#5B5FC7]' : 'text-gray-400'
                            }`}
                        />
                        <ChevronDown
                          className={`h-3 w-3 ${sortField === 'database' && sortOrder === 'desc' ? 'text-[#5B5FC7]' : 'text-gray-400'
                            }`}
                        />
                      </div>
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('mfa')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span>MFA</span>
                      <div className="flex flex-col">
                        <ChevronUp
                          className={`h-3 w-3 -mb-1 ${sortField === 'mfa' && sortOrder === 'asc' ? 'text-[#5B5FC7]' : 'text-gray-400'
                            }`}
                        />
                        <ChevronDown
                          className={`h-3 w-3 ${sortField === 'mfa' && sortOrder === 'desc' ? 'text-[#5B5FC7]' : 'text-gray-400'
                            }`}
                        />
                      </div>
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('status')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span>Status</span>
                      <div className="flex flex-col">
                        <ChevronUp
                          className={`h-3 w-3 -mb-1 ${sortField === 'status' && sortOrder === 'asc' ? 'text-[#5B5FC7]' : 'text-gray-400'
                            }`}
                        />
                        <ChevronDown
                          className={`h-3 w-3 ${sortField === 'status' && sortOrder === 'desc' ? 'text-[#5B5FC7]' : 'text-gray-400'
                            }`}
                        />
                      </div>
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('createdAt')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span>Created At</span>
                      <div className="flex flex-col">
                        <ChevronUp
                          className={`h-3 w-3 -mb-1 ${sortField === 'createdAt' && sortOrder === 'asc' ? 'text-[#5B5FC7]' : 'text-gray-400'
                            }`}
                        />
                        <ChevronDown
                          className={`h-3 w-3 ${sortField === 'createdAt' && sortOrder === 'desc' ? 'text-[#5B5FC7]' : 'text-gray-400'
                            }`}
                        />
                      </div>
                    </div>
                  </th>

                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredClients.map((client) => {
                  const clientStatus = getClientStatus(client);
                  return (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                      {/* Checkbox */}
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedClients.has(client.id)}
                          onChange={() => handleSelectClient(client.id)}
                          className="w-4 h-4 text-[#5B5FC7] border-gray-300 rounded focus:ring-[#5B5FC7] focus:ring-2"
                        />
                      </td>

                      {/* Name */}
                      <td className="px-4 py-4 font-bold text-gray-900 text-[16px]">
                        {client.name}
                      </td>

                      {/* Subdomain */}
                      <td className="px-4 py-4 text-gray-600 text-[16px]">
                        {truncateSubdomain(client.subdomain)}
                      </td>

                      {/* Plan */}
                      <td className="px-4 py-4">
                        {client.plan ? (
                          <span className="inline-flex items-center px-4 py-1.5 rounded-full text-[14px] font-medium bg-indigo-50 border border-indigo-700 text-indigo-700">
                            {client.plan.name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">No plan</span>
                        )}
                      </td>

                      {/* Database */}
                      <td className="px-4 py-4">
                        {client.databaseConfig ? (
                          <span className="inline-flex items-center px-4 py-1.5 rounded-sm text-[16px] font-medium bg-[#FFC14D] text-white">
                            {client.databaseConfig.isolationLevel === 'shared' && 'Shared DB'}
                            {client.databaseConfig.isolationLevel === 'database' && 'Cloud DB'}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>

                      {/* MFA */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1.5">
                          <label
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => handleMFAToggle(client, 'mfaRequired')}
                          >
                            <div className={`w-4 h-4 rounded flex items-center justify-center ${client.mfaRequired ? 'bg-[#5B5FC7]' : 'border border-gray-300 bg-white'}`}>
                              {client.mfaRequired && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className="text-[16px] text-gray-700">Required</span>
                          </label>
                          <label
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => handleMFAToggle(client, 'enforceMFA')}
                          >
                            <div className={`w-4 h-4 rounded flex items-center justify-center ${client.enforceMFA ? 'bg-[#5B5FC7]' : 'border border-gray-300 bg-white'}`}>
                              {client.enforceMFA && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className="text-[16px] text-gray-700">Enforce</span>
                          </label>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <Status status={clientStatus} />
                      </td>

                      {/* Created At */}
                      <td className="px-4 py-4 text-gray-600 text-[16px] font-semibold">
                        {formatDate(client.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 text-center">
                        <div
                          className="relative inline-block"
                          ref={(el) => {
                            if (el) {
                              menuRefs.current.set(client.id, el);
                            } else {
                              menuRefs.current.delete(client.id);
                            }
                          }}
                        >
                          <button
                            onClick={() => setOpenMenuId(openMenuId === client.id ? null : client.id)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <MoreHorizontal className="h-5 w-5 text-gray-600" />
                          </button>

                          {openMenuId === client.id && (
                            <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                              <button
                                onClick={() => {
                                  handleEditClient(client);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                              >
                                <Edit className="h-4 w-4" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => {
                                  handleDeleteClient(client.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showClientModal && (
        <ClientModal
          client={editingClient}
          plans={plans}
          onClose={() => {
            setShowClientModal(false);
            setEditingClient(null);
            loadData();
          }}
          onSave={() => {
            loadData();
          }}
        />
      )}

      {showMFAConfirmModal && mfaAction && (
        <div className="modal-overlay" onClick={handleMFACancel}>
          <div className="modal-content p-4 sm:p-6 lg:p-8 max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-200">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className={`p-1.5 sm:p-2 rounded-lg ${mfaAction.newValue ? 'bg-blue-100' : 'bg-orange-100'}`}>
                  <ShieldCheck className={`h-4 w-4 sm:h-5 sm:w-5 ${mfaAction.newValue ? 'text-blue-600' : 'text-orange-600'}`} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {mfaAction.field === 'mfaRequired' ? 'MFA Required' : 'Enforce MFA'}
                </h2>
              </div>
              <button
                onClick={handleMFACancel}
                className="btn-icon"
                disabled={updatingMFA}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <div className={`mb-4 p-4 border rounded-lg ${mfaAction.newValue ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                <p className={`text-sm font-medium mb-2 ${mfaAction.newValue ? 'text-blue-800' : 'text-orange-800'}`}>
                  {mfaAction.newValue
                    ? `Are you sure you want to ${mfaAction.field === 'mfaRequired' ? 'require' : 'enforce'} MFA for "${mfaAction.clientName}"?`
                    : `Are you sure you want to disable ${mfaAction.field === 'mfaRequired' ? 'MFA requirement' : 'MFA enforcement'} for "${mfaAction.clientName}"?`
                  }
                </p>
                <p className={`text-sm ${mfaAction.newValue ? 'text-blue-700' : 'text-orange-700'}`}>
                  {mfaAction.field === 'mfaRequired'
                    ? mfaAction.newValue
                      ? 'This will require all users to verify MFA during login.'
                      : 'Users will no longer be required to verify MFA during login (if they have it enabled).'
                    : mfaAction.newValue
                      ? 'This will enforce MFA for all users in this tenant. Users who haven\'t set up MFA will be required to do so.'
                      : 'Users will no longer be forced to enable MFA, but can still enable it voluntarily.'
                  }
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={handleMFACancel}
                disabled={updatingMFA}
                className="btn-secondary flex-1 sm:flex-none px-6 py-2.5"
              >
                Cancel
              </button>
              <button
                onClick={handleMFAConfirm}
                disabled={updatingMFA}
                className={`flex-1 sm:flex-none px-6 py-2.5 flex items-center justify-center space-x-2 ${mfaAction.newValue
                  ? 'btn-primary'
                  : 'bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors'
                  }`}
              >
                {updatingMFA ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>{mfaAction.newValue ? 'Enable' : 'Disable'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Client Confirmation Modal */}
      <DeleteClientConfirmationModal
        isOpen={clientToDelete !== null}
        client={clientToDelete ? { name: clientToDelete.name, subdomain: clientToDelete.subdomain } : null}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isDeleting={isDeleting}
      />
    </div>
  );
}

