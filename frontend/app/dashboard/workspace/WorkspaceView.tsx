'use client';

import { useState, useEffect, useCallback } from 'react';
import WorkspaceTopNav from './WorkspaceTopNav';
import WorkspaceSidebar from './WorkspaceSidebar';
import ChatInterface from './ChatInterface';
import CanvasContainer from './CanvasContainer';
import DiagramsView from './DiagramsView';
import CodePanel from './CodePanel';
import { Message } from '../types/message';
import { WorkflowFile } from '../types/file';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { formatJsonForDisplay } from './utils/jsonDisplay';

type Tab = 'chat' | 'diagrams' | 'code';
export type DmnIntent = 'summarize' | 'dmn_tables' | 'dmn_code';

// Helper function to process DMN XML - handles JSON-escaped strings
function processDmnXml(xml: string | null | undefined): string | null {
  if (!xml) return null;

  let processed = xml.trim();

  // Remove surrounding quotes if present (e.g. when API returns a JSON-escaped string)
  if ((processed.startsWith('"') && processed.endsWith('"')) ||
    (processed.startsWith("'") && processed.endsWith("'"))) {
    processed = processed.slice(1, -1);
  }

  // Replace escape sequences with actual characters
  processed = processed
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');

  return processed;
}

interface WorkspaceViewProps {
  workspaceId: string;
  workspaceName: string;
  onBack: () => void;
}

