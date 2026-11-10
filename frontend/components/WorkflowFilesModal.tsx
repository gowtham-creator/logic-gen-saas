'use client';

import { useState, useEffect } from 'react';
import { X, Upload, Download, Trash2, File, Loader2, Eye } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS, ELEMENT_IDS } from '@/constants/permissions';

interface WorkflowFile {
  id: string;
  fileName: string;
  originalFileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  workflowId: string;
  workflow?: {
    id: string;
    name: string;
  };
  createdUser?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface WorkflowFilesModalProps {
  workflowIds: string[];
  onClose: () => void;
  onFileChange: () => void;
}

export default function WorkflowFilesModal({ workflowIds, onClose, onFileChange }: WorkflowFilesModalProps) {
  const { hasPermission } = usePermissions();
  const [files, setFiles] = useState<WorkflowFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(workflowIds[0] || '');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFiles();
  }, [workflowIds]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const idsParam = workflowIds.join(',');
      const data = await apiClient.get<WorkflowFile[]>(`/api/workflows/files?workflowIds=${idsParam}`);
      setFiles(data);
    } catch (error: any) {
      console.error('Failed to load files:', error);
      setError('Failed to load files');
      notificationService.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file types - only PDF, DOC, and DOCX
    const allowedTypes = [
      'application/pdf',
      'application/msword', // DOC
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    ];
    const allowedExtensions = ['.pdf', '.doc', '.docx'];

    const invalidFiles: string[] = [];
    const validFiles: File[] = [];

    files.forEach(file => {
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      setError(`Invalid file type(s): ${invalidFiles.join(', ')}. Only PDF, DOC, and DOCX files are allowed.`);
    } else {
      setError(null);
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
    // Reset input to allow selecting the same files again
    e.target.value = '';
  };

  const handleSubmitUpload = async () => {
    if (selectedFiles.length === 0 || !selectedWorkflowId) {
      setError('Please select at least one file and workflow');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });
      
      // Debug: Verify FormData contents
      console.log('File upload details:', {
        fileCount: selectedFiles.length,
        fileNames: selectedFiles.map(f => f.name),
        totalSize: selectedFiles.reduce((sum, f) => sum + f.size, 0),
        workflowId: selectedWorkflowId,
      });
      
      // Don't set Content-Type header - let apiClient handle it automatically
      // This ensures the browser sets the correct boundary for multipart/form-data
      const response = await apiClient.post(`/api/workflows/${selectedWorkflowId}/files`, formData);

      const result = response as any;
      const uploadedCount = result.uploaded?.length || selectedFiles.length;
      const errorCount = result.errors?.length || 0;
      
      if (errorCount > 0) {
        notificationService.warning(`Uploaded ${uploadedCount} file(s), ${errorCount} failed`);
      } else {
        notificationService.success(`Successfully uploaded ${uploadedCount} file(s)`);
      }
      
      setSelectedFiles([]); // Clear selected files after upload
      loadFiles();
      onFileChange();
    } catch (error: any) {
      console.error('Failed to upload files:', error);
      setError(error.message || 'Failed to upload files');
      notificationService.error(error.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedFiles([]);
    setError(null);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
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

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      await apiClient.delete(`/api/workflows/files/${fileId}`);
      notificationService.success('File deleted successfully');
      loadFiles();
      onFileChange();
    } catch (error: any) {
      console.error('Failed to delete file:', error);
      notificationService.error(error.message || 'Failed to delete file');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filesByWorkflow = files.reduce((acc, file) => {
    const workflowId = file.workflowId;
    if (!acc[workflowId]) {
      acc[workflowId] = [];
    }
    acc[workflowId].push(file);
    return acc;
  }, {} as Record<string, WorkflowFile[]>);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Workflow Files</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {workflowIds.length > 1 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Workflow to Upload File
              </label>
              <select
                value={selectedWorkflowId}
                onChange={(e) => setSelectedWorkflowId(e.target.value)}
                className="input-field"
              >
                {workflowIds.map((id) => {
                  const workflowFiles = files.find(f => f.workflowId === id);
                  const workflowName = workflowFiles?.workflow?.name || `Workflow ${id.substring(0, 8)}`;
                  return (
                    <option key={id} value={id}>
                      {workflowName}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {hasPermission(PERMISSION_RESOURCES.WORKFLOW, PERMISSION_ACTIONS.CREATE, ELEMENT_IDS.BTN_UPLOAD_WORKFLOW_FILE) && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload File
              </label>
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <File className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 mb-1">File Type Restrictions</p>
                    <p className="text-xs text-blue-800">
                      Only PDF, DOC, and DOCX files are allowed. Maximum file size: 50MB per file. Maximum 10 files per upload.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <label className="btn-primary flex items-center space-x-2 cursor-pointer">
                    <Upload className="h-4 w-4" />
                    <span>Choose File</span>
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    disabled={uploading || !selectedWorkflowId}
                    className="hidden"
                    multiple
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  />
                </label>
                {selectedFiles.length > 0 && (
                  <button
                    onClick={handleClearSelection}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                    disabled={uploading}
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <File className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                              <p className="text-xs text-gray-500">
                                {(file.size / 1024).toFixed(2)} KB
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveFile(index)}
                            className="ml-2 p-1 text-red-600 hover:text-red-800"
                            disabled={uploading}
                            aria-label="Remove file"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200 flex justify-end">
                      <button
                        onClick={handleSubmitUpload}
                        disabled={uploading || !selectedWorkflowId}
                        className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Uploading {selectedFiles.length} file(s)...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4" />
                            <span>Upload {selectedFiles.length} file(s)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-600" />
              <p className="mt-2 text-gray-600">Loading files...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <File className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No files</h3>
              <p className="mt-2 text-sm text-gray-600">Upload files to get started.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(filesByWorkflow).map(([workflowId, workflowFiles]) => (
                <div key={workflowId} className="border border-gray-200 rounded-lg overflow-hidden">
                  {workflowIds.length > 1 && (
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <h3 className="font-medium text-gray-900">
                        {workflowFiles[0]?.workflow?.name || `Workflow ${workflowId.substring(0, 8)}`}
                      </h3>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="table-header">File Name</th>
                          <th className="table-header">Size</th>
                          <th className="table-header">Type</th>
                          <th className="table-header">Uploaded</th>
                          <th className="table-header text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {workflowFiles.map((file) => (
                          <tr key={file.id} className="hover:bg-gray-50">
                            <td className="table-cell">
                              <div className="flex items-center space-x-2">
                                <File className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">
                                  {file.originalFileName}
                                </span>
                              </div>
                            </td>
                            <td className="table-cell text-sm text-gray-600">
                              {formatFileSize(file.fileSize)}
                            </td>
                            <td className="table-cell text-sm text-gray-600">
                              {file.mimeType}
                            </td>
                            <td className="table-cell text-sm text-gray-600">
                              {formatDate(file.createdAt)}
                            </td>
                            <td className="table-cell text-right">
                              <div className="flex justify-end space-x-2">
                                {hasPermission(PERMISSION_RESOURCES.WORKFLOW, PERMISSION_ACTIONS.READ, ELEMENT_IDS.BTN_DOWNLOAD_WORKFLOW_FILE) && (
                                  <button
                                    onClick={() => handleDownload(file)}
                                    className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 flex items-center space-x-1"
                                    aria-label="Download file"
                                  >
                                    <Download className="h-3 w-3" />
                                    <span>Download</span>
                                  </button>
                                )}
                                {hasPermission(PERMISSION_RESOURCES.WORKFLOW, PERMISSION_ACTIONS.DELETE, ELEMENT_IDS.BTN_DELETE_WORKFLOW_FILE) && (
                                  <button
                                    onClick={() => handleDelete(file.id)}
                                    className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 flex items-center space-x-1"
                                    aria-label="Delete file"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    <span>Delete</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

