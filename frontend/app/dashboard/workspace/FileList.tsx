'use client';

import { File, Trash, Download } from '@mynaui/icons-react';

interface FileItem {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
}

interface FileListProps {
  files: FileItem[];
  onDelete: (id: string) => void;
}

export default function FileList({ files, onDelete }: FileListProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="px-4 flex-1 overflow-y-auto">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Saved Files</h3>
      {files.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3">
            <File className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">No files uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="bg-white rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                  <File className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">{file.uploadedAt}</span>
                  </div>
                </div>
                <button
                  onClick={() => onDelete(file.id)}
                  className="w-7 h-7 flex items-center justify-center hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
