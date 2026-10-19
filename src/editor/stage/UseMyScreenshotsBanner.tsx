import React, { useMemo, useState } from "react";
import { Images, X } from "lucide-react";
import { Button, Icon, useToast } from "../../ui";
import { useEditorStore } from "../../state/store";
import { applyDemoSwap, planDemoSwap } from "../demo-swap";

/**
 * Offered while demo screenshots are on screen and the library has uploads that can take their
 * place: one click swaps them, in one undo step.
 */
export const UseMyScreenshotsBanner: React.FC = () => {
  const doc = useEditorStore((s) => s.doc);
  const apply = useEditorStore((s) => s.apply);
  const { toast } = useToast();
  const plan = useMemo(() => planDemoSwap(doc), [doc]);
  // Dismissing hides the offer for these uploads; a new upload brings it back.
  const offer = [...plan.replacements].map(([demo, upload]) => `${demo}>${upload}`).join(",");
  const [dismissed, setDismissed] = useState("");

  if (plan.replacements.size === 0 || dismissed === offer) return null;

  const useMine = () => {
    apply((draft) => applyDemoSwap(draft, plan.replacements), { label: "Use my screenshots" });
    if (plan.remaining > 0) {
      const noun = plan.remaining === 1 ? "demo screenshot stays" : "demo screenshots stay";
      toast(`${plan.remaining} ${noun} until you add more of your own.`);
    }
  };

  return (
    <div className="absolute bottom-6 inset-x-0 z-20 flex justify-center pointer-events-none px-4">
      <section
        data-testid="use-my-screenshots"
        aria-label="Use my screenshots"
        className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] pl-4 pr-2 py-2.5 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
      >
        <p className="text-xs font-medium text-[var(--color-text)]">
          Your screenshots are in the library.
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="primary"
            size="sm"
            onClick={useMine}
            icon={<Icon icon={Images} size={14} />}
          >
            Use my screenshots
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Keep the demo screenshots"
            onClick={() => setDismissed(offer)}
            icon={<Icon icon={X} size={14} />}
          />
        </div>
      </section>
    </div>
  );
};
