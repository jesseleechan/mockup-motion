import React from "react";
import { Button, Dialog, DialogContent, Icon, Kbd } from "../../ui";
import { Camera, Terminal, Smartphone, Monitor } from "lucide-react";

interface CaptureHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CaptureHelpModal: React.FC<CaptureHelpModalProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Capture website screenshots"
        description="Guidelines for taking crisp, high-resolution full-page screenshots for MockupMotion."
        className="max-w-lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-xs">
          {/* Option 1: Automated Capture CLI */}
          <div className="p-3.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text)]">
              <Icon icon={Terminal} size={15} className="text-[var(--color-accent)]" />
              <span>Option 1: Playwright Capture CLI (Recommended)</span>
            </div>
            <p className="text-[11px] text-[var(--color-text-2)] leading-relaxed">
              Use our local Playwright capture script to automatically capture desktop (1440 px) and
              mobile (390 px @2×) full-page screenshots without browser extensions or manual
              cropping.
            </p>
            <div className="p-2 rounded bg-black/60 font-mono text-[11px] text-[var(--color-accent)] select-all border border-[var(--color-line)]">
              npm run capture https://your-website.com
            </div>
            <p className="text-[10px] text-[var(--color-text-3)]">
              Outputs desktop.png and mobile.png directly to your project or current directory.
            </p>
          </div>

          {/* Option 2: Chrome DevTools */}
          <div className="p-3.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text)]">
              <Icon icon={Camera} size={15} className="text-[var(--color-accent)]" />
              <span>Option 2: Chrome DevTools (Native & Free)</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-[var(--color-text-2)] leading-relaxed">
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
          </div>

          {/* Recommended Dimensions Guide */}
          <div className="p-3.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] space-y-2">
            <span className="text-xs font-semibold text-[var(--color-text)]">
              Recommended sizes
            </span>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2 rounded border border-[var(--color-line)] bg-[var(--color-panel)] flex items-start gap-2">
                <Icon
                  icon={Monitor}
                  size={14}
                  className="text-[var(--color-text-3)] shrink-0 mt-0.5"
                />
                <div>
                  <div className="text-[11px] font-semibold text-[var(--color-text)]">
                    Desktop browser
                  </div>
                  <div className="text-[10px] text-[var(--color-text-2)]">1440 × auto px</div>
                  <div className="text-[9px] text-[var(--color-text-3)]">@1× or @2× DPR</div>
                </div>
              </div>

              <div className="p-2 rounded border border-[var(--color-line)] bg-[var(--color-panel)] flex items-start gap-2">
                <Icon
                  icon={Smartphone}
                  size={14}
                  className="text-[var(--color-text-3)] shrink-0 mt-0.5"
                />
                <div>
                  <div className="text-[11px] font-semibold text-[var(--color-text)]">
                    Mobile device
                  </div>
                  <div className="text-[10px] text-[var(--color-text-2)]">390 × auto px</div>
                  <div className="text-[9px] text-[var(--color-text-3)]">@2× or @3× DPR</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
