import type { KeyboardFence } from "./journey-matrix";
import type { KeyboardGuard } from "./keyboard-guard";
import {
  fenceProblems,
  focusProblems,
  installLiveCounter,
  liveProblems,
  noWriteProblems,
  reflow360Problems,
  runStep,
  settleLive,
  type FocusRule,
  type KeyStep,
} from "./keyboard-probes";

/** One keyboard-only drive to one BROWSER outcome cell. Declarative: a drive never touches the page itself. */
export interface KeyboardDrive {
  checkId: string;
  /** Full load at this path, then keys only. */
  path: string;
  /** Keys before the trigger. */
  setup: readonly KeyStep[];
  /** Keys that produce the outcome. The last step is a key press or text entry; the announcement counter starts right before it. */
  trigger: readonly KeyStep[];
  /** Absent before the final key, present after it. */
  outcome: string;
  /** Additional terminal evidence, checked after the outcome transition. */
  terminal?: readonly string[];
  absentAfter?: readonly string[];
  /** The status the focus rule refers to. Defaults to `outcome`. */
  status?: string;
  focus: FocusRule;
  /** REJECT/UNKNOWN with a next-write control: the control that must be fenced with a described reason. */
  fence?: string;
  /** REJECT/UNKNOWN on a NO_WRITE screen: write selectors that must be absent (besides any send-style button). */
  noWrite?: readonly string[];
  /**
   * After the outcome: keys that press the fenced control again. The refusal adds no announcement (its reason is already
   * described) and `holds` still matches, so nothing moved.
   */
  refusal?: { keys: readonly KeyStep[]; holds: string };
}

export interface DriveResult {
  problems: string[];
  announcements: number;
  focusWhere: string;
  typedFields: number;
  /** Failure detail only; holds DOM excerpts and is never written to a record. */
  liveLog: string[];
}

export const VIEW = { width: 1280, height: 800 } as const;

export async function runDrive(guard: KeyboardGuard, origin: string, drive: KeyboardDrive, fence: KeyboardFence): Promise<DriveResult> {
  const { page } = guard;
  const problems: string[] = [];
  let typedFields = 0;
  await page.setViewportSize(VIEW);
  await page.goto(origin + drive.path);
  await page.locator("#desk-main > :not([data-screen-loading])").first().waitFor();
  for (const step of drive.setup) {
    typedFields += await runStep(page, step);
  }
  const last = drive.trigger[drive.trigger.length - 1];
  if (!last || !("press" in last || "type" in last)) {
    throw new Error(`${drive.checkId}: the trigger must end with a key press or text entry`);
  }
  for (const step of drive.trigger.slice(0, -1)) {
    typedFields += await runStep(page, step);
  }
  if ((await page.locator(drive.outcome).count()) > 0) {
    problems.push("outcome.present-before-trigger");
  }
  const trigger = await page.evaluateHandle(() => document.activeElement);
  await installLiveCounter(page);
  const startedAt = Date.now();
  typedFields += await runStep(page, last);
  await page.locator(drive.outcome).first().waitFor({ timeout: 10_000 });
  for (const selector of drive.terminal ?? []) {
    await page.locator(selector).first().waitFor({ timeout: 10_000 });
  }
  for (const selector of drive.absentAfter ?? []) {
    if (await page.locator(selector).count() > 0) problems.push(`terminal.unexpected:${selector}`);
  }
  const live = await settleLive(page, startedAt);
  problems.push(...liveProblems(live));
  const focus = await focusProblems(page, drive.focus, drive.status ?? drive.outcome, trigger);
  problems.push(...focus.problems);
  if (fence === "FENCED") {
    problems.push(...(drive.fence ? await fenceProblems(page, drive.fence) : ["fence.selector-missing"]));
  } else if (fence === "NO_WRITE") {
    problems.push(...(drive.noWrite ? await noWriteProblems(page, drive.noWrite) : ["no-write.selectors-missing"]));
  }
  if (drive.refusal) {
    const keys = drive.refusal.keys;
    for (const step of keys.slice(0, -1)) {
      typedFields += await runStep(page, step);
    }
    await installLiveCounter(page);
    const pressedAt = Date.now();
    const final = keys[keys.length - 1];
    if (final) typedFields += await runStep(page, final);
    const quiet = await settleLive(page, pressedAt);
    if (quiet.count !== 0) problems.push(`refusal.announcements-${quiet.count}`);
    if ((await page.locator(drive.refusal.holds).count()) === 0) problems.push("refusal.state-moved");
  }
  problems.push(...(await reflow360Problems(page)));
  await trigger.dispose();
  return { problems, announcements: live.count, focusWhere: focus.where, typedFields, liveLog: live.log };
}
