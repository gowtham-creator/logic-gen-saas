'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Edit, Trash2, Mail, Code, Crown, UserCheck, UserX, Calendar, X, Loader2, ChevronUp, ChevronDown, Filter, MoreVertical } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import DeleteSystemUserModal from './DeleteSystemUserModal';
import { Status } from '@/components/ui';

interface SystemUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
  isDeveloper: boolean;
  isActive: boolean;
  client: {
    id: string;
    name: string;
    subdomain: string;
  } | null;
  role: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface EditUserModalProps {
  user: SystemUser;
  onClose: () => void;
  onSave: () => void;
}

function EditUserModal({ user, onClose, onSave }: EditUserModalProps) {
  const [isSuperAdmin, setIsSuperAdmin] = useState(user.isSuperAdmin);
  const [isDeveloper, setIsDeveloper] = useState(user.isDeveloper);
  const [isActive, setIsActive] = useState(user.isActive);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
        await apiClient.put(`/api/super-admin/system-users/${user.id}`, {
          isSuperAdmin,
          isDeveloper,
          isActive,
        });
        notificationService.success('System user updated successfully');
      onSave();
      onClose();
    } catch (error: any) {
      notificationService.error(error.message || 'Failed to update system user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Edit System User</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
            </div>

          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">User</div>
            <div className="font-medium text-gray-900">{user.firstName} {user.lastName}</div>
            <div className="text-sm text-gray-500 flex items-center space-x-1 mt-1">
              <Mail className="h-3 w-3" />
              <span>{user.email}</span>
            </div>
            {user.client && (
              <div className="text-sm text-gray-500 mt-1">Client: {user.client.name}</div>
            )}
            </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">Privileges</label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isSuperAdmin"
                  checked={isSuperAdmin}
                  onChange={(e) => setIsSuperAdmin(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="isSuperAdmin" className="flex items-center space-x-2 text-sm text-gray-700">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <span>Super Admin</span>
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isDeveloper"
                  checked={isDeveloper}
                  onChange={(e) => setIsDeveloper(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="isDeveloper" className="flex items-center space-x-2 text-sm text-gray-700">
                  <Code className="h-4 w-4 text-blue-500" />
                  <span>Developer</span>
                </label>
              </div>
            </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
              </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || (!isSuperAdmin && !isDeveloper)}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Update'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

interface SearchResultUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  client: {
    id: string;
    name: string;
    subdomain: string;
  } | null;
  isSuperAdmin: boolean;
  isDeveloper: boolean;
}

interface AddPrivilegesModalProps {
  user: SearchResultUser;
  onClose: () => void;
  onSave: () => void;
}

function AddPrivilegesModal({ user, onClose, onSave }: AddPrivilegesModalProps) {
  const [isSuperAdmin, setIsSuperAdmin] = useState(user.isSuperAdmin || false);
  const [isDeveloper, setIsDeveloper] = useState(user.isDeveloper || false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSuperAdmin && !isDeveloper) {
      notificationService.error('Please select at least one privilege (Super Admin or Developer)');
      return;
    }

    setLoading(true);

    try {
      await apiClient.put(`/api/super-admin/system-users/${user.id}`, {
        isSuperAdmin,
        isDeveloper,
      });
      notificationService.success('Privileges added successfully');
      onSave();
      onClose();
    } catch (error: any) {
      notificationService.error(error.message || 'Failed to add privileges');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Add Privileges</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">User</div>
            <div className="font-medium text-gray-900">{user.firstName} {user.lastName}</div>
            <div className="text-sm text-gray-500 flex items-center space-x-1 mt-1">
              <Mail className="h-3 w-3" />
              <span>{user.email}</span>
            </div>
            {user.client && (
              <div className="text-sm text-gray-500 mt-1">Client: {user.client.name}</div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Privileges</label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="addIsSuperAdmin"
                  checked={isSuperAdmin}
                  onChange={(e) => setIsSuperAdmin(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="addIsSuperAdmin" className="flex items-center space-x-2 text-sm text-gray-700">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <span>Super Admin</span>
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="addIsDeveloper"
                  checked={isDeveloper}
                  onChange={(e) => setIsDeveloper(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="addIsDeveloper" className="flex items-center space-x-2 text-sm text-gray-700">
                  <Code className="h-4 w-4 text-blue-500" />
                  <span>Developer</span>
                </label>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || (!isSuperAdmin && !isDeveloper)}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Adding...' : 'Add Privileges'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

type SortField = 'name' | 'permissions' | 'client' | 'status' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export default function SystemUsers() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<SystemUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchResultUser | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const menuRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<SystemUser[]>('/api/super-admin/system-users');
      setUsers(data);
    } catch (error: any) {
      console.error('Failed to load system users:', error);
      notificationService.error('Failed to load system users');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      notificationService.error('Please enter an email to search');
      return;
    }

    setSearching(true);
    setSearchResults([]);

    try {
      const response = await apiClient.get<SearchResultUser>(`/api/super-admin/users/search?email=${encodeURIComponent(searchQuery.trim())}`);

      if (response) {
        setSearchResults([response]);
      } else {
        setSearchResults([]);
        notificationService.info('No users found with that email');
      }
    } catch (error: any) {
      console.error('Search error:', error);
      if (error.response?.status === 404) {
        setSearchResults([]);
        notificationService.info('No users found with that email');
      } else {
        notificationService.error(error.message || 'Failed to search users');
      }
    } finally {
      setSearching(false);
    }
  };

  const handleAddPrivileges = (user: SearchResultUser) => {
    setSelectedUser(user);
    setShowAddModal(true);
  };

  const handleEdit = (user: SystemUser) => {
    setEditingUser(user);
    setShowEditModal(true);
    setOpenMenuId(null);
  };

  const handleDeleteClick = (user: SystemUser) => {
    setDeletingUser(user);
    setShowDeleteModal(true);
    setOpenMenuId(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;

    setIsDeleting(true);
    try {
      await apiClient.delete(`/api/super-admin/system-users/${deletingUser.id}`);
      notificationService.success('System user deleted successfully');
      loadUsers();
      setShowDeleteModal(false);
      setDeletingUser(null);
    } catch (error: any) {
      notificationService.error(error.message || 'Failed to delete system user');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortedUsers = () => {
    const sorted = [...users].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = `${a.firstName} ${a.lastName}`.toLowerCase();
          bValue = `${b.firstName} ${b.lastName}`.toLowerCase();
          break;
        case 'permissions':
          aValue = a.isSuperAdmin ? 2 : a.isDeveloper ? 1 : 0;
          bValue = b.isSuperAdmin ? 2 : b.isDeveloper ? 1 : 0;
          break;
        case 'client':
          aValue = a.client?.name?.toLowerCase() || '';
          bValue = b.client?.name?.toLowerCase() || '';
          break;
        case 'status':
          aValue = a.isActive ? 1 : 0;
          bValue = b.isActive ? 1 : 0;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
    }
  };

  const toggleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
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
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading system users...</p>
        </div>
      </div>
    );
  }

  const sortedUsers = getSortedUsers();

  return (
    <div className="space-y-6">
      {/* Header with Search and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          {/* Search Bar */}
          <div className="relative flex-1 sm:flex-initial sm:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B5FC7] focus:border-transparent text-sm"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="px-4 py-2 bg-[#5B5FC7] text-white rounded-lg hover:bg-[#4a4db5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2"
          >
            {searching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span>Search User</span>
              </>
            )}
          </button>
        </div>
        <div className='flex gap-4'>
          <button className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-500">
            <span>Filters</span>
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-700 mb-3">Search Results:</div>
          {searchResults.map((result) => (
            <div
              key={result.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  {result.firstName} {result.lastName}
                </div>
                <div className="text-sm text-gray-500 flex items-center space-x-1">
                  <Mail className="h-3 w-3" />
                  <span>{result.email}</span>
                </div>
                {result.client && (
                  <div className="text-xs text-gray-400 mt-1">Client: {result.client.name}</div>
                )}
                {(result.isSuperAdmin || result.isDeveloper) && (
                  <div className="flex gap-2 mt-2">
                    {result.isSuperAdmin && (
                      <span className="inline-flex items-center px-3 py-1 rounded-sm text-[14px] font-medium bg-blue-50 border border-blue-700 text-blue-700">
                        Enterprise
                      </span>
                    )}
                    {result.isDeveloper && (
                      <span className="inline-flex items-center px-3 py-1 rounded-sm text-[14px] font-medium bg-blue-50 border border-blue-700 text-blue-700">
                        Individual
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleAddPrivileges(result)}
                className="ml-4 px-4 py-2 bg-[#5B5FC7] text-white rounded-lg hover:bg-[#4a4db5] transition-colors text-sm font-medium"
              >
                Add Privileges
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Users Table */}
      {users.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="text-gray-600">No system users found</div>
            <p className="text-sm text-gray-500">Search for users above to add privileges</p>
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
                      checked={selectedUsers.size === users.length}
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
                    onClick={() => handleSort('permissions')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Permissions</span>
                      <SortIcon field="permissions" />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-[16px] font-semibold text-gray-900 cursor-pointer select-none hidden md:table-cell"
                    onClick={() => handleSort('client')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Client</span>
                      <SortIcon field="client" />
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
                  <th
                    className="px-6 py-3 text-left text-[16px] font-semibold text-gray-900 cursor-pointer select-none hidden lg:table-cell"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Created at</span>
                      <SortIcon field="createdAt" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-[16px] font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.id)}
                        onChange={() => toggleSelectUser(user.id)}
                        className="rounded border-gray-300 text-[#5B5FC7] focus:ring-[#5B5FC7]"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[16px] font-bold text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-[16px] text-gray-500 flex items-center gap-1 mt-1">
                        <Mail className="h-4 w-4" />
                        <span>{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {user.isSuperAdmin && (
                          <span className="inline-flex items-center px-3 py-1 rounded-sm text-[14px] font-medium bg-blue-50 border border-blue-700 text-blue-700">
                            Enterprise
                          </span>
                        )}
                        {user.isDeveloper && (
                          <span className="inline-flex items-center px-3 py-1 rounded-sm text-[14px] font-medium bg-blue-50 border border-blue-700 text-blue-700">
                            Individual
                          </span>
                        )}
                        {!user.isSuperAdmin && !user.isDeveloper && (
                          <span className="inline-flex items-center px-3 py-1 rounded-sm text-[14px] font-medium bg-gray-50 border border-gray-300 text-gray-700">
                            Group
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[16px] text-gray-700 hidden md:table-cell">
                      {user.client ? user.client.name : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <Status status={user.isActive ? 'active' : 'inactive'} />
                    </td>
                    <td className="px-6 py-4 text-[16px] text-gray-700 hidden lg:table-cell">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block" ref={(el) => {
                        if (el) {
                          menuRefs.current.set(user.id, el);
                        } else {
                          menuRefs.current.delete(user.id);
                        }
                      }}>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MoreVertical className="h-5 w-5 text-gray-600" />
                        </button>

                        {openMenuId === user.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                            <button
                              onClick={() => handleEdit(user)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Edit className="h-4 w-4" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteClick(user)}
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

      {showEditModal && editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => {
            setShowEditModal(false);
            setEditingUser(null);
          }}
          onSave={loadUsers}
        />
      )}

      {showAddModal && selectedUser && (
        <AddPrivilegesModal
          user={selectedUser}
          onClose={() => {
            setShowAddModal(false);
            setSelectedUser(null);
            setSearchResults([]);
            setSearchQuery('');
          }}
          onSave={() => {
            loadUsers();
            setSearchResults([]);
            setSearchQuery('');
          }}
        />
      )}

      {showDeleteModal && deletingUser && (
        <DeleteSystemUserModal
          isOpen={showDeleteModal}
          user={deletingUser}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setShowDeleteModal(false);
            setDeletingUser(null);
          }}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
