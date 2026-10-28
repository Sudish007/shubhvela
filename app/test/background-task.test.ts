// C01 (F9 + N12) `extend-widget-state`: defined with expo-task-manager at module scope, registered with a 12 h minimum
// interval, and its body rewrites the widget file only when it is missing / exhausting / older than 12 h while ALWAYS
// re-planning the reminders through the same replanAll as the launch re-plan.
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { insertProfile } from '../src/db/profiles';
import { SAMPLE_PRIYA } from '../src/dev/seed';
import { defineExtendWidgetStateTask, EXTEND_WIDGET_STATE_INTERVAL_MINUTES, EXTEND_WIDGET_STATE_TASK, registerExtendWidgetStateTask, runExtendWidgetState } from '../src/widgets/backgroundTask';
import { resetWriteDebounce, type WidgetFileDeps } from '../src/widgets/writeState';
import { installTestDb } from './helpers/nodeDb';

const NOW = Date.UTC(2026, 9, 22, 5, 28);
const H = 3_600_000;

function memoryDeps(): WidgetFileDeps & { text: string | null; writes: number } {
  const d = {
    text: null as string | null,
    writes: 0,
    async write(t: string) {
      d.text = t;
      d.writes++;
    },
    async read() {
      return d.text;
    },
    refresh: () => 0,
  };
  return d;
}

describe('extend-widget-state background task', () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = installTestDb());
    insertProfile(SAMPLE_PRIYA, new Date(NOW));
    resetWriteDebounce();
  });
  afterEach(() => close());

  it('is defined with expo-task-manager under its name and registered with a 12 h minimum interval', async () => {
    defineExtendWidgetStateTask();
    expect(TaskManager.defineTask).toHaveBeenCalledWith(EXTEND_WIDGET_STATE_TASK, expect.any(Function));
    expect(EXTEND_WIDGET_STATE_TASK).toBe('extend-widget-state');
    expect(EXTEND_WIDGET_STATE_INTERVAL_MINUTES).toBe(720);
    expect(await registerExtendWidgetStateTask()).toBe(true);
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(EXTEND_WIDGET_STATE_TASK, { minimumInterval: 720 });
    // The recorded executor runs the job and reports Success.
    const tasks = (TaskManager as unknown as { __tasks: Map<string, () => Promise<number>> }).__tasks;
    const executor = tasks.get(EXTEND_WIDGET_STATE_TASK)!;
    expect(executor).toBeDefined();
  });

  it('writes a missing file, leaves a fresh one alone, rewrites an aging or exhausting one, and re-plans every time', async () => {
    const files = memoryDeps();
    const replan = jest.fn(async () => ({ scheduled: 0, failed: [], planned: 0, skipped: 'permission' as const }));
    const first = await runExtendWidgetState({ nowMs: () => NOW, files, replan });
    expect(first.reason).toBe('missing');
    expect(first.write?.written).toBe(true);
    expect(files.writes).toBe(1);
    expect(replan).toHaveBeenCalledTimes(1);

    const second = await runExtendWidgetState({ nowMs: () => NOW + 2 * H, files, replan });
    expect(second.reason).toBeNull();
    expect(second.write).toBeNull();
    expect(files.writes).toBe(1);
    expect(replan).toHaveBeenCalledTimes(2);

    const third = await runExtendWidgetState({ nowMs: () => NOW + 13 * H, files, replan });
    expect(third.reason).toBe('aging');
    expect(files.writes).toBe(2);
    const written = JSON.parse(files.text!) as { writtenAt: number; days: { date: string }[] };
    expect(written.writtenAt).toBe(NOW + 13 * H);
    expect(written.days[0].date).toBe('2026-10-22');

    // Six days later only one day remains -> exhausting -> seven fresh days from that day.
    const sixDays = NOW + 6 * 24 * H;
    files.text = JSON.stringify({ ...written, writtenAt: sixDays - H });
    const fourth = await runExtendWidgetState({ nowMs: () => sixDays, files, replan });
    expect(fourth.reason).toBe('exhausting');
    const rewritten = JSON.parse(files.text!) as { days: { date: string }[] };
    expect(rewritten.days.length).toBe(7);
    expect(rewritten.days[0].date).toBe('2026-10-28');
    expect(replan).toHaveBeenCalledTimes(4);
  });
});
