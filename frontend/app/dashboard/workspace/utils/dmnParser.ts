// DMN XML Parser - Extracts decision table structure for test cases

export interface DmnInput {
  id: string;
  label: string;
  name: string;
  typeRef: string;
}

export interface DmnOutput {
  id: string;
  label: string;
  name: string;
  typeRef: string;
}

export interface DmnRule {
  id: string;
  inputEntries: string[];
  outputEntries: string[];
}

export interface DecisionTable {
  id: string;
  name: string;
  hitPolicy: string;
  inputs: DmnInput[];
  outputs: DmnOutput[];
  rules: DmnRule[];
}

export interface ParsedDmn {
  id: string;
  name: string;
  decisions: DecisionTable[];
}

export function parseDmnXml(xml: string): ParsedDmn | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.error('XML Parse Error:', parseError.textContent);
      return null;
    }

    const definitions = doc.querySelector('definitions');
    if (!definitions) return null;

    const result: ParsedDmn = {
      id: definitions.getAttribute('id') || '',
      name: definitions.getAttribute('name') || '',
      decisions: [],
    };

    // Find all decision elements
    const decisions = doc.querySelectorAll('decision');
    decisions.forEach((decision) => {
      const decisionTable = decision.querySelector('decisionTable');
      if (!decisionTable) return;

      const table: DecisionTable = {
        id: decision.getAttribute('id') || '',
        name: decision.getAttribute('name') || '',
        hitPolicy: decisionTable.getAttribute('hitPolicy') || 'UNIQUE',
        inputs: [],
        outputs: [],
        rules: [],
      };

      // Parse inputs
      const inputs = decisionTable.querySelectorAll(':scope > input');
      inputs.forEach((input) => {
        const inputExpr = input.querySelector('inputExpression');
        const textEl = inputExpr?.querySelector('text');

        table.inputs.push({
          id: input.getAttribute('id') || '',
          label: input.getAttribute('label') || '',
          name: textEl?.textContent || '',
          typeRef: inputExpr?.getAttribute('typeRef') || 'string',
        });
      });

      // Parse outputs
      const outputs = decisionTable.querySelectorAll(':scope > output');
      outputs.forEach((output) => {
        table.outputs.push({
          id: output.getAttribute('id') || '',
          label: output.getAttribute('label') || '',
          name: output.getAttribute('name') || '',
          typeRef: output.getAttribute('typeRef') || 'string',
        });
      });

      // Parse rules
      const rules = decisionTable.querySelectorAll(':scope > rule');
      rules.forEach((rule) => {
        const inputEntries: string[] = [];
        const outputEntries: string[] = [];

        rule.querySelectorAll('inputEntry').forEach((entry) => {
          const text = entry.querySelector('text')?.textContent || '';
          inputEntries.push(text);
        });

        rule.querySelectorAll('outputEntry').forEach((entry) => {
          const text = entry.querySelector('text')?.textContent || '';
          outputEntries.push(text);
        });

        table.rules.push({
          id: rule.getAttribute('id') || '',
          inputEntries,
          outputEntries,
        });
      });

      result.decisions.push(table);
    });

    return result;
  } catch (error) {
    console.error('Error parsing DMN XML:', error);
    return null;
  }
}

// Simple FEEL expression evaluator for common patterns
export function evaluateFeelExpression(expression: string, value: any): boolean {
  if (!expression || expression.trim() === '') {
    return true; // Empty expression matches anything
  }

  const expr = expression.trim();
  const numValue = typeof value === 'number' ? value : parseFloat(value);

  // Range: [a..b], (a..b), [a..b), (a..b]
  const rangeMatch = expr.match(/^([\[\(])(\d+(?:\.\d+)?)\s*\.\.\s*(\d+(?:\.\d+)?)([\]\)])$/);
  if (rangeMatch) {
    const [, leftBracket, minStr, maxStr, rightBracket] = rangeMatch;
    const min = parseFloat(minStr);
    const max = parseFloat(maxStr);
    const leftInclusive = leftBracket === '[';
    const rightInclusive = rightBracket === ']';

    const leftCheck = leftInclusive ? numValue >= min : numValue > min;
    const rightCheck = rightInclusive ? numValue <= max : numValue < max;
    return leftCheck && rightCheck;
  }

  // Comparison operators: >=, <=, >, <, =
  const compMatch = expr.match(/^([><=!]+)\s*(\d+(?:\.\d+)?)$/);
  if (compMatch) {
    const [, op, numStr] = compMatch;
    const compareValue = parseFloat(numStr);

    switch (op) {
      case '>=': return numValue >= compareValue;
      case '<=': return numValue <= compareValue;
      case '>': return numValue > compareValue;
      case '<': return numValue < compareValue;
      case '=': return numValue === compareValue;
      case '!=': return numValue !== compareValue;
      default: return false;
    }
  }

  // String literal: "value"
  const stringMatch = expr.match(/^"(.+)"$/);
  if (stringMatch) {
    return String(value) === stringMatch[1];
  }

  // Boolean
  if (expr === 'true') return value === true || value === 'true';
  if (expr === 'false') return value === false || value === 'false';

  // Null check
  if (expr === 'null') return value === null || value === undefined || value === '';

  // List check: value in [a, b, c] or just a, b, c
  if (expr.includes(',')) {
    const items = expr.split(',').map(s => s.trim().replace(/"/g, ''));
    return items.includes(String(value));
  }

  // Direct value match (number or unquoted string)
  if (!isNaN(parseFloat(expr))) {
    return numValue === parseFloat(expr);
  }

  return String(value) === expr;
}

export interface TestResult {
  ruleId: string;
  matched: boolean;
  outputs: Record<string, any>;
}

export function evaluateTestCase(
  table: DecisionTable,
  inputValues: Record<string, any>
): TestResult | null {
  // Evaluate each rule based on hit policy
  for (const rule of table.rules) {
    let allMatch = true;

    // Check each input entry against the provided value
    for (let i = 0; i < table.inputs.length; i++) {
      const input = table.inputs[i];
      const inputEntry = rule.inputEntries[i];
      const value = inputValues[input.name] ?? inputValues[input.label];

      if (!evaluateFeelExpression(inputEntry, value)) {
        allMatch = false;
        break;
      }
    }

    if (allMatch) {
      // Build output values
      const outputs: Record<string, any> = {};
      for (let i = 0; i < table.outputs.length; i++) {
        const output = table.outputs[i];
        const rawValue = rule.outputEntries[i];
        let outputValue: any = rawValue;

        // Parse output value
        if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
          outputValue = rawValue.slice(1, -1);
        } else if (!isNaN(parseFloat(rawValue)) && rawValue !== '') {
          outputValue = parseFloat(rawValue);
        } else if (rawValue === 'true') {
          outputValue = true;
        } else if (rawValue === 'false') {
          outputValue = false;
        } else if (rawValue === 'null' || rawValue === '') {
          outputValue = null;
        }

        outputs[output.name || output.label] = outputValue;
      }

      return {
        ruleId: rule.id,
        matched: true,
        outputs,
      };
    }
  }

  return {
    ruleId: '',
    matched: false,
    outputs: {},
  };
}
