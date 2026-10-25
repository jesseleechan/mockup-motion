import React from "react";
import { PanelRightClose } from "lucide-react";
import { useUIStore } from "../../state/ui-store";
import { useEditorStore } from "../../state/store";
import { Icon, IconButton, Tabs, TabsContent, TabsList } from "../../ui";
import { VideoInspector } from "./VideoInspector";
import { ShotInspector } from "./ShotInspector";

/**
 * Video and Shot as a segmented tab at the top of the panel, as Layout Stage's .tabs, which stays
 * in place while the sections scroll under it. The tab follows the selection: selecting the shot
 * on the stage or in the toolbar opens Shot, and the Shot tab selects the video's shot.
 */
export const InspectorPanel: React.FC = () => {
  const selection = useUIStore((s) => s.selection);
  const togglePanel = useUIStore((s) => s.togglePanel);
  const setSelection = useUIStore((s) => s.setSelection);
  // A document has one shot (multi-shot reels were cut on 19 Oct 2026).
  const shotId = useEditorStore((s) => s.doc.shots[0]?.id);

  const pick = (tab: string) => {
    if (tab === "video") setSelection({ kind: "video" });
    else if (tab === "shot" && shotId) setSelection({ kind: "shot", id: shotId });
  };

  return (
    <aside
      data-panel="inspector"
      aria-label="Inspector"
      className="w-full min-w-0 bg-[var(--color-panel)] rounded-[18px] shadow-lift flex flex-col select-none overflow-hidden"
    >
      <Tabs value={selection.kind} onValueChange={pick} className="flex-1 min-h-0 flex flex-col">
        <div className="shrink-0 flex items-center gap-1 px-2 pt-2 pb-1.5">
          {/* Layout Stage's panel tabs are a size up from its other segmented controls. */}
          <TabsList
            className="flex-1 min-w-0 *:h-[34px] *:text-[13.5px]"
            items={[
              { id: "video", label: "Video" },
              { id: "shot", label: "Shot", disabled: !shotId },
            ]}
          />
          <IconButton
            aria-label="Collapse inspector panel"
            tooltip="Collapse inspector"
            shortcut="]"
            icon={<Icon icon={PanelRightClose} size={16} />}
            onClick={() => togglePanel("inspector")}
          />
        </div>

        {/* TabsContent pads its top by default; here the first section's own padding does it. */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3">
          <TabsContent value="video" className="pt-0!">
            <VideoInspector />
          </TabsContent>
          <TabsContent value="shot" className="pt-0!">
            {selection.kind === "shot" && <ShotInspector shotId={selection.id} />}
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  );
};
