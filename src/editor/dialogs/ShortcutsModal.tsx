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
  { keys: ["⌘ / Ctrl", "D"], desc: "Duplicate selected shot" },
  { keys: ["Delete / Backspace"], desc: "Remove selected shot or text" },
  { keys: ["["], desc: "Toggle templates & media library" },
  { keys: ["]"], desc: "Toggle contextual inspector" },
  { keys: ["?"], desc: "Show keyboard shortcuts" },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Keyboard shortcuts"
        description="Work faster with keyboard navigation and transport shortcuts."
        className="max-w-md"
      >
        <div className="space-y-2 mt-2 max-h-[60vh] overflow-y-auto pr-1">
          {SHORTCUTS.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-[var(--color-raised)] transition-colors text-xs"
            >
              <span className="text-[var(--color-text)]">{s.desc}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, kIdx) => (
                  <Kbd key={kIdx}>{k}</Kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
