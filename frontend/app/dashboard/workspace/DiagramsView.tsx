'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ChatInterface from './ChatInterface';
import { Plus, Download, Upload, X, File, Clipboard, Play } from '@mynaui/icons-react';
import TestCasesPanel from './TestCasesPanel';

// Dynamically import DmnViewer to avoid SSR issues
const DmnViewer = dynamic(() => import('./DmnViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Loading DMN viewer...</span>
      </div>
    </div>
  ),
});

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: string;
}

interface DiagramsViewProps {
  initialDmnXml?: string;
}

export default function DiagramsView({ initialDmnXml }: DiagramsViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [dmnXml, setDmnXml] = useState<string>(initialDmnXml || '');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [uploadTab, setUploadTab] = useState<'file' | 'paste'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const [isTestPanelOpen, setIsTestPanelOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load DMN XML when passed from parent (e.g. "Visualise the DMN" button)
  useEffect(() => {
    if (initialDmnXml) {
      setDmnXml(initialDmnXml);
    }
  }, [initialDmnXml]);

  const handleSendMessage = (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setMessages([...messages, userMessage]);

    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `I'll help you with your DMN diagram. "${content}"`,
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setMessages((prev) => [...prev, aiMessage]);
    }, 1500);
  };

  const handleFileUpload = useCallback((file: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setDmnXml(content);
      setShowUploadModal(false);
      setPasteContent('');
    };
    reader.readAsText(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handlePasteSubmit = () => {
    if (pasteContent.trim()) {
      setDmnXml(pasteContent.trim());
      setShowUploadModal(false);
      setPasteContent('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.dmn') || file.name.endsWith('.xml'))) {
      handleFileUpload(file);
    }
  };

  const handleExport = () => {
    if (!dmnXml) return;

    const blob = new Blob([dmnXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.dmn';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearDiagram = () => {
    setDmnXml('');
  };

  return (
    <div className="relative w-full h-full">
      {/* Main Content Area */}
      {dmnXml ? (
        // DMN Viewer
        <div className="w-full h-full bg-white">
          <DmnViewer
            xml={dmnXml}
            onError={(error) => console.error('DMN Error:', error)}
          />
        </div>
      ) : (
        // Empty State - Upload Prompt
        <div
          className={`w-full h-full flex items-center justify-center bg-gray-50 transition-colors ${isDragging ? 'bg-blue-50' : ''
            }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-center max-w-md px-6">
            <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
              <File className={`w-10 h-10 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {isDragging ? 'Drop your DMN file here' : 'No DMN Diagram Loaded'}
            </h3>
            <p className="text-gray-500 mb-6">
              Upload a DMN file or paste DMN XML to view and interact with your decision model
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload DMN
              </button>
              <button
                onClick={() => {
                  setUploadTab('paste');
                  setShowUploadModal(true);
                }}
                className="px-5 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <Clipboard className="w-4 h-4" />
                Paste XML
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg border border-gray-200 p-2 flex items-center gap-1">
        <button
          onClick={() => setShowUploadModal(true)}
          className="p-2 hover:bg-blue-50 rounded-lg transition-colors group"
          title="Import DMN"
        >
          <Upload className="w-5 h-5 text-gray-600 group-hover:text-blue-600" />
        </button>
        <button
          onClick={handleExport}
          disabled={!dmnXml}
          className={`p-2 rounded-lg transition-colors group ${dmnXml ? 'hover:bg-green-50' : 'opacity-50 cursor-not-allowed'
            }`}
          title="Export DMN"
        >
          <Download className={`w-5 h-5 ${dmnXml ? 'text-gray-600 group-hover:text-green-600' : 'text-gray-400'}`} />
        </button>
        {dmnXml && (
          <>
            <div className="w-px h-6 bg-gray-200 mx-1" />
            <button
              onClick={() => setIsTestPanelOpen(true)}
              className={`p-2 rounded-lg transition-colors group ${isTestPanelOpen ? 'bg-purple-100' : 'hover:bg-purple-50'
                }`}
              title="Test Cases"
            >
              <Play className={`w-5 h-5 ${isTestPanelOpen ? 'text-purple-600' : 'text-gray-600 group-hover:text-purple-600'}`} />
            </button>
            <div className="w-px h-6 bg-gray-200 mx-1" />
            <button
              onClick={handleClearDiagram}
              className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
              title="Clear Diagram"
            >
              <X className="w-5 h-5 text-gray-600 group-hover:text-red-600" />
            </button>
          </>
        )}
      </div>

      {/* DMN Code Viewer */}
      {dmnXml && (
        <div className={`absolute right-6 top-6 bottom-6 transition-all duration-300 ${isChatMinimized ? 'w-14' : 'w-[480px]'
          }`}>
          {isChatMinimized ? (
            <button
              onClick={() => setIsChatMinimized(false)}
              className="w-14 h-14 bg-white rounded-xl shadow-lg border border-gray-200 flex items-center justify-center hover:shadow-xl transition-all duration-200 hover:scale-105"
            >
              <File className="w-6 h-6 text-gray-600" />
            </button>
          ) : (
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 h-full flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100">
                <div className="flex items-center gap-2">
                  <File className="w-4 h-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-900">DMN Source</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(dmnXml);
                    }}
                    className="px-2 py-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors flex items-center gap-1"
                    title="Copy to clipboard"
                  >
                    <Clipboard className="w-3 h-3" />
                    Copy
                  </button>
                  <button
                    onClick={() => setIsChatMinimized(true)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <span className="text-gray-500 text-xs">−</span>
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-gray-50">
                <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap break-words">
                  <code>{dmnXml}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Import DMN Diagram</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setPasteContent('');
                }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Tab Switcher */}
            <div className="px-6 pt-4">
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setUploadTab('file')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${uploadTab === 'file'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Upload File
                </button>
                <button
                  onClick={() => setUploadTab('paste')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${uploadTab === 'paste'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Paste XML
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {uploadTab === 'file' ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".dmn,.xml"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">.dmn or .xml files</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <textarea
                    value={pasteContent}
                    onChange={(e) => setPasteContent(e.target.value)}
                    placeholder='Paste your DMN XML here...&#10;&#10;Example:&#10;<?xml version="1.0" encoding="UTF-8"?>&#10;<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" ...>'
                    className="w-full h-48 px-4 py-3 border border-gray-300 rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handlePasteSubmit}
                    disabled={!pasteContent.trim()}
                    className={`w-full py-2.5 rounded-lg font-medium transition-colors ${pasteContent.trim()
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                  >
                    Load DMN
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Test Cases Panel */}
      <TestCasesPanel
        xml={dmnXml}
        isOpen={isTestPanelOpen}
        onClose={() => setIsTestPanelOpen(false)}
      />
    </div>
  );
}
