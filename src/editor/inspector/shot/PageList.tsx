import React, {
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import clsx from "clsx";
import { Plus, Upload, X } from "lucide-react";
import { validateAndDecodeAsset } from "../../../assets/decode";
import type { AssetRef, Layout } from "../../../doc/types";
import { setPageScreenshot, type PageSide } from "../../../doc/tour-pages";
import { useEditorStore } from "../../../state/store";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  Tooltip,
  useToast,
} from "../../../ui";
import { useAssetUrls } from "../../assets/useAssetUrls";
import { PageSideThumb } from "./PageSideThumb";
import { Thumb } from "./ScreenshotList";
import { assetDropProps, useShotUpdate } from "./useShotUpdate";

type ResponsiveTourLayout = Extract<Layout, { kind: "responsive-tour" }>;

const PAGE_DRAG_TYPE = "application/x-mockup-tour-page";

interface PageListProps {
  shotId: string;
  shotIndex: number;
  layout: ResponsiveTourLayout;
  images: AssetRef[];
  /** How many pages the tour shows; later rows are dimmed. */
  shown: number;
  /** The fewest pages the tour needs; Remove is disabled at this count. */
  minimum: number;
}

/**
 * A Responsive Tour's pages in order (presets round two, D12): each row is a page, its desktop
 * and its mobile screenshot side by side. Drag (or Alt+↑ / Alt+↓) to reorder a page, X to remove
 * it, a thumbnail to change that side, and Add screenshot to put a screenshot on its size's side
 * of its page, else of a page without one (`addPageScreenshot`, src/doc/tour-pages.ts).
 */
