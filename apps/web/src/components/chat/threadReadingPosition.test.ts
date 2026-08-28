import { describe, expect, it } from "vite-plus/test";
import {
  readThreadReadingPosition,
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
});
