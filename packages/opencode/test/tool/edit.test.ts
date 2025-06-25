import { describe, expect, test } from "bun:test"
import { replace } from "../../src/tool/edit"

interface TestCase {
  content: string
  find: string
  replace: string
  all?: boolean
  fail?: boolean
}

const testCases: TestCase[] = [
  // SimpleReplacer cases
  {
    content: ["function hello() {", '  console.log("world");', "}"].join("\n"),
    find: 'console.log("world");',
    replace: 'console.log("universe");',
  },
  {
    content: [
      "if (condition) {",
      "  doSomething();",
      "  doSomethingElse();",
      "}",
    ].join("\n"),
    find: ["  doSomething();", "  doSomethingElse();"].join("\n"),
    replace: ["  doNewThing();", "  doAnotherThing();"].join("\n"),
  },

  // LineTrimmedReplacer cases
  {
    content: ["function test() {", '    console.log("hello");', "}"].join("\n"),
    find: 'console.log("hello");',
    replace: 'console.log("goodbye");',
  },
  {
    content: ["const x = 5;   ", "const y = 10;"].join("\n"),
    find: "const x = 5;",
    replace: "const x = 15;",
  },
  {
    content: ["  if (true) {", "    return false;", "  }"].join("\n"),
    find: ["if (true) {", "return false;", "}"].join("\n"),
    replace: ["if (false) {", "return true;", "}"].join("\n"),
  },

  // BlockAnchorReplacer cases
  {
    content: [
      "function calculate(a, b) {",
      "  const temp = a + b;",
      "  const result = temp * 2;",
      "  return result;",
      "}",
    ].join("\n"),
    find: [
      "function calculate(a, b) {",
      "  // different middle content",
      "  return result;",
      "}",
    ].join("\n"),
    replace: ["function calculate(a, b) {", "  return a * b * 2;", "}"].join(
      "\n",
    ),
  },
  {
    content: [
      "class MyClass {",
      "  constructor() {",
      "    this.value = 0;",
      "  }",
      "  ",
      "  getValue() {",
      "    return this.value;",
      "  }",
      "}",
    ].join("\n"),
    find: ["class MyClass {", "  // different implementation", "}"].join("\n"),
    replace: [
      "class MyClass {",
      "  constructor() {",
      "    this.value = 42;",
      "  }",
      "}",
    ].join("\n"),
  },

  // WhitespaceNormalizedReplacer cases
  {
    content: ["function test() {", '\tconsole.log("hello");', "}"].join("\n"),
    find: '  console.log("hello");',
    replace: '  console.log("world");',
  },
  {
    content: "const   x    =     5;",
    find: "const x = 5;",
    replace: "const x = 10;",
  },
  {
    content: "if\t(  condition\t) {",
    find: "if ( condition ) {",
    replace: "if (newCondition) {",
  },

  // IndentationFlexibleReplacer cases
  {
    content: [
      "    function nested() {",
      '      console.log("deeply nested");',
      "      return true;",
      "    }",
    ].join("\n"),
    find: [
      "function nested() {",
      '  console.log("deeply nested");',
      "  return true;",
      "}",
    ].join("\n"),
    replace: [
      "function nested() {",
      '  console.log("updated");',
      "  return false;",
      "}",
    ].join("\n"),
  },
  {
    content: [
      "  if (true) {",
      '    console.log("level 1");',
      '      console.log("level 2");',
      "  }",
    ].join("\n"),
    find: [
      "if (true) {",
      'console.log("level 1");',
      '  console.log("level 2");',
      "}",
    ].join("\n"),
    replace: ["if (true) {", 'console.log("updated");', "}"].join("\n"),
  },

  // replaceAll option cases
  {
    content: [
      'console.log("test");',
      'console.log("test");',
      'console.log("test");',
    ].join("\n"),
    find: 'console.log("test");',
    replace: 'console.log("updated");',
    all: true,
  },
  {
    content: ['console.log("test");', 'console.log("test");'].join("\n"),
    find: 'console.log("test");',
    replace: 'console.log("updated");',
    all: false,
  },

  // Error cases
  {
    content: 'console.log("hello");',
    find: "nonexistent string",
    replace: "updated",
    fail: true,
  },
  {
    content: ["test", "test", "different content", "test"].join("\n"),
    find: "test",
    replace: "updated",
    all: false,
    fail: true,
  },

  // Edge cases
  {
    content: "",
    find: "",
    replace: "new content",
  },
  {
    content: "const regex = /[.*+?^${}()|[\\\\]\\\\\\\\]/g;",
    find: "/[.*+?^${}()|[\\\\]\\\\\\\\]/g",
    replace: "/\\\\w+/g",
  },
  {
    content: 'const message = "Hello 世界! 🌍";',
    find: "Hello 世界! 🌍",
    replace: "Hello World! 🌎",
  },
]

describe("EditTool Replacers", () => {
  test.each(testCases)("case %#", (testCase) => {
    if (testCase.fail) {
      expect(() => {
        replace(testCase.content, testCase.find, testCase.replace, testCase.all)
      }).toThrow()
    } else {
      const result = replace(
        testCase.content,
        testCase.find,
        testCase.replace,
        testCase.all,
      )
      expect(result).toContain(testCase.replace)
    }
  })
})
