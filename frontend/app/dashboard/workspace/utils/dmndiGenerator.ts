/**
 * DMNDI Generator — parses a DMN XML document and injects a <dmndi:DMNDI>
 * section with hierarchical layout shapes and requirement edges so that
 * KIE Sandbox renders a proper Decision Requirements Diagram (DRD).
 *
 * Only runs when the XML is missing DMNShape elements.
 */

// ── Types ────────────────────────────────────────────────────────────────

interface DrgElement {
  id: string;
  name: string;
  type: 'decision' | 'inputData' | 'bkm' | 'knowledgeSource';
}

interface Requirement {
  id: string;
  fromId: string;
  toId: string;
}

interface LayoutNode extends DrgElement {
  layer: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Constants ────────────────────────────────────────────────────────────

const NODE_WIDTH = 160;
const NODE_HEIGHT = 80;
const INPUT_HEIGHT = 60;
const H_GAP = 60;   // horizontal gap between nodes in same layer
const V_GAP = 100;  // vertical gap between layers

// ── Public API ───────────────────────────────────────────────────────────

/**
 * If the DMN XML has no DMNDI shapes, parse it, generate a hierarchical
 * layout, and inject the DMNDI section.  Returns the (possibly modified) XML.
 */
export function ensureDmndi(xml: string): string {
  if (!xml || typeof xml !== 'string') return xml;

  // Already has shapes → nothing to do
  if (hasDmnShapes(xml)) return xml;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    if (doc.querySelector('parsererror')) return xml;

    const definitions = doc.querySelector('definitions');
    if (!definitions) return xml;

    const elements = extractElements(doc);
    if (elements.length === 0) return xml;

    const requirements = extractRequirements(doc);
    const layoutNodes = computeLayout(elements, requirements);

    return injectDmndi(xml, definitions, layoutNodes, requirements);
  } catch {
    return xml; // on any failure, return original
  }
}

// ── Detection ────────────────────────────────────────────────────────────

function hasDmnShapes(xml: string): boolean {
  // Check for actual shape elements (not an empty DMNDI block)
  return /<dmndi:DMNShape[\s>]/i.test(xml) || /<DMNShape[\s>]/i.test(xml);
}

// ── Element extraction ──────────────────────────────────────────────────

function extractElements(doc: Document): DrgElement[] {
  const els: DrgElement[] = [];
  const seen = new Set<string>();

  const map: Array<[string, DrgElement['type']]> = [
    ['decision', 'decision'],
    ['inputData', 'inputData'],
    ['businessKnowledgeModel', 'bkm'],
    ['knowledgeSource', 'knowledgeSource'],
  ];

  for (const [tag, type] of map) {
    doc.querySelectorAll(tag).forEach((node) => {
      const id = node.getAttribute('id');
      if (id && !seen.has(id)) {
        seen.add(id);
        els.push({ id, name: node.getAttribute('name') || id, type });
      }
    });
  }

  return els;
}

// ── Requirement (edge) extraction ───────────────────────────────────────

function extractRequirements(doc: Document): Requirement[] {
  const reqs: Requirement[] = [];

  // informationRequirement → requiredInput / requiredDecision
  doc.querySelectorAll('informationRequirement').forEach((req) => {
    const parent = req.parentElement;
    const toId = parent?.getAttribute('id');
    if (!toId) return;

    const reqId = req.getAttribute('id') || `_ir_${toId}_${reqs.length}`;

    for (const child of Array.from(req.children)) {
      const href = child.getAttribute('href');
      if (href) {
        reqs.push({ id: reqId, fromId: href.replace('#', ''), toId });
      }
    }
  });

  // knowledgeRequirement → requiredKnowledge
  doc.querySelectorAll('knowledgeRequirement').forEach((req) => {
    const parent = req.parentElement;
    const toId = parent?.getAttribute('id');
    if (!toId) return;

    const reqId = req.getAttribute('id') || `_kr_${toId}_${reqs.length}`;

    for (const child of Array.from(req.children)) {
      const href = child.getAttribute('href');
      if (href) {
        reqs.push({ id: reqId, fromId: href.replace('#', ''), toId });
      }
    }
  });

  // authorityRequirement → requiredAuthority / requiredInput / requiredDecision
  doc.querySelectorAll('authorityRequirement').forEach((req) => {
    const parent = req.parentElement;
    const toId = parent?.getAttribute('id');
    if (!toId) return;

    const reqId = req.getAttribute('id') || `_ar_${toId}_${reqs.length}`;

    for (const child of Array.from(req.children)) {
      const href = child.getAttribute('href');
      if (href) {
        reqs.push({ id: reqId, fromId: href.replace('#', ''), toId });
      }
    }
  });

  return reqs;
}

// ── Hierarchical layout ─────────────────────────────────────────────────

