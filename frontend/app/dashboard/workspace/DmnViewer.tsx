'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { ensureDmndi } from './utils/dmndiGenerator';

interface DmnViewerProps {
  xml: string;
  onError?: (error: Error) => void;
}

// Official @kie-tools/dmn-editor-standalone API
// The UMD bundle exports as window.DMNEditor (all caps DMN)
declare global {
  interface Window {
    DMNEditor?: {
      open: (options: {
        container: HTMLElement;
        initialContent: Promise<string>;
        initialFileNormalizedPosixPathRelativeToTheWorkspaceRoot: string;
        readOnly?: boolean;
        origin?: string;
        onError?: () => void;
        resources?: Map<string, { contentType: string; content: Promise<string> }>;
      }) => {
        close: () => void;
        getContent: () => Promise<string>;
        setContent: (path: string, content: string) => Promise<void>;
        getPreview: () => Promise<string>;
        subscribeToContentChanges: (cb: (isDirty: boolean) => void) => (isDirty: boolean) => void;
        unsubscribeToContentChanges: (cb: (isDirty: boolean) => void) => void;
        markAsSaved: () => void;
        undo: () => void;
        redo: () => void;
        envelopeApi: unknown;
      };
    };
  }
}

export default function DmnViewerComponent({ xml, onError }: DmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<NonNullable<typeof window.DMNEditor>['open']> | null>(null);
  const currentXmlRef = useRef<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Preprocess: inject DMNDI layout if missing so KIE renders a proper DRD
  const processedXml = useMemo(() => ensureDmndi(xml), [xml]);

  // Load the KIE DMN Editor script
  useEffect(() => {
    if (window.DMNEditor) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = '/kie-dmn-editor/index.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      setError('Failed to load DMN Editor script');
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Initialize or update editor
  useEffect(() => {
    if (!scriptLoaded || !processedXml || !containerRef.current || !window.DMNEditor) return;

    // If editor already exists and XML changed, use setContent instead of recreating
    if (editorRef.current && currentXmlRef.current !== processedXml) {
      currentXmlRef.current = processedXml;
      editorRef.current.setContent('model.dmn', processedXml).catch((err) => {
        console.error('Failed to setContent, reinitializing editor:', err);
        editorRef.current?.close();
        editorRef.current = null;
        initEditor();
      });
      return;
    }

    // Don't reinitialize if editor exists with same content
    if (editorRef.current) return;

    function initEditor() {
      try {
        setIsLoading(true);
        setError(null);

        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        currentXmlRef.current = processedXml;

        const editor = window.DMNEditor!.open({
          container: containerRef.current!,
          initialContent: Promise.resolve(processedXml),
          initialFileNormalizedPosixPathRelativeToTheWorkspaceRoot: 'model.dmn',
          readOnly: false,
          origin: window.location.origin,
        });

        editorRef.current = editor;
        setIsLoading(false);
      } catch (err: any) {
        console.error('Error loading DMN Editor:', err);
        setError(err.message || 'Failed to load DMN diagram');
        setIsLoading(false);
        onError?.(err);
      }
    }

    initEditor();

    return () => {
      if (editorRef.current) {
        editorRef.current.close();
        editorRef.current = null;
        currentXmlRef.current = '';
      }
    };
  }, [scriptLoaded, processedXml, onError]);

  return (
    <div className="w-full h-full flex flex-col">
      {isLoading && (
        <div className="flex-1 flex items-center justify-center bg-white">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Loading DMN diagram...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center bg-white">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <span className="text-sm text-red-600 font-medium">Failed to load DMN</span>
            <span className="text-xs text-gray-500 max-w-sm">{error}</span>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className={`flex-1 bg-white ${isLoading || error ? 'hidden' : ''}`}
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}
