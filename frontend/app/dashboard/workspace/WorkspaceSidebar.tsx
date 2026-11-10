'use client';

import { Plus, Archive, Upload, Link, X, FileText, Image as ImageIcon, Code, Swatches, ClockCircle, Trash, Download } from '@mynaui/icons-react';
import { Loader2, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { WorkflowFile } from '../types/file';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import DocumentViewer from './DocumentViewer';

type PanelType = 'add' | 'saved' | 'documents' | 'images' | 'code' | 'templates' | 'history' | null;

interface WorkspaceSidebarProps {
  workspaceId: string;
  onAddClick?: () => void;
  onSavedClick?: () => void;
  onFilesChange?: () => void;
  selectedFileIds?: Set<string>;
  onFileSelectionChange?: (fileId: string, selected: boolean) => void;
}

interface SidebarItem {
  id: PanelType;
  icon: React.ReactNode;
  label: string;
  bgColor: string;
  iconColor: string;
  tooltip: string;
}

export default function WorkspaceSidebar({
  workspaceId,
  onAddClick,
  onSavedClick,
  onFilesChange,
  selectedFileIds = new Set(),
  onFileSelectionChange,
}: WorkspaceSidebarProps) {
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [showTooltip, setShowTooltip] = useState<PanelType>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Collapsed state
  const [collapsed, setCollapsed] = useState(false);

  const [workflowFiles, setWorkflowFiles] = useState<WorkflowFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<WorkflowFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fileToView, setFileToView] = useState<WorkflowFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load files from server on mount
  useEffect(() => {
    if (workspaceId) {
      loadFiles();
    }
  }, [workspaceId]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<WorkflowFile[]>(`/api/workflows/files?workflowIds=${workspaceId}`);
      setWorkflowFiles(data);
    } catch (error: any) {
      console.error('Failed to load files:', error);
      notificationService.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Validate file types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/jpg',
    ];
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg'];

    const invalidFiles: string[] = [];
    const validFiles: File[] = [];

    Array.from(files).forEach(file => {
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      notificationService.error(`Invalid file type(s): ${invalidFiles.join(', ')}`);
    }

    if (validFiles.length > 0) {
      handleUpload(validFiles);
    }

    // Reset input
    if (e.target) e.target.value = '';
  };

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;

    setUploading(true);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      await apiClient.post(`/api/workflows/${workspaceId}/files`, formData);

      const uploadedCount = files.length;
      notificationService.success(`Successfully uploaded ${uploadedCount} file(s)`);

      // Show success indicator
      setJustUploaded(true);
      setTimeout(() => setJustUploaded(false), 3000);

      loadFiles();
      onFilesChange?.();
    } catch (error: any) {
      console.error('Failed to upload files:', error);
      notificationService.error(error.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file: WorkflowFile) => {
    try {
      const response = await fetch(`/api/workflows/files/${file.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalFileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Failed to download file:', error);
      notificationService.error('Failed to download file');
    }
  };

  const handleDeleteClick = (file: WorkflowFile) => {
    setFileToDelete(file);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;

    setIsDeleting(true);
    try {
      await apiClient.delete(`/api/workflows/files/${fileToDelete.id}`);
      notificationService.success('File deleted successfully');
      setFileToDelete(null);
      loadFiles();
      onFilesChange?.();
    } catch (error: any) {
      console.error('Failed to delete file:', error);
      notificationService.error(error.message || 'Failed to delete file');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setFileToDelete(null);
  };

  const handleViewFile = (file: WorkflowFile) => {
    setFileToView(file);
  };

  const handleCloseViewer = () => {
    setFileToView(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const documents = workflowFiles.filter(f =>
    ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
      .includes(f.mimeType)
  );
  const images = workflowFiles.filter(f => f.mimeType.startsWith('image/'));

  // Get recent files (last 5 uploaded)
  const recentFiles = [...workflowFiles]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const sidebarItems: SidebarItem[] = [
    { id: 'add', icon: <Plus className="w-5 h-5" />, label: 'Add', bgColor: 'bg-blue-50', iconColor: 'text-blue-600', tooltip: 'Add new sources and files' },
    { id: 'saved', icon: <Archive className="w-5 h-5" />, label: 'Saved', bgColor: 'bg-amber-50', iconColor: 'text-amber-600', tooltip: 'Your saved items and bookmarks' },
    { id: 'documents', icon: <FileText className="w-5 h-5" />, label: 'Docs', bgColor: 'bg-green-50', iconColor: 'text-green-600', tooltip: 'View and manage documents' },
    { id: 'images', icon: <ImageIcon className="w-5 h-5" />, label: 'Images', bgColor: 'bg-purple-50', iconColor: 'text-purple-600', tooltip: 'Browse uploaded images' },
    { id: 'code', icon: <Code className="w-5 h-5" />, label: 'Code', bgColor: 'bg-orange-50', iconColor: 'text-orange-600', tooltip: 'Code snippets and examples' },
    { id: 'templates', icon: <Swatches className="w-5 h-5" />, label: 'Templates', bgColor: 'bg-pink-50', iconColor: 'text-pink-600', tooltip: 'Pre-built workflow templates' },
    { id: 'history', icon: <ClockCircle className="w-5 h-5" />, label: 'History', bgColor: 'bg-indigo-50', iconColor: 'text-indigo-600', tooltip: 'View conversation history' },
  ];

  const handleItemClick = (itemId: PanelType) => {
    if (collapsed) {
      // Expand when clicking an item while collapsed
      setCollapsed(false);
      setTimeout(() => setActivePanel(itemId), 200);
    } else {
      if (activePanel === itemId) {
        setActivePanel(null);
      } else {
        setActivePanel(itemId);
      }

      if (itemId === 'add') onAddClick?.();
      if (itemId === 'saved') onSavedClick?.();
    }
  };

  const handleMouseEnter = (itemId: PanelType) => {
    const timer = setTimeout(() => {
      if (activePanel !== itemId) {
        setShowTooltip(itemId);
      }
    }, 500);
    return () => clearTimeout(timer);
  };

  const handleMouseLeave = () => {
    setShowTooltip(null);
  };

  const toggleCollapse = () => {
    // Close panels when collapsing
    if (!collapsed) {
      setActivePanel(null);
    }
    setCollapsed(prev => !prev);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.doc"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* When collapsed: floating toggle button at top-left */}
      {collapsed ? (
        <div className="absolute left-2 top-2 z-50">
          <button
            onClick={toggleCollapse}
            aria-label="Expand sidebar"
            className="w-12 h-12 bg-white rounded-lg shadow-[0_5px_20px_rgba(0,0,0,0.08)] flex items-center justify-center hover:scale-105 transition-transform"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      ) : (
        /* When expanded: render sidebar + toggle placed BELOW the items */
        <div className="absolute left-2 top-2 z-40 flex gap-4 items-start transition-all duration-300">
          {/* Main Widget */}
          <div className="bg-white rounded-lg p-3 flex flex-col items-center gap-3 shadow-[0_5px_35px_3px_rgba(0,0,0,0.1)]">
            {sidebarItems.map((item) => {
              const isActive = activePanel === item.id;
              return (
                <div key={item.id} className="relative group">
                  <button
                    onClick={() => handleItemClick(item.id)}
                    onMouseEnter={() => handleMouseEnter(item.id)}
                    onMouseLeave={handleMouseLeave}
                    className="flex flex-col items-center gap-1 transition-all duration-300"
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isActive
                        ? `${item.bgColor} ${item.iconColor}`
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}>
                      {item.icon}
                    </div>

                    <span className={`text-[10px] font-medium transition-colors duration-300 ${
                      isActive ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {item.label}
                    </span>
                  </button>

                  {/* Tooltip */}
                  {showTooltip === item.id && (
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 pointer-events-none animate-in fade-in slide-in-from-left-2 duration-200">
                      <div className="bg-gray-900 text-white text-xs font-medium px-3 py-2 rounded-lg whitespace-nowrap shadow-lg">
                        {item.tooltip}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Collapse toggle placed below the items (centered) */}
            <div className="pt-2">
              <button
                onClick={toggleCollapse}
                aria-label="Collapse sidebar"
                className="w-10 h-10 bg-white border rounded-md flex items-center justify-center shadow-sm hover:scale-105 transition-transform"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Dynamic Panels */}
          {activePanel && (
            <div className={`bg-white rounded-2xl shadow-xl p-6 w-80 max-h-[calc(100vh-100px)] overflow-y-auto ${
              isTransitioning ? 'animate-out fade-out duration-200' : 'animate-in slide-in-from-left-4 fade-in duration-300'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">
                  {activePanel === 'add' && 'Add Sources'}
                  {activePanel === 'documents' && `Documents (${documents.length})`}
                  {activePanel === 'images' && `Images (${images.length})`}
                  {['code', 'templates', 'history', 'saved'].includes(activePanel!) &&
                    (activePanel === 'code' ? 'Code Snippets' :
                     activePanel === 'templates' ? 'Templates' :
                     activePanel === 'history' ? 'History' : 'Saved Items')
                  }
                </h3>
                <button
                  onClick={() => setActivePanel(null)}
                  className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Add Panel - Triggers Upload & Shows Recent Files */}
                {activePanel === 'add' && (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full flex items-center gap-3 p-4 bg-gray-50 hover:bg-blue-50 rounded-xl transition-all duration-200 text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="w-10 h-10 bg-blue-50 group-hover:bg-blue-100 rounded-lg flex items-center justify-center transition-colors duration-200">
                        {uploading ? (
                          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {uploading ? 'Uploading...' : 'Upload Files'}
                        </p>
                        <p className="text-xs text-gray-500">PDF, DOCX, TXT, Images</p>
                      </div>
                    </button>

                    <button className="w-full flex items-center gap-3 p-4 bg-gray-50 hover:bg-purple-50 rounded-xl transition-all duration-200 text-left group">
                      <div className="w-10 h-10 bg-purple-50 group-hover:bg-purple-100 rounded-lg flex items-center justify-center transition-colors duration-200">
                        <Link className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Connect Source</p>
                        <p className="text-xs text-gray-500">Link external data sources</p>
                      </div>
                    </button>

                    {/* Upload Success Indicator */}
                    {justUploaded && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-green-900">Upload successful!</p>
                            <p className="text-xs text-green-700">Your files are now available</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Recent Uploads Section */}
                    {recentFiles.length > 0 && (
                      <div className={justUploaded ? "mt-4 pt-4 border-t border-gray-200" : "mt-6 pt-6 border-t border-gray-200"}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                            Recent Uploads
                          </h4>
                          <span className="text-xs text-gray-500">{recentFiles.length}</span>
                        </div>
                        <div className="space-y-2">
                          {recentFiles.map((file) => {
                            const isImage = file.mimeType.startsWith('image/');
                            return (
                              <div
                                key={file.id}
                                className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-all"
                              >
                                {isImage ? (
                                  <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-gray-200">
                                    <img
                                      src={`/api/workflows/files/${file.id}`}
                                      alt={file.originalFileName}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23e5e7eb" width="100" height="100"/%3E%3C/svg%3E';
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-900 truncate">
                                    {file.originalFileName}
                                  </p>
                                  <p className="text-xs text-gray-500">{formatSize(file.fileSize)}</p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleDownload(file)}
                                    className="p-1 hover:bg-blue-100 rounded transition-colors"
                                    title="Download"
                                  >
                                    <Download className="w-3 h-3 text-blue-600" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(file)}
                                    className="p-1 hover:bg-red-100 rounded transition-colors"
                                    title="Delete"
                                  >
                                    <Trash className="w-3 h-3 text-red-600" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => setActivePanel('documents')}
                          className="w-full mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium py-2 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          View all files →
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Documents Panel - Shows Server Files with Selection */}
                {activePanel === 'documents' && (
                  loading ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 text-green-600 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Loading documents...</p>
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-green-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No documents yet</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Upload your first document
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Selection hint */}
                      <p className="text-xs text-gray-500 mb-3">
                        Select documents to include in AI analysis
                      </p>
                      {documents.map(file => {
                        const isSelected = selectedFileIds.has(file.id);
                        return (
                          <div
                            key={file.id}
                            className={`flex items-center gap-3 p-3 rounded-xl group transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-green-100 border-2 border-green-400'
                                : 'bg-green-50 border-2 border-transparent hover:bg-green-100'
                            }`}
                            onClick={() => onFileSelectionChange?.(file.id, !isSelected)}
                          >
                            {/* Checkbox */}
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                isSelected
                                  ? 'bg-green-500 border-green-500'
                                  : 'border-gray-300 bg-white group-hover:border-green-400'
                              }`}
                            >
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <FileText className={`w-6 h-6 flex-shrink-0 ${isSelected ? 'text-green-600' : 'text-green-500'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{file.originalFileName}</p>
                              <p className="text-xs text-gray-500">{formatSize(file.fileSize)}</p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleViewFile(file)}
                                className="p-1 hover:bg-green-200 rounded transition-colors"
                                title="View"
                              >
                                <Eye className="w-4 h-4 text-green-600" />
                              </button>
                              <button
                                onClick={() => handleDownload(file)}
                                className="p-1 hover:bg-blue-100 rounded transition-colors"
                                title="Download"
                              >
                                <Download className="w-4 h-4 text-blue-600" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(file)}
                                className="p-1 hover:bg-red-100 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash className="w-4 h-4 text-red-600" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {/* Selection summary */}
                      <div className="pt-3 mt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-600">
                          <span className="font-semibold text-green-600">{selectedFileIds.size}</span> of {documents.length} selected
                        </p>
                      </div>
                    </div>
                  )
                )}

                {/* Images Panel - Shows Server Images */}
                {activePanel === 'images' && (
                  loading ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Loading images...</p>
                    </div>
                  ) : images.length === 0 ? (
                    <div className="text-center py-8">
                      <ImageIcon className="w-12 h-12 text-purple-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No images yet</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Upload your first image
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {images.map(file => (
                        <div key={file.id} className="relative group rounded-xl overflow-hidden bg-gray-100">
                          <img
                            src={`/api/workflows/files/${file.id}`}
                            alt={file.originalFileName}
                            className="w-full h-32 object-cover"
                            onError={(e) => {
                              // Fallback to placeholder if image fails to load
                              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23e5e7eb" width="100" height="100"/%3E%3C/svg%3E';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                            <p className="text-xs text-white truncate mb-2">{file.originalFileName}</p>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleDownload(file)}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded transition-colors"
                              >
                                Download
                              </button>
                              <button
                                onClick={() => handleDeleteClick(file)}
                                className="bg-red-600 hover:bg-red-700 text-white p-1 rounded transition-colors"
                              >
                                <Trash className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* Placeholder for other panels */}
                {['code', 'templates', 'history', 'saved'].includes(activePanel!) && (
                  <div className="text-center py-12">
                    <p className="text-sm text-gray-500">Coming soon...</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={fileToDelete !== null}
        fileName={fileToDelete?.originalFileName || ''}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isDeleting={isDeleting}
      />

      {/* Document Viewer Modal */}
      <DocumentViewer
        isOpen={fileToView !== null}
        file={fileToView}
        onClose={handleCloseViewer}
        onDownload={() => fileToView && handleDownload(fileToView)}
      />
    </>
  );
}
