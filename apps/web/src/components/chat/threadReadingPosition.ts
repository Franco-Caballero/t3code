const THREAD_READING_POSITION_STORAGE_PREFIX = "t3code:thread-reading-position:v1:";
const SELECTION_CONTEXT_LENGTH = 64;
const MAX_SELECTION_LENGTH = 4096;

export interface ThreadTextSelection {
  readonly exact: string;
  readonly prefix: string;
  readonly suffix: string;
  readonly rowId: string | null;
}

export interface ThreadViewportAnchor {
  readonly rowId: string;
  readonly offset: number;
}

export interface ThreadReadingPosition {
  readonly scrollOffset: number;
  readonly anchor: ThreadViewportAnchor | null;
  readonly selection: ThreadTextSelection | null;
  readonly updatedAt: number;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function storageKey(routeThreadKey: string): string {
  return `${THREAD_READING_POSITION_STORAGE_PREFIX}${routeThreadKey}`;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseSelection(value: unknown): ThreadTextSelection | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<ThreadTextSelection>;
  if (
    typeof candidate.exact !== "string" ||
    candidate.exact.length === 0 ||
    candidate.exact.length > MAX_SELECTION_LENGTH ||
    typeof candidate.prefix !== "string" ||
    typeof candidate.suffix !== "string" ||
    (candidate.rowId !== null && typeof candidate.rowId !== "string")
  ) {
    return null;
  }
  return {
    exact: candidate.exact,
    prefix: candidate.prefix.slice(-SELECTION_CONTEXT_LENGTH),
    suffix: candidate.suffix.slice(0, SELECTION_CONTEXT_LENGTH),
    rowId: candidate.rowId,
  };
}

function parseAnchor(value: unknown): ThreadViewportAnchor | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<ThreadViewportAnchor>;
  if (typeof candidate.rowId !== "string" || !Number.isFinite(candidate.offset)) return null;
  return { rowId: candidate.rowId, offset: candidate.offset as number };
}

export function readThreadReadingPosition(
  storage: StorageLike,
  routeThreadKey: string,
): ThreadReadingPosition | null {
  try {
    const raw = storage.getItem(storageKey(routeThreadKey));
    if (raw === null) return null;
    const candidate = JSON.parse(raw) as Partial<ThreadReadingPosition>;
    if (!isFiniteNonNegative(candidate.scrollOffset) || !isFiniteNonNegative(candidate.updatedAt)) {
      return null;
    }
    return {
      scrollOffset: candidate.scrollOffset,
      anchor: parseAnchor(candidate.anchor),
      selection: parseSelection(candidate.selection),
      updatedAt: candidate.updatedAt,
    };
  } catch {
    return null;
  }
}

export function writeThreadReadingPosition(
  storage: StorageLike,
  routeThreadKey: string,
  position: ThreadReadingPosition,
): void {
  try {
    storage.setItem(storageKey(routeThreadKey), JSON.stringify(position));
  } catch {
    // Reading-position persistence is best-effort and must never break chat.
  }
}

function timelineRows(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-timeline-row-id]"));
}

export function captureViewportAnchor(root: HTMLElement): ThreadViewportAnchor | null {
  const viewport = root.getBoundingClientRect();
  const rows = timelineRows(root);
  const anchor =
    rows.find((row) => row.getBoundingClientRect().bottom > viewport.top + 1) ?? rows.at(-1);
  if (!anchor) return null;
  const rowId = anchor.dataset.timelineRowId;
  if (!rowId) return null;
  return {
    rowId,
    offset: anchor.getBoundingClientRect().top - viewport.top,
  };
}

function textNodes(root: Node): Text[] {
  const document = root.ownerDocument;
  if (!document) return [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const result: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    result.push(node as Text);
    node = walker.nextNode();
  }
  return result;
}

function textOffset(root: Node, targetNode: Node, targetOffset: number): number | null {
  let offset = 0;
  for (const node of textNodes(root)) {
    if (node === targetNode) return offset + targetOffset;
    offset += node.data.length;
  }
  return null;
}

function containingTimelineRow(root: HTMLElement, node: Node): HTMLElement | null {
  const element = node instanceof Element ? node : node.parentElement;
  const row = element?.closest<HTMLElement>("[data-timeline-row-id]") ?? null;
  return row && root.contains(row) ? row : null;
}

export function captureThreadSelection(
  root: HTMLElement,
  selection: Selection | null,
): ThreadTextSelection | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const exact = range.toString();
  if (exact.length === 0 || exact.length > MAX_SELECTION_LENGTH) return null;

  const startRow = containingTimelineRow(root, range.startContainer);
  const endRow = containingTimelineRow(root, range.endContainer);
  const scope = startRow !== null && startRow === endRow ? startRow : root;
  const start = textOffset(scope, range.startContainer, range.startOffset);
  const end = textOffset(scope, range.endContainer, range.endOffset);
  if (start === null || end === null) return null;
  const content = scope.textContent ?? "";

  return {
    exact,
    prefix: content.slice(Math.max(0, start - SELECTION_CONTEXT_LENGTH), start),
    suffix: content.slice(end, end + SELECTION_CONTEXT_LENGTH),
    rowId: scope === root ? null : (scope.dataset.timelineRowId ?? null),
  };
}

function resolveSelectionScope(root: HTMLElement, rowId: string | null): HTMLElement {
  if (rowId === null) return root;
  return timelineRows(root).find((row) => row.dataset.timelineRowId === rowId) ?? root;
}

function quoteScore(content: string, index: number, selection: ThreadTextSelection): number {
  let score = 0;
  const prefix = content.slice(Math.max(0, index - selection.prefix.length), index);
  const suffix = content.slice(
    index + selection.exact.length,
    index + selection.exact.length + selection.suffix.length,
  );
  for (let i = 1; i <= Math.min(prefix.length, selection.prefix.length); i += 1) {
    if (prefix.at(-i) !== selection.prefix.at(-i)) break;
    score += 1;
  }
  for (let i = 0; i < Math.min(suffix.length, selection.suffix.length); i += 1) {
    if (suffix[i] !== selection.suffix[i]) break;
    score += 1;
  }
  return score;
}

function resolveQuoteIndex(content: string, selection: ThreadTextSelection): number | null {
  let bestIndex = -1;
  let bestScore = -1;
  let index = content.indexOf(selection.exact);
  while (index !== -1) {
    const score = quoteScore(content, index, selection);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
    index = content.indexOf(selection.exact, index + 1);
  }
  return bestIndex === -1 ? null : bestIndex;
}

function boundaryAtTextOffset(
  root: HTMLElement,
  requestedOffset: number,
): { readonly node: Text; readonly offset: number } | null {
  let offset = 0;
  for (const node of textNodes(root)) {
    const nextOffset = offset + node.data.length;
    if (requestedOffset <= nextOffset) {
      return { node, offset: Math.max(0, requestedOffset - offset) };
    }
    offset = nextOffset;
  }
  return null;
}

export function restoreThreadSelection(
  root: HTMLElement,
  selectionQuote: ThreadTextSelection,
  selection: Selection | null,
): boolean {
  if (!selection) return false;
  const scope = resolveSelectionScope(root, selectionQuote.rowId);
  const content = scope.textContent ?? "";
  const startOffset = resolveQuoteIndex(content, selectionQuote);
  if (startOffset === null) return false;
  const start = boundaryAtTextOffset(scope, startOffset);
  const end = boundaryAtTextOffset(scope, startOffset + selectionQuote.exact.length);
  if (!start || !end) return false;

  const range = scope.ownerDocument.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}
