'use client';

import { Send, Microphone, Layout, FileText, Code } from '@mynaui/icons-react';
import { useState, useRef, useEffect } from 'react';
import { Message } from '../types/message';
import type { DmnIntent } from './WorkspaceView';
import { formatJsonForDisplay, looksLikeJson } from './utils/jsonDisplay';
import { notificationService } from '@/lib/notifications';

type ContentSegment =
  | { type: 'text'; content: string }
  | { type: 'code'; content: string; language?: string }
  | { type: 'rules'; rules: RuleItem[] }
  | { type: 'decisions'; decisions: DecisionItem[] };

interface RuleItem {
  id: string;
  condition: string;
  outcome: string;
  source_text?: string;
  entities_involved?: string[];
}

interface DecisionItem {
  decision_id?: string;
  name?: string;
  hit_policy?: string;
  inputs?: Array<{ name: string; type?: string }>;
  outputs?: Array<{ name: string; type?: string }>;
  rules?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

function tryParseStructuredJson(code: string): ContentSegment | null {
  try {
    const parsed = JSON.parse(code);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    // Detect rules array: objects with id + condition + outcome
    if (parsed.every((item: Record<string, unknown>) =>
      item && typeof item === 'object' && 'condition' in item && 'outcome' in item
    )) {
      return { type: 'rules', rules: parsed as RuleItem[] };
    }

    // Detect decisions array: objects with inputs + outputs (or hit_policy)
    if (parsed.every((item: Record<string, unknown>) =>
      item && typeof item === 'object' && ('inputs' in item || 'hit_policy' in item)
    )) {
      return { type: 'decisions', decisions: parsed as DecisionItem[] };
    }
  } catch { /* not valid JSON or not structured */ }
  return null;
}

function parseContentWithCodeBlocks(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: 'text', content: content.slice(lastIndex, m.index) });
    }
    const lang = (m[1] || '').toLowerCase();
    let code = (m[2] || '').replace(/^\n/, '');

    // Try to detect structured JSON (rules, decisions) for visual rendering
    const structured = tryParseStructuredJson(code);
    if (structured) {
      segments.push(structured);
    } else {
      if (lang === 'json' || looksLikeJson(code)) {
        code = formatJsonForDisplay(code);
      }
      segments.push({ type: 'code', content: code, language: lang || undefined });
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < content.length) {
    segments.push({ type: 'text', content: content.slice(lastIndex) });
  }
  return segments.length ? segments : [{ type: 'text', content }];
}

function renderTextLine(line: string, i: number) {
  if (line.startsWith('**') && line.endsWith('**')) {
    return <strong key={i} className="font-bold text-gray-900">{line.slice(2, -2)}</strong>;
  }
  return <p key={i} className="text-[15px] leading-relaxed text-gray-800">{line}</p>;
}

