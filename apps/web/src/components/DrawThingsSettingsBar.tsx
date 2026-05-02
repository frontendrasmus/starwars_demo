import type { DrawThingsSettings } from "./Chat.js";

/**
 * Sub-toolbar shown directly below the main header when a Draw Things
 * model is selected. Lets the user tweak generation knobs without
 * leaving the chat. Settings are forwarded as headers on the next
 * /api/chat request — see Chat.tsx → ChatInner.
 */

const SIZE_OPTIONS = [256, 384, 512, 640, 768, 1024];
const STEPS_MIN = 1;
const STEPS_MAX = 30;

interface Props {
  settings: DrawThingsSettings;
  onChange: (next: DrawThingsSettings) => void;
}

export function DrawThingsSettingsBar({ settings, onChange }: Props) {
  const update = <K extends keyof DrawThingsSettings>(
    key: K,
    value: DrawThingsSettings[K],
  ) => onChange({ ...settings, [key]: value });

  return (
    <div className="dt-settings" role="group" aria-label="Draw Things settings">
      <span className="dt-settings-label">Draw Things settings</span>

      <label className="dt-field">
        <span>Steps</span>
        <input
          type="range"
          min={STEPS_MIN}
          max={STEPS_MAX}
          value={settings.steps}
          onChange={(e) => update("steps", Number(e.target.value))}
        />
        <span className="dt-field-value">{settings.steps}</span>
      </label>

      <label className="dt-field">
        <span>Width</span>
        <select
          value={settings.width}
          onChange={(e) => update("width", Number(e.target.value))}
        >
          {SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>
      </label>

      <label className="dt-field">
        <span>Height</span>
        <select
          value={settings.height}
          onChange={(e) => update("height", Number(e.target.value))}
        >
          {SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>
      </label>

      <span className="dt-settings-hint">
        More steps = better quality, longer wait. Defaults are tuned for the demo.
      </span>
    </div>
  );
}