const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export default function WorkspaceView({ workspaceId, workspaceName, onBack }: WorkspaceViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isCodePanelOpen, setIsCodePanelOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [workflowFiles, setWorkflowFiles] = useState<WorkflowFile[]>([]);
  const [isDmnRunning, setIsDmnRunning] = useState(false);
  const [dmnResultXml, setDmnResultXml] = useState<string | null>(null);
  const [diagramDmnXml, setDiagramDmnXml] = useState<string | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  const documents = workflowFiles.filter((f) => DOCUMENT_MIME_TYPES.includes(f.mimeType));
  const selectedDocuments = documents.filter((d) => selectedFileIds.has(d.id));

  // Auto-select first document ONLY on initial load (not when user manually deselects all)
  useEffect(() => {
    if (!hasAutoSelected && documents.length > 0 && selectedFileIds.size === 0) {
      setSelectedFileIds(new Set([documents[0].id]));
      setHasAutoSelected(true);
    }
  }, [documents, selectedFileIds.size, hasAutoSelected]);

  const handleFileSelectionChange = useCallback((fileId: string, selected: boolean) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(fileId);
      } else {
        next.delete(fileId);
      }
      return next;
    });
  }, []);

  const loadWorkflowFiles = useCallback(async () => {
    try {
      const files = await apiClient.get<WorkflowFile[]>(`/api/workflows/files?workflowIds=${workspaceId}`);
      setWorkflowFiles(files);
    } catch (e) {
      console.error('Failed to load workflow files', e);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) loadWorkflowFiles();
  }, [workspaceId, loadWorkflowFiles]);

  // Load messages from localStorage when workspace opens
  useEffect(() => {
    const saved = localStorage.getItem(`workflow-chat-${workspaceId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(parsed);
      } catch (e) {
        console.error("Failed to load chat history");
      }
    }
  }, [workspaceId]);

  // Persist messages to localStorage when they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`workflow-chat-${workspaceId}`, JSON.stringify(messages));
    }
  }, [workspaceId, messages]);

  // When switching TO the "code" tab → open the panel with a smooth delay
  useEffect(() => {
    if (activeTab === 'code') {
      const timer = setTimeout(() => {
        setIsCodePanelOpen(true);
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // When switching AWAY from the "code" tab → close the panel smoothly
  useEffect(() => {
    if (activeTab !== 'code' && isCodePanelOpen) {
      const timer = setTimeout(() => {
        setIsCodePanelOpen(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [activeTab, isCodePanelOpen]);

  const handleVisualizeDmn = useCallback((xml: string) => {
    // XML from message.dmnXml is already processed, use as-is
    setDiagramDmnXml(xml);
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveTab('diagrams');
      setIsTransitioning(false);
    }, 150);
  }, []);

  const handleTabChange = (tab: Tab) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveTab(tab);
      setIsTransitioning(false);
    }, 150);
  };

  const handleSendMessage = (content: string, type: 'text' | 'code' = 'text', language?: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      sender: 'user',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      type,
      language,
    };

    setMessages((prev) => [...prev, userMessage]);

    // Free-text: short placeholder (use action cards for real DMN/summary)
    const placeholderAi: Message = {
      id: (Date.now() + 1).toString(),
      content: `Got it: "${content.slice(0, 80)}${content.length > 80 ? '…' : ''}"\n\nUse the action cards above to **Analyze & summarize**, **Create DMN tables**, or **Generate DMN code** from a document.`,
      sender: 'ai',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      type: 'text',
    };
    setTimeout(() => setMessages((prev) => [...prev, placeholderAi]), 800);
  };

  /** Result shape from DMN pipeline (aligned with dmn_agent_pipeline API). */
  const formatDmnResult = (result: {
    extract_rules?: {
      rules: unknown[];
      entities: unknown[];
      relationships?: unknown[];
      rule_count: number;
      entity_count: number;
    };
    build_tables?: {
      decisions: unknown[];
      glossary: Record<string, unknown>;
      drg_nodes?: unknown[];
      drg_edges?: unknown[];
      bkms?: unknown[];
      item_definitions?: unknown[];
      input_data?: unknown[];
      decision_count: number;
    };
    generate_dmn?: { dmn_xml: string; validation_report?: unknown };
    validate_dmn?: { is_valid: boolean; technical_validation?: unknown; execution_test?: unknown; refinement_count?: number };
    dmn_xml?: string;
    errors?: string[];
    message?: string;
    [key: string]: unknown;
  }): string => {
    const errors = result.errors?.length ? `\n\nErrors: ${result.errors.join(', ')}` : '';
    if (result.extract_rules) {
      const { rules, entities, rule_count, entity_count } = result.extract_rules;
      let text = `**Summary**\n- ${rule_count} rule(s), ${entity_count} entity(ies).\n`;
      if (entities?.length) text += `- Entities: ${(entities as string[]).slice(0, 10).join(', ')}${entities.length > 10 ? '…' : ''}\n`;
      if (rules?.length) text += `\nSample rules:\n\`\`\`json\n${formatJsonForDisplay(rules.slice(0, 3))}\n\`\`\``;
      return text + errors;
    }
    if (result.build_tables) {
      const { decisions, decision_count } = result.build_tables;
      let text = `**Decision tables** (${decision_count} decision(s)).\n`;
      if (decisions?.length) text += `\n\`\`\`json\n${formatJsonForDisplay(decisions.slice(0, 2))}\n\`\`\``;
      return text + errors;
    }
    if (result.dmn_xml) {
      return `**DMN generated.**\n\n\`\`\`xml\n${result.dmn_xml.slice(0, 2000)}${result.dmn_xml.length > 2000 ? '\n…' : ''}\n\`\`\`` + errors;
    }
    if (typeof (result as Record<string, unknown>).message === 'string') {
      return (result as Record<string, unknown>).message as string + errors;
    }
    // Unknown result shape: show pretty-printed JSON for display
    return `**Result**\n\n\`\`\`json\n${formatJsonForDisplay(result)}\n\`\`\`` + errors;
  };

  const handleActionCardClick = async (intent: DmnIntent) => {
    if (selectedDocuments.length === 0) {
      notificationService.error('Select at least one document from the sidebar to process.');
      return;
    }
    // Use first selected document for API (backend currently supports single file)
    const fileId = selectedDocuments[0].id;
    const fileNames = selectedDocuments.map((d) => d.originalFileName).join(', ');
    const intentLabels: Record<DmnIntent, string> = {
      summarize: 'Analyze and summarize documents',
      dmn_tables: 'Create DMN tables for claims',
      dmn_code: 'Generate DMN code for policy',
    };

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: intentLabels[intent],
      sender: 'user',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      type: 'text',
    };
    const processingId = `ai-${Date.now()}`;
    const processingMessage: Message = {
      id: processingId,
      content: 'Processing your document…',
      sender: 'ai',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      type: 'text',
    };

    setMessages((prev) => [...prev, userMessage, processingMessage]);
    setIsDmnRunning(true);
    setDmnResultXml(null);

    try {
      const runRes = await apiClient.post<{ jobId: string }>('/api/dmn/run', {
        fileId,
        intent,
        dmnName: workspaceName,
      });
      const jobId = runRes.jobId;

      const pollInterval = 2500;
      const maxAttempts = 300;
      let attempts = 0;

      const poll = async (): Promise<void> => {
        if (attempts >= maxAttempts) {
          setMessages((prev) => prev.map((m) => (m.id === processingId ? { ...m, content: 'Request timed out.' } : m)));
          setIsDmnRunning(false);
          return;
        }
        attempts += 1;
        try {
          const progressRes = await apiClient.get<{ status: string; progress: number; current_stage?: string }>(`/api/dmn/jobs/${jobId}/progress`);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === processingId
                ? { ...m, content: `Processing… ${progressRes.progress}%${progressRes.current_stage ? ` (${progressRes.current_stage})` : ''}` }
                : m
            )
          );

          if (progressRes.status === 'completed') {
            const resultRes = await apiClient.get<{ result: Record<string, unknown>; dmn_xml?: string }>(`/api/dmn/jobs/${jobId}/result`);
            const result = resultRes.result || resultRes;
            const content = formatDmnResult(result as Parameters<typeof formatDmnResult>[0]);

            // Extract DMN XML — try all known locations in the response
            let extractedXml: string | undefined;
            const generateDmn = result.generate_dmn;
            if (typeof generateDmn === 'object' && generateDmn) {
              extractedXml = (generateDmn as Record<string, unknown>).dmn_xml as string;
            } else if (typeof generateDmn === 'string') {
              // generate_dmn might itself be the XML string
              extractedXml = generateDmn;
            }
            if (!extractedXml) {
              extractedXml = result.dmn_xml as string;
            }
            // Also check top-level resultRes.dmn_xml
            if (!extractedXml) {
              extractedXml = (resultRes as Record<string, unknown>).dmn_xml as string;
            }

            console.log('[DMN] Result keys:', Object.keys(result));
            console.log('[DMN] generate_dmn type:', typeof generateDmn);
            console.log('[DMN] Extracted XML length:', extractedXml?.length ?? 0);
            console.log('[DMN] XML starts with:', extractedXml?.substring(0, 100));

            const processedXml = processDmnXml(extractedXml);
            setMessages((prev) => prev.map((m) => (m.id === processingId ? { ...m, content, dmnXml: processedXml || undefined } : m)));
            if (processedXml) setDmnResultXml(processedXml);
            setIsDmnRunning(false);
            return;
          }
          if (progressRes.status === 'failed') {
            setMessages((prev) => prev.map((m) => (m.id === processingId ? { ...m, content: 'Pipeline failed. Try again or check the document.' } : m)));
            setIsDmnRunning(false);
            return;
          }
          setTimeout(poll, pollInterval);
        } catch (e) {
          setMessages((prev) => prev.map((m) => (m.id === processingId ? { ...m, content: `Error: ${e instanceof Error ? e.message : 'Failed to get progress'}` } : m)));
          setIsDmnRunning(false);
        }
      };

      setTimeout(poll, pollInterval);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Failed to start pipeline';
      notificationService.error(errMsg);
      setMessages((prev) => prev.map((m) => (m.id === processingId ? { ...m, content: `Error: ${errMsg}` } : m)));
      setIsDmnRunning(false);
    }
  };

  const renderCanvasContent = () => {
    // For code tab, show chat interface (code panel slides in separately)
    if (activeTab === 'code') {
      return (
        <div className={`h-full transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            isCodePanelOpen={isCodePanelOpen}
            onActionCardClick={handleActionCardClick}
            isDmnRunning={isDmnRunning}
            documentCount={documents.length}
            selectedDocuments={selectedDocuments}
            onVisualizeDmn={handleVisualizeDmn}
          />
        </div>
      );
    }

    // For other tabs, render the appropriate content
    switch (activeTab) {
      case 'chat':
        return (
          <div className={`h-full transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              isCodePanelOpen={false}
              onActionCardClick={handleActionCardClick}
              isDmnRunning={isDmnRunning}
              documentCount={documents.length}
              selectedDocuments={selectedDocuments}
              onVisualizeDmn={handleVisualizeDmn}
            />
          </div>
        );
      case 'diagrams':
        return null; // Diagrams view is rendered separately, not in CanvasContainer
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white animate-in fade-in slide-in-from-right-4 duration-300">
      <WorkspaceTopNav
        workspaceName={workspaceName}
        workspaceId={workspaceId}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onBack={onBack}
        onClearChat={() => {
          setMessages([]);
          localStorage.removeItem(`workflow-chat-${workspaceId}`);
        }}
      />
      <div className="flex-1 overflow-hidden relative">
        <WorkspaceSidebar
          workspaceId={workspaceId}
          onFilesChange={loadWorkflowFiles}
          selectedFileIds={selectedFileIds}
          onFileSelectionChange={handleFileSelectionChange}
        />

        {/* Diagrams tab renders separately with its own canvas */}
        {activeTab === 'diagrams' ? (
          <div className={`h-full w-full transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
            <DiagramsView initialDmnXml={diagramDmnXml || undefined} />
          </div>
        ) : (
          /* Canvas Container for chat and code tabs */
          <div className={`h-full transition-all duration-300 ${isCodePanelOpen ? 'w-3/5' : 'w-full'
            }`}>
            <CanvasContainer>
              {renderCanvasContent()}
            </CanvasContainer>
          </div>
        )}

        {/* Code Panel - slides in from right when code tab is active */}
        <CodePanel
          isOpen={isCodePanelOpen}
          onClose={() => setActiveTab('chat')}
          dmnXml={dmnResultXml}
        />
      </div>
    </div>
  );
}
