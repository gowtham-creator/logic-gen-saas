'use client';

import { useState, useEffect } from 'react';
import { Download, Copy, Edit, X } from '@mynaui/icons-react';

interface CodePanelProps {
  isOpen: boolean;
  onClose: () => void;
  dmnXml?: string | null;
}

export default function CodePanel({ isOpen, onClose, dmnXml }: CodePanelProps) {
  const [activeLanguage, setActiveLanguage] = useState<string>('Java');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (dmnXml) setActiveLanguage('DMN XML');
  }, [dmnXml]);

  const languages = ['Java', 'Python', 'FEELS', 'DMN XML'];

  const codeExamples: Record<string, string> = {
    'Java': `import org.kie.dmn.api.core.DMNContext;
import org.kie.dmn.api.core.DMNDecisionResult;
import org.kie.dmn.api.core.DMNRuntime;
import org.kie.dmn.core.internal.utils.DMNRuntimeBuilder;

public class InsuranceClaimDecision {

    public static void main(String[] args) {
        // Initialize DMN Runtime
        DMNRuntime dmnRuntime = DMNRuntimeBuilder.fromClasspathResource(
            "insurance-claim-policy.dmn",
            InsuranceClaimDecision.class
        );

        // Create DMN Context with input data
        DMNContext context = dmnRuntime.newContext();
        context.set("yearsInBusiness", 5);
        context.set("bankruptcies", 0);
        context.set("yearsAtCurrentAddress", 3);
        context.set("coverageType", "Comprehensive");
        context.set("claimAmount", 15000.00);

        // Execute decision
        DMNDecisionResult result = dmnRuntime.evaluateDecisionByName(
            "ClaimEligibility",
            context
        );

        // Get decision result
        String eligibilityStatus = (String) result.getResult();
        System.out.println("Claim Status: " + eligibilityStatus);

        // Get decision metadata
        if (result.hasErrors()) {
            result.getMessages().forEach(System.out::println);
        }
    }
}`,
    'Python': `from pydmn import DMNEngine
from decimal import Decimal

class InsuranceClaimProcessor:

    def __init__(self, dmn_file_path):
        """Initialize DMN engine with decision model"""
        self.engine = DMNEngine(dmn_file_path)

    def evaluate_claim_eligibility(self, claim_data):
        """
        Evaluate insurance claim eligibility using DMN rules

        Args:
            claim_data: Dictionary containing claim information

        Returns:
            Decision result with eligibility status
        """
        # Prepare input context
        context = {
            'yearsInBusiness': claim_data.get('years_in_business'),
            'bankruptcies': claim_data.get('bankruptcies'),
            'yearsAtCurrentAddress': claim_data.get('years_at_address'),
            'coverageType': claim_data.get('coverage_type'),
            'claimAmount': Decimal(claim_data.get('claim_amount'))
        }

        # Execute DMN decision
        result = self.engine.evaluate(
            decision_name='ClaimEligibility',
            context=context
        )

        return {
            'status': result.value,
            'decision_id': result.decision_id,
            'executed_at': result.timestamp
        }

# Example usage
processor = InsuranceClaimProcessor('insurance-claim-policy.dmn')

claim = {
    'years_in_business': 5,
    'bankruptcies': 0,
    'years_at_address': 3,
    'coverage_type': 'Comprehensive',
    'claim_amount': 15000.00
}

decision = processor.evaluate_claim_eligibility(claim)
print(f"Claim Status: {decision['status']}")`,
    'FEELS': `// FEELS (Friendly Enough Expression Language) Examples
// Used in DMN decision tables and expressions

// 1. Simple Comparisons
age >= 18 and age < 65

// 2. Range Checks
claimAmount between 1000 and 50000

// 3. List Operations
coverageType in ("Comprehensive", "Collision", "Liability")

// 4. Date Calculations
yearsInBusiness >= 3 and
date(claimDate) > date("2023-01-01")

// 5. Complex Conditions
if bankruptcies = 0 then "Approved"
else if bankruptcies <= 2 then "Manual Review"
else "Rejected"

// 6. Arithmetic Expressions
(claimAmount * 0.15) + processingFee

// 7. String Manipulation
upper case(customerName) = "ACME CORPORATION"

// 8. List Functions
sum([premium1, premium2, premium3])
count(claimHistory[status = "Approved"])

// 9. Boolean Logic
(yearsInBusiness >= 5 or annualRevenue > 1000000) and
creditScore >= 700

// 10. Decision Table Hit Policy
// U = Unique (single rule match)
// F = First (first matching rule)
// P = Priority (highest priority rule)
// A = Any (all matching rules must agree)
// C = Collect (aggregate results)

// Example: Risk Assessment
for claim in claimHistory return
  if claim.amount > 50000 then "High Risk"
  else if claim.amount > 10000 then "Medium Risk"
  else "Low Risk"`,
    'DMN XML': `<?xml version="1.0" encoding="UTF-8" ?>
<dmn:definitions xmlns:dmn="http://www.omg.org/spec/DMN/20180521/MODEL/"
                 xmlns="https://kie.apache.org/dmn/_857FE424-BEDA-4772-AB8E-2F4CDDB864AB"
                 xmlns:di="http://www.omg.org/spec/DMN/20180521/DI"
                 xmlns:kie="http://www.drools.org/kie/dmn/1.2"
                 xmlns:dmndi="http://www.omg.org/spec/DMN/20180521/DMNDI/"
                 xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
                 xmlns:feel="http://www.omg.org/spec/DMN/20180521/FEEL/"
                 expressionLanguage="http://www.omg.org/spec/DMN/20180521/FEEL/"
                 typeLanguage="http://www.omg.org/spec/DMN/20180521/FEEL/"
                 namespace="https://kie.apache.org/dmn/_857FE424-BEDA-4772-AB8E-2F4CDDB864AB"
                 id="definitions"
                 name="DecisionTables">
  <dmn:itemDefinition id="itemDef1" name="integer">
    <dmn:typeRef>number</dmn:typeRef>
  </dmn:itemDefinition>
  <dmn:itemDefinition id="itemDef2" name="string">
    <dmn:typeRef>string</dmn:typeRef>
  </dmn:itemDefinition>
  <dmn:inputData id="inputData1" name="Years_In_Business">
    <dmn:variable id="variable1" name="Years_In_Business" typeRef="integer" />
  </dmn:inputData>
  <dmn:inputData id="inputData2" name="bankruptcies">
    <dmn:variable id="variable2" name="bankruptcies" typeRef="integer" />
  </dmn:inputData>
  <dmn:inputData id="inputData3" name="years_At_Current_Address">
    <dmn:variable id="variable3" name="years_At_Current_Address" typeRef="integer"/>
  </dmn:inputData>
  <dmn:inputData id="inputData4" name="coverageType">
    <dmn:variable id="variable4" name="coverageType" typeRef="string" />
  </dmn:inputData>
</dmn:definitions>`
  };

  const currentCode = activeLanguage === 'DMN XML'
    ? (dmnXml || codeExamples['DMN XML'])
    : (codeExamples[activeLanguage] || codeExamples['Java']);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className={`absolute right-0 top-0 h-full w-2/5 bg-white border-l border-gray-200 shadow-2xl z-20 flex flex-col ${
      isOpen ? 'animate-in slide-in-from-right duration-300' : 'animate-out slide-out-to-right duration-300'
    }`}>
      {/* Header with Language Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex gap-2">
            {languages.map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveLanguage(lang)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  activeLanguage === lang
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
              title={isCopied ? 'Copied!' : 'Copy code'}
            >
              <Copy className="w-5 h-5" />
            </button>
            <button
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
              title="Edit"
            >
              <Edit className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-gray-200 mx-1"></div>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
              title="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Code Editor Area */}
      <div className="flex-1 overflow-auto bg-white">
        <div className="flex">
          {/* Line Numbers */}
          <div className="bg-gray-50 px-4 py-4 text-right select-none border-r border-gray-200">
            {currentCode.split('\n').map((_, i) => (
              <div key={i} className="text-xs text-gray-400 leading-6 font-mono">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Code Content */}
          <div className="flex-1 px-4 py-4">
            <pre className="text-xs font-mono leading-6 text-gray-800">
              <code>{currentCode}</code>
            </pre>
          </div>
        </div>
      </div>

      {/* Copy Success Toast */}
      {isCopied && (
        <div className="absolute top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <Copy className="w-4 h-4" />
            <span className="text-sm font-medium">Code copied!</span>
          </div>
        </div>
      )}
    </div>
  );
}