function computeLayout(
  elements: DrgElement[],
  requirements: Requirement[],
): LayoutNode[] {
  const idSet = new Set(elements.map((e) => e.id));

  // Build adjacency: child → parents (who it depends on)
  const dependsOn = new Map<string, Set<string>>();
  // Build adjacency: parent → children (who depends on it)
  const dependedBy = new Map<string, Set<string>>();

  for (const el of elements) {
    dependsOn.set(el.id, new Set());
    dependedBy.set(el.id, new Set());
  }

  for (const req of requirements) {
    if (idSet.has(req.fromId) && idSet.has(req.toId)) {
      dependsOn.get(req.toId)!.add(req.fromId);
      dependedBy.get(req.fromId)!.add(req.toId);
    }
  }

  // Assign layers via BFS (topological sort by longest path)
  const layers = new Map<string, number>();

  // Start: nodes with no dependencies (inputs, standalone)
  const queue: string[] = [];
  for (const el of elements) {
    if (dependsOn.get(el.id)!.size === 0) {
      layers.set(el.id, 0);
      queue.push(el.id);
    }
  }

  // BFS: each node's layer = max(parent layers) + 1
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = layers.get(current)!;

    for (const child of dependedBy.get(current) || []) {
      const existingLayer = layers.get(child) ?? -1;
      const newLayer = currentLayer + 1;

      if (newLayer > existingLayer) {
        layers.set(child, newLayer);
      }

      // Check if all parents of this child are assigned
      const allParentsAssigned = [...(dependsOn.get(child) || [])].every(
        (p) => layers.has(p),
      );
      if (allParentsAssigned && !queue.includes(child)) {
        queue.push(child);
      }
    }
  }

  // Assign any unvisited nodes (disconnected) to layer 0
  for (const el of elements) {
    if (!layers.has(el.id)) {
      layers.set(el.id, 0);
    }
  }

  // Group by layer
  const maxLayer = Math.max(...layers.values(), 0);
  const layerGroups: DrgElement[][] = Array.from(
    { length: maxLayer + 1 },
    () => [],
  );

  for (const el of elements) {
    layerGroups[layers.get(el.id)!].push(el);
  }

  // Position nodes — layer 0 at bottom, highest layer at top
  const layoutNodes: LayoutNode[] = [];

  for (let layer = 0; layer <= maxLayer; layer++) {
    const group = layerGroups[layer];
    const layerWidth = group.length * (NODE_WIDTH + H_GAP) - H_GAP;
    const startX = -layerWidth / 2 + NODE_WIDTH / 2;

    // Invert: layer 0 (inputs) at the bottom
    const y = (maxLayer - layer) * (NODE_HEIGHT + V_GAP);

    for (let i = 0; i < group.length; i++) {
      const el = group[i];
      const h = el.type === 'inputData' ? INPUT_HEIGHT : NODE_HEIGHT;

      layoutNodes.push({
        ...el,
        layer,
        x: startX + i * (NODE_WIDTH + H_GAP),
        y: y + (NODE_HEIGHT - h) / 2, // vertically center within row
        width: NODE_WIDTH,
        height: h,
      });
    }
  }

  // Shift all coordinates so nothing is negative
  const minX = Math.min(...layoutNodes.map((n) => n.x));
  const offsetX = minX < 0 ? -minX + 100 : 100; // 100px padding
  const offsetY = 100; // 100px top padding

  for (const n of layoutNodes) {
    n.x += offsetX;
    n.y += offsetY;
  }

  return layoutNodes;
}

// ── DMNDI injection ─────────────────────────────────────────────────────

function injectDmndi(
  xml: string,
  definitions: Element,
  nodes: LayoutNode[],
  requirements: Requirement[],
): string {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const defId = definitions.getAttribute('id') || 'definitions';

  // Detect namespace prefix used in the document
  const dmndiNs = 'https://www.omg.org/spec/DMN/20230324/DMNDI/';
  const dcNs = 'http://www.omg.org/spec/DMN/20180521/DC/';

  // Build shapes
  const shapes = nodes
    .map((n) => {
      return `      <dmndi:DMNShape id="shape_${n.id}" dmnElementRef="${n.id}">
        <dc:Bounds x="${Math.round(n.x)}" y="${Math.round(n.y)}" width="${n.width}" height="${n.height}" />
      </dmndi:DMNShape>`;
    })
    .join('\n');

  // Build edges
  const idSet = new Set(nodes.map((n) => n.id));
  const edges = requirements
    .filter((r) => idSet.has(r.fromId) && idSet.has(r.toId))
    .map((r) => {
      const from = nodeMap.get(r.fromId)!;
      const to = nodeMap.get(r.toId)!;

      // Edge from bottom-center of "to" node to top-center of "from" node
      // (KIE convention: edge goes from source to target, visually bottom→top)
      const fromX = Math.round(from.x + from.width / 2);
      const fromY = Math.round(from.y);
      const toX = Math.round(to.x + to.width / 2);
      const toY = Math.round(to.y + to.height);

      return `      <dmndi:DMNEdge id="edge_${r.id}" dmnElementRef="${r.id}">
        <di:waypoint x="${toX}" y="${toY}" />
        <di:waypoint x="${fromX}" y="${fromY}" />
      </dmndi:DMNEdge>`;
    })
    .join('\n');

  const dmndi = `
  <dmndi:DMNDI>
    <dmndi:DMNDiagram id="diagram_${defId}" name="DRD">
${shapes}
${edges}
    </dmndi:DMNDiagram>
  </dmndi:DMNDI>`;

  // Remove any existing empty DMNDI block
  let result = xml.replace(/<dmndi:DMNDI[\s\S]*?<\/dmndi:DMNDI>/gi, '');

  // Also ensure di namespace is declared on definitions
  if (!result.includes('xmlns:di=')) {
    result = result.replace(
      /(<definitions\b)/,
      '$1 xmlns:di="http://www.omg.org/spec/DMN/20180521/DI/"',
    );
  }
  if (!result.includes('xmlns:dmndi=')) {
    result = result.replace(
      /(<definitions\b)/,
      `$1 xmlns:dmndi="${dmndiNs}"`,
    );
  }
  if (!result.includes('xmlns:dc=')) {
    result = result.replace(
      /(<definitions\b)/,
      `$1 xmlns:dc="${dcNs}"`,
    );
  }

  // Insert before closing </definitions>
  result = result.replace(/<\/definitions>/, `${dmndi}\n</definitions>`);

  return result;
}
