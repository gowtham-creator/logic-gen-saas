'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Play, Trash, Check, InfoCircle } from '@mynaui/icons-react';
import {
  parseDmnXml,
  evaluateTestCase,
  DecisionTable,
  ParsedDmn,
  TestResult,
} from './utils/dmnParser';

interface TestCase {
  id: string;
  name: string;
  inputs: Record<string, string>;
  result: TestResult | null;
  status: 'pending' | 'passed' | 'failed' | 'no-match';
}

interface TestCasesPanelProps {
  xml: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function TestCasesPanel({ xml, isOpen, onClose }: TestCasesPanelProps) {
  const [parsedDmn, setParsedDmn] = useState<ParsedDmn | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<DecisionTable | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [expandedTestCase, setExpandedTestCase] = useState<string | null>(null);

  // Parse DMN when XML changes
  useEffect(() => {
    if (xml) {
      const parsed = parseDmnXml(xml);
      setParsedDmn(parsed);
      if (parsed && parsed.decisions.length > 0) {
        setSelectedDecision(parsed.decisions[0]);
      }
    }
  }, [xml]);

  const createNewTestCase = () => {
    if (!selectedDecision) return;

    const newTestCase: TestCase = {
      id: `tc-${Date.now()}`,
      name: `Test Case ${testCases.length + 1}`,
      inputs: {},
      result: null,
      status: 'pending',
    };

    // Initialize inputs with empty values
    selectedDecision.inputs.forEach((input) => {
      newTestCase.inputs[input.name || input.label] = '';
    });

    setTestCases([...testCases, newTestCase]);
    setExpandedTestCase(newTestCase.id);
  };

  const updateTestCaseInput = (testCaseId: string, inputName: string, value: string) => {
    setTestCases((prev) =>
      prev.map((tc) =>
        tc.id === testCaseId
          ? { ...tc, inputs: { ...tc.inputs, [inputName]: value }, status: 'pending', result: null }
          : tc
      )
    );
  };

  const updateTestCaseName = (testCaseId: string, name: string) => {
    setTestCases((prev) =>
      prev.map((tc) => (tc.id === testCaseId ? { ...tc, name } : tc))
    );
  };

  const runTestCase = (testCaseId: string) => {
    if (!selectedDecision) return;

    setTestCases((prev) =>
      prev.map((tc) => {
        if (tc.id !== testCaseId) return tc;

        // Convert string inputs to appropriate types
        const typedInputs: Record<string, any> = {};
        selectedDecision.inputs.forEach((input) => {
          const key = input.name || input.label;
          const value = tc.inputs[key];

          if (input.typeRef === 'number') {
            typedInputs[key] = value === '' ? null : parseFloat(value);
          } else if (input.typeRef === 'boolean') {
            typedInputs[key] = value === 'true';
          } else {
            typedInputs[key] = value;
          }
        });

        const result = evaluateTestCase(selectedDecision, typedInputs);

        return {
          ...tc,
          result,
          status: result?.matched ? 'passed' : 'no-match',
        };
      })
    );
  };

  const runAllTestCases = () => {
    testCases.forEach((tc) => runTestCase(tc.id));
  };

  const deleteTestCase = (testCaseId: string) => {
    setTestCases((prev) => prev.filter((tc) => tc.id !== testCaseId));
    if (expandedTestCase === testCaseId) {
      setExpandedTestCase(null);
    }
  };

  const getStatusIcon = (status: TestCase['status']) => {
    switch (status) {
      case 'passed':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <X className="w-4 h-4 text-red-500" />;
      case 'no-match':
        return <InfoCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusLabel = (status: TestCase['status']) => {
    switch (status) {
      case 'passed':
        return 'Rule Matched';
      case 'failed':
        return 'Failed';
      case 'no-match':
        return 'No Rule Match';
      default:
        return 'Not Run';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-2xl border-l border-gray-200 z-40 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Test Cases</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Validate your decision table with test inputs
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/80 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Decision Selector */}
      {parsedDmn && parsedDmn.decisions.length > 1 && (
        <div className="px-6 py-3 border-b border-gray-100">
          <label className="text-xs font-medium text-gray-500 block mb-1.5">
            Select Decision Table
          </label>
          <select
            value={selectedDecision?.id || ''}
            onChange={(e) => {
              const decision = parsedDmn.decisions.find((d) => d.id === e.target.value);
              setSelectedDecision(decision || null);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {parsedDmn.decisions.map((decision) => (
              <option key={decision.id} value={decision.id}>
                {decision.name || decision.id}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Actions Bar */}
      <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
        <button
          onClick={createNewTestCase}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Test Case
        </button>
        {testCases.length > 0 && (
          <button
            onClick={runAllTestCases}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <Play className="w-4 h-4" />
            Run All
          </button>
        )}
      </div>

      {/* Test Cases List */}
      <div className="flex-1 overflow-y-auto">
        {testCases.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <Play className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">No Test Cases</h3>
            <p className="text-xs text-gray-500 mb-4">
              Create test cases to validate your decision table logic
            </p>
            <button
              onClick={createNewTestCase}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Test Case
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {testCases.map((testCase) => (
              <div key={testCase.id} className="bg-white">
                {/* Test Case Header */}
                <div
                  onClick={() =>
                    setExpandedTestCase(expandedTestCase === testCase.id ? null : testCase.id)
                  }
                  className="px-6 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(testCase.status)}
                    <input
                      type="text"
                      value={testCase.name}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateTestCaseName(testCase.id, e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        testCase.status === 'passed'
                          ? 'bg-green-100 text-green-700'
                          : testCase.status === 'no-match'
                          ? 'bg-yellow-100 text-yellow-700'
                          : testCase.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {getStatusLabel(testCase.status)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        runTestCase(testCase.id);
                      }}
                      className="p-1.5 hover:bg-green-100 rounded-lg transition-colors"
                      title="Run Test"
                    >
                      <Play className="w-4 h-4 text-green-600" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTestCase(testCase.id);
                      }}
                      className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Test Case Details (Expanded) */}
                {expandedTestCase === testCase.id && selectedDecision && (
                  <div className="px-6 pb-4 space-y-4">
                    {/* Input Fields */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Inputs
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedDecision.inputs.map((input) => (
                          <div key={input.id}>
                            <label className="text-xs font-medium text-gray-600 block mb-1">
                              {input.label || input.name}
                              <span className="text-gray-400 ml-1">({input.typeRef})</span>
                            </label>
                            <input
                              type={input.typeRef === 'number' ? 'number' : 'text'}
                              value={testCase.inputs[input.name || input.label] || ''}
                              onChange={(e) =>
                                updateTestCaseInput(
                                  testCase.id,
                                  input.name || input.label,
                                  e.target.value
                                )
                              }
                              placeholder={`Enter ${input.label || input.name}`}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Results */}
                    {testCase.result && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Output
                        </h4>
                        {testCase.result.matched ? (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Check className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-green-800">
                                Rule Matched: {testCase.result.ruleId}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              {selectedDecision.outputs.map((output) => {
                                const value =
                                  testCase.result?.outputs[output.name || output.label];
                                return (
                                  <div
                                    key={output.id}
                                    className="bg-white rounded-lg px-3 py-2 border border-green-200"
                                  >
                                    <span className="text-xs text-gray-500 block">
                                      {output.label || output.name}
                                    </span>
                                    <span className="text-sm font-medium text-gray-900">
                                      {value === null || value === undefined
                                        ? '—'
                                        : String(value)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div className="flex items-center gap-2">
                              <InfoCircle className="w-4 h-4 text-yellow-600" />
                              <span className="text-sm font-medium text-yellow-800">
                                No matching rule found for these inputs
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {testCases.length > 0 && (
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              {testCases.length} test case{testCases.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-green-600">
                <Check className="w-3 h-3" />
                {testCases.filter((tc) => tc.status === 'passed').length} passed
              </span>
              <span className="flex items-center gap-1 text-yellow-600">
                <InfoCircle className="w-3 h-3" />
                {testCases.filter((tc) => tc.status === 'no-match').length} no match
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
