import React from "react";
import { Button, Dialog, DialogContent, Icon, Kbd } from "../../ui";
import { Camera, Terminal, Smartphone, Monitor, type LucideIcon } from "lucide-react";

interface CaptureHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** A way to capture: a paper card, as Layout Stage's slots, with its heading and steps. */
const card = "p-3.5 rounded-[12px] bg-paper shadow-lift-sm space-y-2";
const cardHeading = "flex items-center gap-2 text-[12.5px] font-semibold text-[var(--color-text)]";
const body = "text-[12px] text-[var(--color-text-2)] leading-[1.5]";

const SizeTile: React.FC<{ icon: LucideIcon; name: string; size: string; density: string }> = ({
  icon,
  name,
  size,
  density,
}) => (
  <div className="p-2.5 rounded-[10px] bg-field flex items-start gap-2">
    <Icon icon={icon} size={14} className="text-[var(--color-text-2)] shrink-0 mt-0.5" />
    <div>
      <div className="text-[12px] font-semibold text-[var(--color-text)]">{name}</div>
      <div className="font-num text-[11px] tabular-nums text-[var(--color-text-2)]">{size}</div>
      <div className="text-[11px] text-[var(--color-text-2)]">{density}</div>
    </div>
  </div>
);

export const CaptureHelpModal: React.FC<CaptureHelpModalProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Capture website screenshots"
        description="Two ways to get crisp full-page screenshots of a website."
        className="max-w-lg"
      >
        <div className="space-y-3 max-h-[70vh] overflow-y-auto -m-1 p-1">
          {/* Option 1: the capture command (packages/capture) */}
          <section className={card}>
            <h3 className={cardHeading}>
              <Icon icon={Terminal} size={15} className="text-[var(--color-text-2)]" />
              Capture command (recommended)
            </h3>
            <p className={body}>
              Run this in the MockupMotion repository. It needs Node.js 20 or later.
            </p>
            <div className="px-2.5 py-2 rounded-[8px] bg-field font-num text-[11.5px] text-[var(--color-text)] select-all">
              npm run capture https://your-website.com
            </div>
            <p className={body}>
              It writes a <span className="font-num">captures</span> folder with desktop and mobile
              full-page screenshots and their section data. Drop the folder onto the editor to
              import everything at once.
            </p>
          </section>

          {/* Option 2: Chrome DevTools */}
          <section className={card}>
            <h3 className={cardHeading}>
              <Icon icon={Camera} size={15} className="text-[var(--color-text-2)]" />
              Chrome DevTools
            </h3>
            <ol className={`list-decimal list-inside space-y-1.5 ${body}`}>
              <li>Open your website in Google Chrome or Arc.</li>
              <li>
                Press <Kbd>F12</Kbd> or <Kbd>Cmd/Ctrl + Option + I</Kbd> to open DevTools.
              </li>
              <li>
                Toggle device mode (<Kbd>Cmd/Ctrl + Shift + M</Kbd>) to pick desktop (1440 px) or
                mobile (390 px).
              </li>
              <li>
                Press <Kbd>Cmd/Ctrl + Shift + P</Kbd> to open the Command Menu.
              </li>
              <li>
                Type{" "}
                <span className="font-semibold text-[var(--color-text)]">
                  Capture full size screenshot
                </span>{" "}
                and hit Enter.
              </li>
            </ol>
          </section>

          {/* Recommended dimensions */}
          <section className={card}>
            <h3 className={cardHeading}>Recommended sizes</h3>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <SizeTile
                icon={Monitor}
                name="Desktop browser"
                size="1440 × auto px"
                density="@1× or @2× DPR"
              />
              <SizeTile
                icon={Smartphone}
                name="Mobile device"
                size="390 × auto px"
                density="@2× or @3× DPR"
              />
            </div>
          </section>
        </div>

        <div className="flex justify-end pt-5">
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
