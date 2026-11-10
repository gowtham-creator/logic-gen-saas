'use client';

import { Upload, File as FileIcon, X } from '@mynaui/icons-react';
import { Loader2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { notificationService } from '@/lib/notifications';

interface UploadDocumentsProps {
  onUpload: (files: File[]) => Promise<void>;
  maxFileSize?: number; // in MB
  allowedTypes?: string[];
  allowedExtensions?: string[];
}

export default function UploadDocuments({
  onUpload,
  maxFileSize = 10,
  allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'],
}: UploadDocumentsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = (files: FileList | File[]): { valid: File[]; invalid: string[] } => {
    const valid: File[] = [];
    const invalid: string[] = [];
    const maxBytes = maxFileSize * 1024 * 1024;

    Array.from(files).forEach(file => {
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

      // Check file size
      if (file.size > maxBytes) {
        invalid.push(`${file.name} (exceeds ${maxFileSize}MB)`);
        return;
      }

      // Check file type
      if (allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension)) {
        valid.push(file);
      } else {
        invalid.push(`${file.name} (unsupported type)`);
      }
    });

    return { valid, invalid };
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFilesAdded(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFilesAdded(files);
    }
    // Reset input
    e.target.value = '';
  };

  const handleFilesAdded = (files: File[]) => {
    const { valid, invalid } = validateFiles(files);

    if (invalid.length > 0) {
      notificationService.error(`Invalid files: ${invalid.join(', ')}`);
    }

    if (valid.length > 0) {
      setSelectedFiles(prev => [...prev, ...valid]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    try {
      await onUpload(selectedFiles);
      setSelectedFiles([]);
    } catch (error) {
      // Error handled by parent
    } finally {
      setUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="px-4 mb-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Upload Documents</h3>

      {/* Drop Zone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
        }`}
      >
        <div className="flex flex-col items-center text-center">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 ${
            isDragging ? 'bg-blue-100' : 'bg-white'
          }`}>
            {uploading ? (
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            ) : (
              <Upload className={`w-6 h-6 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`} />
            )}
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">
            {uploading ? 'Uploading...' : isDragging ? 'Drop files here' : 'Click or drag files'}
          </p>
          <p className="text-xs text-gray-500">
            PDF, DOC, DOCX, TXT up to {maxFileSize}MB
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allowedExtensions.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
      </div>

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-700">
              {selectedFiles.length} file(s) selected
            </p>
            <button
              onClick={() => setSelectedFiles([])}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
              disabled={uploading}
            >
              Clear all
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 group hover:border-gray-300 transition-all"
              >
                <FileIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
                </div>
                <button
                  onClick={() => handleRemoveFile(index)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                  disabled={uploading}
                  title="Remove file"
                >
                  <X className="w-4 h-4 text-red-600" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
            className="w-full mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading {selectedFiles.length} file(s)...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Upload {selectedFiles.length} file(s)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
