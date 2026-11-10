'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { WorkflowFile } from '../types/file';

interface DocumentViewerProps {
  isOpen: boolean;
  file: WorkflowFile | null;
  onClose: () => void;
  onDownload?: () => void;
}

export default function DocumentViewer({ isOpen, file, onClose, onDownload }: DocumentViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (!isOpen || !file) {
      setFileUrl(null);
      setLoading(true);
      setError(null);
      setZoom(100);
      return;
    }

    loadFile();
  }, [isOpen, file]);

  const loadFile = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/workflows/files/${file.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load file');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setFileUrl(url);
    } catch (err: any) {
      console.error('Error loading file:', err);
      setError(err.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    }
  };

  // Cleanup URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

  if (!isOpen || !file) return null;

  const isPDF = file.mimeType === 'application/pdf';
  const isDOCX = file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isDOC = file.mimeType === 'application/msword';
  const isTXT = file.mimeType === 'text/plain';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <div className="flex-1 min-w-0 mr-4">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{file.originalFileName}</h3>
            <p className="text-sm text-gray-500">
              {(file.fileSize / 1024).toFixed(1)} KB • {new Date(file.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls for PDF */}
            {isPDF && !loading && !error && (
              <div className="flex items-center gap-2 mr-2">
                <button
                  onClick={handleZoomOut}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Zoom out"
                >
                  <ZoomOut className="w-5 h-5 text-gray-700" />
                </button>
                <span className="text-sm text-gray-600 min-w-[60px] text-center">{zoom}%</span>
                <button
                  onClick={handleZoomIn}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Zoom in"
                >
                  <ZoomIn className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            )}

            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors flex items-center gap-2"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-gray-100">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading document...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md p-8">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="w-8 h-8 text-red-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Failed to load document</h4>
                <p className="text-sm text-gray-600 mb-4">{error}</p>
                <button
                  onClick={loadFile}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {!loading && !error && fileUrl && (
            <div className="h-full overflow-auto p-4">
              {/* PDF Viewer */}
              {isPDF && (
                <div className="flex justify-center">
                  <iframe
                    src={fileUrl}
                    className="border-0 bg-white shadow-lg rounded-lg"
                    style={{
                      width: `${zoom}%`,
                      minWidth: '100%',
                      height: 'calc(90vh - 120px)',
                    }}
                    title={file.originalFileName}
                  />
                </div>
              )}

              {/* DOCX/DOC Viewer - Use Office Online or Google Docs Viewer */}
              {(isDOCX || isDOC) && (
                <div className="h-full bg-white rounded-lg shadow-lg p-8">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-10 h-10 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                        <path d="M14 2v6h6"/>
                        <path d="M12 18v-6"/>
                        <path d="M9 15l3 3 3-3"/>
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      Word Document Preview
                    </h4>
                    <p className="text-sm text-gray-600 mb-6">
                      Preview for Word documents is limited. Download the file for full viewing.
                    </p>
                    <div className="bg-gray-50 rounded-lg p-6 max-w-2xl mx-auto text-left">
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-medium">File:</span> {file.originalFileName}
                      </p>
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-medium">Size:</span> {(file.fileSize / 1024).toFixed(1)} KB
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Type:</span> Microsoft Word Document
                      </p>
                    </div>
                    <button
                      onClick={handleDownload}
                      className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                    >
                      <Download className="w-5 h-5" />
                      Download to View Full Document
                    </button>
                  </div>
                </div>
              )}

              {/* Text File Viewer */}
              {isTXT && (
                <div className="h-full">
                  <iframe
                    src={fileUrl}
                    className="w-full h-full border-0 bg-white rounded-lg shadow-lg p-6"
                    title={file.originalFileName}
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
