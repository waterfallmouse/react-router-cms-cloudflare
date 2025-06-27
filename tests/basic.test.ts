// Basic test to verify Bun test setup
import { test, expect } from "bun:test"

test("basic math operations", () => {
  expect(2 + 2).toBe(4)
  expect(10 - 5).toBe(5)
  expect(3 * 3).toBe(9)
  expect(8 / 2).toBe(4)
})

test("string operations", () => {
  expect("hello".toUpperCase()).toBe("HELLO")
  expect("world".length).toBe(5)
  expect("test".includes("es")).toBe(true)
})

test("array operations", () => {
  const arr = [1, 2, 3]
  expect(arr.length).toBe(3)
  expect(arr.includes(2)).toBe(true)
  expect(arr[0]).toBe(1)
})

test("object operations", () => {
  const obj = { name: "test", value: 42 }
  expect(obj.name).toBe("test")
  expect(obj.value).toBe(42)
  expect(Object.keys(obj)).toEqual(["name", "value"])
})