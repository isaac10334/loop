import { runDemo } from "./application.js";
const button = document.querySelector<HTMLButtonElement>("#run")!;
const status = document.querySelector<HTMLElement>("#status")!;
const report = document.querySelector<HTMLElement>("#report")!;
button.addEventListener("click", async () => {
  button.disabled = true; status.textContent = "Collecting timer readings…";
  try { const result = await runDemo(); report.textContent = JSON.stringify(result, null, 2); status.textContent = "Passed: 8 readings, shared journal, replacement, cancellation and cleanup"; }
  catch (error) { console.error(error); status.textContent = "Failed"; report.textContent = String(error); }
  finally { button.disabled = false; }
});