const RULE_COLORS = [
  { border: 'border-l-blue-500', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700', tag: 'bg-blue-50 text-blue-600 border-blue-200' },
  { border: 'border-l-purple-500', bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-700', tag: 'bg-purple-50 text-purple-600 border-purple-200' },
  { border: 'border-l-emerald-500', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700', tag: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { border: 'border-l-amber-500', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700', tag: 'bg-amber-50 text-amber-600 border-amber-200' },
  { border: 'border-l-rose-500', bg: 'bg-rose-50', badge: 'bg-rose-100 text-rose-700', tag: 'bg-rose-50 text-rose-600 border-rose-200' },
  { border: 'border-l-cyan-500', bg: 'bg-cyan-50', badge: 'bg-cyan-100 text-cyan-700', tag: 'bg-cyan-50 text-cyan-600 border-cyan-200' },
];

function RuleCards({ rules }: { rules: RuleItem[] }) {
  const [expandedSource, setExpandedSource] = useState<Set<string>>(new Set());

  const toggleSource = (id: string) => {
    setExpandedSource((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3 my-3">
      {rules.map((rule, idx) => {
        const color = RULE_COLORS[idx % RULE_COLORS.length];
        const ruleId = rule.id || `Rule ${idx + 1}`;
        return (
          <div
            key={ruleId}
            className={`border-l-4 ${color.border} rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md`}
          >
            <div className="px-4 py-3 space-y-2.5">
              {/* Header: Rule ID */}
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${color.badge}`}>
                  {ruleId}
                </span>
              </div>

              {/* Condition */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">If</span>
                <p className="text-sm text-gray-800 mt-0.5 leading-relaxed">{rule.condition}</p>
              </div>

              {/* Outcome */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Then</span>
                <p className="text-sm text-gray-800 mt-0.5 leading-relaxed">{rule.outcome}</p>
              </div>

              {/* Entities */}
              {rule.entities_involved && rule.entities_involved.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {rule.entities_involved.map((entity, eIdx) => (
                    <span
                      key={eIdx}
                      className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${color.tag}`}
                    >
                      {entity}
                    </span>
                  ))}
                </div>
              )}

              {/* Source text toggle */}
              {rule.source_text && (
                <div>
                  <button
                    type="button"
                    onClick={() => toggleSource(ruleId)}
                    className="text-[11px] text-gray-400 hover:text-gray-600 font-medium transition-colors"
                  >
                    {expandedSource.has(ruleId) ? 'Hide source' : 'Show source'}
                  </button>
                  {expandedSource.has(ruleId) && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed italic border-l-2 border-gray-200 pl-2">
                      {rule.source_text}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DecisionCards({ decisions }: { decisions: DecisionItem[] }) {
  return (
    <div className="space-y-3 my-3">
      {decisions.map((dec, idx) => {
        const color = RULE_COLORS[idx % RULE_COLORS.length];
        const name = dec.name || dec.decision_id || `Decision ${idx + 1}`;
        return (
          <div
            key={idx}
            className={`border-l-4 ${color.border} rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden`}
          >
            <div className="px-4 py-3 space-y-2.5">
              {/* Header */}
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${color.badge}`}>
                  {name}
                </span>
                {dec.hit_policy && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">
                    {dec.hit_policy}
                  </span>
                )}
              </div>

              {/* Inputs */}
              {dec.inputs && dec.inputs.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Inputs</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {dec.inputs.map((inp, iIdx) => (
                      <span key={iIdx} className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-medium">
                        {inp.name}{inp.type ? ` (${inp.type})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Outputs */}
              {dec.outputs && dec.outputs.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Outputs</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {dec.outputs.map((out, oIdx) => (
                      <span key={oIdx} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium">
                        {out.name}{out.type ? ` (${out.type})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Rules count */}
              {dec.rules && dec.rules.length > 0 && (
                <p className="text-xs text-gray-500">{dec.rules.length} rule(s) defined</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface SelectedDocument {
  id: string;
  originalFileName: string;
}

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isCodePanelOpen?: boolean;
  isFloating?: boolean;
  onActionCardClick?: (intent: DmnIntent) => void;
  isDmnRunning?: boolean;
  documentCount?: number;
  selectedDocuments?: SelectedDocument[];
  onVisualizeDmn?: (xml: string) => void;
}

const ACTION_INTENTS: DmnIntent[] = ['dmn_tables', 'summarize', 'dmn_code'];

export default function ChatInterface({
  messages,
  onSendMessage,
  isCodePanelOpen = false,
  isFloating = false,
  onActionCardClick,
  isDmnRunning = false,
  documentCount = 0,
  selectedDocuments = [],
  onVisualizeDmn,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 120); // Max 5 lines (~120px)
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      setIsTyping(true);
      setTimeout(() => setIsTyping(false), isDmnRunning ? 5000 : 2000);
    }
  };

  const handleActionCard = (index: number) => {
    // Check if documents exist but none selected
    if (onActionCardClick) {
      if (documentCount === 0) {
        // No documents uploaded
        notificationService.warning('Please upload a document (PDF, DOCX, or TXT) in the sidebar first.');
        return;
      }
      if (selectedDocuments.length === 0) {
        // Documents exist but none selected
        notificationService.warning('Please select at least one document from the sidebar to analyze.');
        return;
      }
      // Documents selected, proceed
      onActionCardClick(ACTION_INTENTS[2]);
      return;
    }
    setInput(actionCards[index].title);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const actionCards = isFloating
    ? [
      {
        icon: <Layout className="w-6 h-6 text-blue-600" />,
        title: 'Create DMN tables for claims',
      },
      {
        icon: <FileText className="w-6 h-6 text-pink-600" />,
        title: 'Analyze and summarize documents',
      },
      {
        icon: <Code className="w-6 h-6 text-blue-700" />,
        title: 'Generate DMN policy code',
      },
    ]
    : [
      {
        icon: <Layout className="w-8 h-8 text-blue-600" />,
        title: 'Create DMN tables of the insurance flows in the Guidelines for claims which helps company in the revenue boost.',
      },
      {
        icon: <FileText className="w-8 h-8 text-pink-600" />,
        title: 'Analyze the documents and help me summarize the context.',
      },
      {
        icon: <Code className="w-8 h-8 text-blue-700" />,
        title: 'Generate DMN code to update the existing bank coverage claim policy code to faster the approval process.',
      },
    ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white relative h-full">
      {/* Selected Documents Indicator */}
      {!isFloating && selectedDocuments.length > 0 && (
        <div className={`flex-shrink-0 border-b border-gray-100 bg-gray-50/50 transition-all duration-300 ${
          isCodePanelOpen ? 'pl-[120px] pr-8' : 'px-8'
        }`}>
          <div className="max-w-4xl mx-auto py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Analyzing:</span>
              {selectedDocuments.map((doc) => (
                <span
                  key={doc.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-green-200 rounded-lg text-xs font-medium text-green-700 shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5 text-green-500" />
                  <span className="max-w-[150px] truncate">{doc.originalFileName}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages Area - min-h-0 lets flex child shrink so overflow-y-auto can scroll */}
      <div className={`flex-1 min-h-0 overflow-y-auto transition-all duration-300 ${isFloating
        ? 'px-4 py-4 pb-24'
        : isCodePanelOpen
          ? 'pl-[120px] pr-8 py-8 pb-32'
          : 'px-8 py-8 pb-32'
        }`}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-5xl mx-auto">
            {!isFloating && (
              <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-4xl font-semibold bg-linear-to-r from-blue-600 via-blue-700 to-blue-800 bg-clip-text text-transparent mb-3">
                  Welcome! Make your
                </h3>
                <h3 className="text-4xl font-semibold bg-linear-to-r from-blue-600 via-blue-700 to-blue-800 bg-clip-text text-transparent mb-6">
                  decision making simple and fast.
                </h3>
                <p className="text-base text-gray-600 max-w-2xl leading-relaxed">
                  Select sources and help me curate and analyze your documents and chat with ease and rule based decisions.
                </p>
                {onActionCardClick && documentCount === 0 && (
                  <p className="text-sm text-amber-600 max-w-xl mt-2">
                    Upload a document (PDF, DOCX, or TXT) in the sidebar to use the action cards below.
                  </p>
                )}
                {onActionCardClick && documentCount > 0 && selectedDocuments.length === 0 && (
                  <p className="text-sm text-amber-600 max-w-xl mt-2">
                    Select at least one document from the sidebar to analyze.
                  </p>
                )}
              </div>
            )}

            {isFloating && (
              <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  How can I help?
                </h4>
                <p className="text-xs text-gray-600">
                  Ask me to create diagrams or explain concepts
                </p>
              </div>
            )}

            {/* Action Cards */}
            <div className={`grid gap-3 w-full ${isFloating ? 'grid-cols-1 max-w-sm' : 'grid-cols-3 gap-5 max-w-5xl'}`}>
              {actionCards.map((card, i) => (
                <button
                  key={i}
                  onClick={() => handleActionCard(i)}
                  disabled={isDmnRunning}
                  className={`bg-white hover:bg-linear-to-br hover:from-gray-50 hover:to-white border border-gray-200 hover:border-blue-300 text-left transition-all duration-300 hover:shadow-xl hover:shadow-blue-100 hover:scale-[1.02] active:scale-[0.98] group disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 ${isFloating ? 'rounded-xl p-3 flex items-center gap-3' : 'rounded-2xl p-6'
                    }`}
                >
                  <div className={`bg-linear-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center group-hover:from-blue-50 group-hover:to-blue-100 transition-all duration-300 shadow-sm ${isFloating ? 'w-10 h-10 flex-shrink-0' : 'w-14 h-14 mb-4'
                    }`}>
                    {card.icon}
                  </div>
                  <p className={`text-gray-700 leading-relaxed font-normal ${isFloating ? 'text-xs' : 'text-[15px]'
                    }`}>
                    {card.title}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map((message) => (
              <div key={message.id}>
                <div
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-5 py-4 shadow-sm border ${message.sender === 'user'
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white border-gray-200'
                      }`}
                  >
                    {message.type === 'code' ? (
                      <div className="relative group">
                        <pre className="text-sm font-mono bg-gray-900 text-green-400 p-4 rounded-xl overflow-x-auto">
                          <code>{message.content}</code>
                        </pre>
                        <button className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded hover:bg-gray-700">
                          Copy
                        </button>
                        {message.language && (
                          <span className="absolute top-2 left-2 text-xs text-gray-500 font-medium">
                            {message.language}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        {parseContentWithCodeBlocks(message.content).map((seg, segIdx) => {
                          if (seg.type === 'text') {
                            return (
                              <div key={segIdx}>
                                {seg.content.split('\n').map((line, i) => renderTextLine(line, i))}
                              </div>
                            );
                          }
                          if (seg.type === 'rules') {
                            return <RuleCards key={segIdx} rules={seg.rules} />;
                          }
                          if (seg.type === 'decisions') {
                            return <DecisionCards key={segIdx} decisions={seg.decisions} />;
                          }
                          return (
                            <div key={segIdx} className="relative group my-3">
                              <pre className="bg-gray-900 text-green-400 p-4 rounded-xl overflow-x-auto overflow-y-auto max-h-[400px] text-sm font-mono">
                                <code>{seg.content}</code>
                              </pre>
                              {seg.language && (
                                <span className="absolute top-2 left-2 text-xs text-gray-500 font-medium">
                                  {seg.language}
                                </span>
                              )}
                              <button
                                type="button"
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded hover:bg-gray-700"
                                onClick={() => navigator.clipboard.writeText(seg.content)}
                              >
                                Copy
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <span className="text-[11px] text-gray-400 mt-3 block font-medium">
                      {message.timestamp}
                    </span>
                  </div>
                </div>

                {/* Visualise the DMN button — shown below AI messages with generated DMN XML */}
                {message.sender === 'ai' && message.dmnXml && onVisualizeDmn && (
                  <div className="flex justify-start mt-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <button
                      onClick={() => onVisualizeDmn(message.dmnXml!)}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#FF643A] to-orange-500 text-white rounded-xl text-sm font-semibold hover:from-orange-600 hover:to-orange-500 transition-all duration-200 hover:shadow-lg hover:shadow-orange-200 active:scale-[0.97] flex items-center gap-2.5"
                    >
                      <Layout className="w-4.5 h-4.5" />
                      Visualise the DMN
                    </button>
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 max-w-[75%] shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs font-medium text-gray-500">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area — absolute within the chat container */}
      <div className={`absolute bottom-0 left-0 right-0 bg-linear-to-t from-white via-white/95 to-transparent pointer-events-none z-10 transition-all duration-300 ${isFloating
        ? 'px-4 py-4'
        : isCodePanelOpen
          ? 'pl-[120px] pr-8 py-6'
          : 'px-8 py-6'
        }`}>
        <div className={`${isFloating ? 'w-full' : 'max-w-4xl mx-auto'} pointer-events-auto`}>
          <div className={`flex items-end gap-3 bg-white rounded-2xl border px-5 py-3.5 transition-all duration-300 ${isFocused
            ? 'border-blue-400 shadow-[0_8px_30px_rgb(0,0,0,0.12)] scale-[1.02]'
            : 'border-gray-200 shadow-[0_4px_20px_rgb(0,0,0,0.08)] hover:shadow-[0_6px_25px_rgb(0,0,0,0.1)]'
            }`}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask AI to help with workflows, business logic, or document analysis..."
              rows={1}
              className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400 transition-all duration-200 resize-none overflow-y-auto max-h-[120px] leading-6"
              style={{ minHeight: '24px' }}
            />
            <button
              className="text-gray-400 hover:text-blue-600 transition-all duration-200 hover:scale-110 active:scale-95 mb-0.5"
              title="Voice input"
            >
              <Microphone className="w-5 h-5" />
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={`transition-all duration-200 mb-0.5 ${input.trim()
                ? 'text-blue-600 hover:text-blue-700 hover:scale-110 active:scale-95'
                : 'text-gray-300 cursor-not-allowed'
                }`}
              title="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