export const PageList: React.FC<PageListProps> = ({
  shotId,
  shotIndex,
  layout,
  images,
  shown,
  minimum,
}) => {
  const update = useShotUpdate(shotId);
  const addAssetToShot = useEditorStore((s) => s.addAssetToShot);
  const removeAssetFromShot = useEditorStore((s) => s.removeAssetFromShot);
  const moveAssetInShot = useEditorStore((s) => s.moveAssetInShot);
  const addScreenshotsToShot = useEditorStore((s) => s.addScreenshotsToShot);
  const { toast } = useToast();
  const urls = useAssetUrls(images);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dropGap, setDropGap] = useState<number | null>(null);
  // React reorders a moved row's element, which drops its focus; a keyboard move puts it back.
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const refocusKey = useRef<string | null>(null);

  const pages = layout.desktopIds.map((desktopId, i) => ({
    desktopId,
    mobileId: layout.mobileIds[i] ?? "",
  }));
  // A page's screenshots name it: each side holds a screenshot at most once.
  const keyOf = (page: (typeof pages)[number]) => `${page.desktopId}|${page.mobileId}`;
  // Either screenshot stands for its page in the store's page actions.
  const idOf = (page: (typeof pages)[number]) => page.desktopId || page.mobileId;

  useLayoutEffect(() => {
    const key = refocusKey.current;
    refocusKey.current = null;
    if (key) rowRefs.current.get(key)?.focus();
  }, [layout]);

  const atMinimum = pages.length <= minimum;
  const minimumReason = `Needs at least ${minimum} pages`;
  const nameOf = (id: string) => images.find((a) => a.id === id)?.name;
  const inTour = new Set([...layout.desktopIds, ...layout.mobileIds]);
  const available = images.filter((a) => !inTour.has(a.id));
  const sideChoices = (side: PageSide, current: string) => {
    const onSide = new Set(side === "mobile" ? layout.mobileIds : layout.desktopIds);
    return images.filter(
      (a) =>
        (a.role === "mobile") === (side === "mobile") && (a.id === current || !onSide.has(a.id)),
    );
  };
  const setSide = (index: number, side: PageSide, assetId: string) =>
    update(
      (target) => {
        if (target.layout.kind === "responsive-tour") {
          setPageScreenshot(target.layout, index, side, assetId);
        }
      },
      { label: `Change page ${index + 1}'s ${side} screenshot` },
    );
  const add = (assetId: string) => {
    if (assetId) addAssetToShot(shotIndex, assetId);
  };

  const handleUpload = async (files: File[]) => {
    const refs: AssetRef[] = [];
    const blobs: Record<string, Blob> = {};
    for (const file of files) {
      try {
        const result = await validateAndDecodeAsset(file, file.name);
        refs.push(result.ref);
        blobs[result.ref.id] = result.blob;
      } catch (err) {
        toast(err instanceof Error ? err.message : `${file.name}: this image couldn't be read.`);
      }
    }
    if (refs.length > 0) await addScreenshotsToShot(shotIndex, refs, blobs);
  };

  const gapAt = (e: DragEvent<HTMLLIElement>, index: number) => {
    const box = e.currentTarget.getBoundingClientRect();
    return e.clientY < box.top + box.height / 2 ? index : index + 1;
  };

  const handleDrop = (e: DragEvent, gap: number) => {
    const from = Number(e.dataTransfer.getData(PAGE_DRAG_TYPE) || NaN);
    setDropGap(null);
    if (!Number.isInteger(from) || !pages[from]) return;
    e.preventDefault();
    // Stop the list's Media drop handler from treating it as a new screenshot.
    e.stopPropagation();
    moveAssetInShot(shotIndex, idOf(pages[from]), gap > from ? gap - 1 : gap);
  };

  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    refocusKey.current = keyOf(pages[index]);
    moveAssetInShot(shotIndex, idOf(pages[index]), index + (e.key === "ArrowUp" ? -1 : 1));
  };

  return (
    <div className="flex flex-col gap-2" {...assetDropProps(add)}>
      <ol
        aria-label="Tour pages"
        className="flex flex-col gap-1.5"
        onDragLeave={() => setDropGap(null)}
      >
        {pages.map((page, i) => {
          const dimmed = i >= shown;
          const desktopName = nameOf(page.desktopId);
          const mobileName = nameOf(page.mobileId);
          const pageName = `Page ${i + 1}`;
          return (
            <li
              key={keyOf(page)}
              ref={(el) => {
                if (el) rowRefs.current.set(keyOf(page), el);
                else rowRefs.current.delete(keyOf(page));
              }}
              draggable
              tabIndex={0}
              aria-label={pageName}
              aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
              data-page-row=""
              onDragStart={(e) => {
                e.dataTransfer.setData(PAGE_DRAG_TYPE, String(i));
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setDropGap(null)}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(PAGE_DRAG_TYPE)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDropGap(gapAt(e, i));
              }}
              onDrop={(e) => handleDrop(e, gapAt(e, i))}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={clsx(
                "relative grid grid-cols-[14px_48px_14px_minmax(0,1fr)_auto] items-center gap-2 py-[5px] pl-1.5 pr-[5px]",
                "rounded-[12px] bg-paper shadow-lift-sm hover:shadow-lift-sm-hover transition-shadow duration-120",
                "text-[12.5px] cursor-grab active:cursor-grabbing",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                dropGap === i &&
                  "before:absolute before:inset-x-2 before:-top-1 before:h-0.5 before:rounded-full before:bg-accent",
                dropGap === i + 1 &&
                  i === pages.length - 1 &&
                  "after:absolute after:inset-x-2 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-accent",
              )}
            >
              <span
                aria-hidden
                className="font-num text-[11px] font-medium text-center text-text-2"
              >
                {i + 1}
              </span>
              <PageSideThumb
                side="desktop"
                page={i + 1}
                assetId={page.desktopId}
                images={images}
                urls={urls}
                dimmed={dimmed}
                choices={sideChoices("desktop", page.desktopId)}
                onChange={(id) => setSide(i, "desktop", id)}
              />
              <PageSideThumb
                side="mobile"
                page={i + 1}
                assetId={page.mobileId}
                images={images}
                urls={urls}
                dimmed={dimmed}
                choices={sideChoices("mobile", page.mobileId)}
                onChange={(id) => setSide(i, "mobile", id)}
              />
              <span className="min-w-0 flex flex-col leading-4" data-truncate="">
                <span
                  className={clsx(
                    "truncate font-semibold",
                    dimmed || !desktopName ? "text-text-2" : "text-text",
                  )}
                  title={desktopName}
                >
                  {desktopName ?? "No desktop screenshot"}
                </span>
                <span className="truncate text-[11px] text-text-2" title={mobileName}>
                  {mobileName ?? "No mobile screenshot"}
                </span>
              </span>
              {atMinimum ? (
                // aria-disabled, not disabled, so the reason shows on hover and focus.
                <Tooltip content={minimumReason}>
                  <IconButton
                    size="xs"
                    aria-label={`Remove ${pageName.toLowerCase()}`}
                    aria-disabled
                    aria-description={minimumReason}
                    className="opacity-40 cursor-not-allowed"
                    icon={<Icon icon={X} size={12} />}
                  />
                </Tooltip>
              ) : (
                <IconButton
                  size="xs"
                  aria-label={`Remove ${pageName.toLowerCase()}`}
                  icon={<Icon icon={X} size={12} />}
                  onClick={() => removeAssetFromShot(shotIndex, idOf(page))}
                />
              )}
            </li>
          );
        })}
      </ol>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            icon={<Icon icon={Plus} size={14} />}
          >
            Add screenshot
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 overflow-y-auto"
        >
          {available.map((asset) => (
            <DropdownMenuItem key={asset.id} onSelect={() => add(asset.id)} title={asset.name}>
              <span className="flex items-center gap-2 min-w-0">
                <Thumb url={urls[asset.id]} asset={asset} />
                <span className="truncate">{asset.name}</span>
              </span>
            </DropdownMenuItem>
          ))}
          {available.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem
            icon={<Icon icon={Upload} size={14} />}
            onSelect={() => fileInputRef.current?.click()}
          >
            Upload…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/avif"
        aria-label="Upload screenshots to this shot"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          handleUpload(files).catch((err: unknown) => {
            toast(err instanceof Error ? err.message : "These screenshots couldn't be added.");
          });
        }}
      />

      {pages.length > shown && (
        <p className="text-[11px] leading-4 text-text-2">
          Shows the first {shown} pages, so the loop fits in 30 s.
        </p>
      )}
      <p className="text-[11px] leading-4 text-text-2">
        Each page pairs a desktop and a mobile screenshot. A screenshot joins its page by URL or
        file name, else a page without one of its size. Drag to reorder.
      </p>
    </div>
  );
};
