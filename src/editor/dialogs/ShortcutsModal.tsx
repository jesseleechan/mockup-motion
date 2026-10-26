import React from "react";
import { Dialog, DialogContent, Kbd } from "../../ui";

interface ShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS = [
  { keys: ["Space"], desc: "Play / Pause playback" },
  { keys: ["←", "→"], desc: "Step 1 frame backward / forward" },
  { keys: ["Shift", "← / →"], desc: "Step 1 second backward / forward" },
  { keys: ["Home", "End"], desc: "Jump to start / end of timeline" },
  { keys: ["⌘ / Ctrl", "Z"], desc: "Undo last edit" },
  { keys: ["⇧", "⌘ / Ctrl", "Z"], desc: "Redo last undone edit" },
  { keys: ["⌘ / Ctrl", "E"], desc: "Open export video dialog" },
  { keys: ["⌘ / Ctrl", "V"], desc: "Paste a screenshot into the library" },
  { keys: ["["], desc: "Toggle library" },
  { keys: ["]"], desc: "Toggle contextual inspector" },
  { keys: ["?"], desc: "Show keyboard shortcuts" },
];

/** The shortcuts as Layout Stage's hints: what each does, and its keys as field chips. */
export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Keyboard shortcuts"
        description="Work faster with keyboard navigation and transport shortcuts."
        className="max-w-md"
      >
        <dl className="-mx-2 max-h-[60vh] overflow-y-auto divide-y divide-[var(--color-line)]">
          {SHORTCUTS.map((s) => (
            <div key={s.desc} className="flex items-center justify-between gap-4 h-9 px-2">
              <dt className="min-w-0 text-[12.5px] text-[var(--color-text)]">{s.desc}</dt>
              <dd className="m-0 flex shrink-0 items-center gap-1">
                {s.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
};
