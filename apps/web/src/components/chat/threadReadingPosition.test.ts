import { describe, expect, it } from "vite-plus/test";
import {
  readThreadReadingPosition,
  restoredSelectionViewportCorrection,
  writeThreadReadingPosition,
  type ThreadReadingPosition,
} from "./threadReadingPosition";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe("thread reading-position persistence", () => {
  it("keeps positions isolated by scoped environment and thread key", () => {
    const storage = memoryStorage();
    const first: ThreadReadingPosition = {
      scrollOffset: 812,
      anchor: { rowId: "message:first", offset: -24 },
      selection: {
        exact: "the exact line",
        prefix: "before ",
        suffix: " after",
        rowId: "message:first",
        viewportOffset: 217.5,
        windowOffset: 281.5,
      },
      updatedAt: 123,
    };
    const second: ThreadReadingPosition = {
      scrollOffset: 41,
      anchor: null,
      selection: null,
      updatedAt: 456,
    };

    writeThreadReadingPosition(storage, "home:thread-1", first);
    writeThreadReadingPosition(storage, "work-pc:thread-1", second);

    expect(readThreadReadingPosition(storage, "home:thread-1")).toEqual(first);
    expect(readThreadReadingPosition(storage, "work-pc:thread-1")).toEqual(second);
  });

  it("ignores malformed persisted data without affecting chat startup", () => {
    const storage = memoryStorage();
    storage.setItem("t3code:thread-reading-position:v1:home:thread-1", "not json");

    expect(readThreadReadingPosition(storage, "home:thread-1")).toBeNull();
  });

  it("drops a malformed optional selection while preserving a valid scroll offset", () => {
    const storage = memoryStorage();
    storage.setItem(
      "t3code:thread-reading-position:v1:home:thread-1",
      JSON.stringify({
        scrollOffset: 99,
        anchor: { rowId: "message:first", offset: -12 },
        selection: { exact: "", prefix: "", suffix: "", rowId: null },
        updatedAt: 100,
      }),
    );

    expect(readThreadReadingPosition(storage, "home:thread-1")).toEqual({
      scrollOffset: 99,
      anchor: { rowId: "message:first", offset: -12 },
      selection: null,
      updatedAt: 100,
    });
  });

  it("keeps legacy selections readable when they have no viewport offset", () => {
    const storage = memoryStorage();
    storage.setItem(
      "t3code:thread-reading-position:v1:home:thread-legacy",
      JSON.stringify({
        scrollOffset: 120,
        anchor: { rowId: "message:legacy", offset: -8 },
        selection: {
          exact: "remember this line",
          prefix: "before ",
          suffix: " after",
          rowId: "message:legacy",
        },
        updatedAt: 789,
      }),
    );

    expect(readThreadReadingPosition(storage, "home:thread-legacy")?.selection).toEqual({
      exact: "remember this line",
      prefix: "before ",
      suffix: " after",
      rowId: "message:legacy",
      viewportOffset: null,
      windowOffset: null,
    });
  });

  it("calculates the scroll correction from the selected line instead of the row start", () => {
    const selectedNode = {} as Node;
    const root = {
      contains: (node: Node) => node === selectedNode,
      getBoundingClientRect: () => ({ top: 100 }),
    } as HTMLElement;
    const selection = {
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => ({
        startContainer: selectedNode,
        endContainer: selectedNode,
        getBoundingClientRect: () => ({ top: 360 }),
      }),
    } as unknown as Selection;

    expect(
      restoredSelectionViewportCorrection(
        root,
        {
          exact: "selected line",
          prefix: "",
          suffix: "",
          rowId: "message:first",
          viewportOffset: 210,
          windowOffset: null,
        },
        selection,
      ),
    ).toBe(50);
  });

  it("prefers the absolute window coordinate when the timeline header moves", () => {
    const selectedNode = {} as Node;
    const root = {
      contains: (node: Node) => node === selectedNode,
      getBoundingClientRect: () => ({ top: 140 }),
    } as HTMLElement;
    const selection = {
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => ({
        startContainer: selectedNode,
        endContainer: selectedNode,
        getBoundingClientRect: () => ({ top: 360 }),
      }),
    } as unknown as Selection;

    expect(
      restoredSelectionViewportCorrection(
        root,
        {
          exact: "selected line",
          prefix: "",
          suffix: "",
          rowId: "message:first",
          viewportOffset: 210,
          windowOffset: 300,
        },
        selection,
      ),
    ).toBe(60);
  });
});
