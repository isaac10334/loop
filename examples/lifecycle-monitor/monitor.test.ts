import { test, expect } from "bun:test";
import { runDemo } from "./application.js";
test("independent packed consumer runs real collection and closes every owned resource", async () => {
  const result = await runDemo();
  expect(result.readings).toHaveLength(8);
  expect(new Set(result.readings.map(reading => reading.source))).toEqual(new Set(["timer-10ms", "timer-20ms"]));
  expect(result.readings.every(reading => Number.isFinite(reading.at) && reading.latency >= 0)).toBe(true);
  expect(result.disposerOrder).toEqual(["temporary", "application"]);
  expect(result.runningServicesObserved).toBe(1);
  expect(result.remainingScopes).toBe(0); expect(result.remainingServices).toBe(0);
});
