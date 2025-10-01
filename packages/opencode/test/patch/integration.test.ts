import { describe, test, expect } from "bun:test"
import { Patch } from "../../src/patch"

describe("Patch integration", () => {
  test("should be compatible with existing tool system", () => {
    // Test that our Patch namespace can be imported and used
    expect(Patch).toBeDefined()
    expect(Patch.parsePatch).toBeDefined()
    expect(Patch.applyPatch).toBeDefined()
    expect(Patch.maybeParseApplyPatch).toBeDefined()
    expect(Patch.PatchSchema).toBeDefined()
  })
  
  test("should parse patch format compatible with existing tool", () => {
    const patchText = `*** Begin Patch
*** Add File: test-integration.txt
+Integration test content
*** End Patch`
    
    const result = Patch.parsePatch(patchText)
    expect(result.hunks).toHaveLength(1)
    expect(result.hunks[0].type).toBe("add")
    expect(result.hunks[0].path).toBe("test-integration.txt")
    if (result.hunks[0].type === "add") {
      expect(result.hunks[0].contents).toBe("Integration test content")
    }
  })
  
  test("should handle complex patch with multiple operations", () => {
    const patchText = `*** Begin Patch
*** Add File: new-file.txt
+This is a new file
+with multiple lines
*** Update File: existing.txt
@@
 old content
-line to remove
+line to add
 more content
*** Delete File: old-file.txt
*** End Patch`
    
    const result = Patch.parsePatch(patchText)
    expect(result.hunks).toHaveLength(3)
    
    // Check add operation
    expect(result.hunks[0].type).toBe("add")
    if (result.hunks[0].type === "add") {
      expect(result.hunks[0].contents).toBe("This is a new file\nwith multiple lines")
    }
    
    // Check update operation
    expect(result.hunks[1].type).toBe("update")
    if (result.hunks[1].type === "update") {
      expect(result.hunks[1].path).toBe("existing.txt")
      expect(result.hunks[1].chunks).toHaveLength(1)
      expect(result.hunks[1].chunks[0].old_lines).toEqual(["old content", "line to remove", "more content"])
      expect(result.hunks[1].chunks[0].new_lines).toEqual(["old content", "line to add", "more content"])
      expect(result.hunks[1].chunks[0].change_context).toBeUndefined()
    }
    
    // Check delete operation
    expect(result.hunks[2].type).toBe("delete")
    expect(result.hunks[2].path).toBe("old-file.txt")
  })
})