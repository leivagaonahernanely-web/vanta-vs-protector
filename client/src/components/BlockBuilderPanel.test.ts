import { describe, expect, it } from "vitest";
import { composeBlocks } from "./BlockBuilderPanel";

describe("Block Builder", () => {
  it("composes Lua and text blocks in their original order", () => {
    expect(composeBlocks([
      { content: "local enabled = true" },
      { content: "-- Texto entre bloques" },
      { content: "print(enabled)" },
    ])).toBe("local enabled = true\n\n-- Texto entre bloques\n\nprint(enabled)");
  });

  it("ignores empty blocks without changing useful content", () => {
    expect(composeBlocks([{ content: "  " }, { content: "print(1)" }])).toBe("print(1)");
  });
});
