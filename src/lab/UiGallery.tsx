import React, { useState } from "react";
import {
  Button,
  IconButton,
  TooltipProvider,
  Tooltip,
  Kbd,
  Slider,
  ScrubLabel,
  NumberField,
  SegmentedControl,
  Select,
  Switch,
  Tabs,
  TabsList,
  TabsContent,
  Popover,
  PopoverTrigger,
  PopoverContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  Dialog,
  DialogTrigger,
  DialogContent,
  ToastProvider,
  useToast,
  ColorField,
  Section,
  Field,
  ThumbnailCard,
  EmptyState,
  Spinner,
  ProgressBar,
  Divider,
  Icon,
} from "../ui";
import {
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  Settings,
  Download,
  Trash2,
  Copy,
  Moon,
  Sun,
  Camera,
  FolderOpen,
} from "lucide-react";
import "../ui/theme.css";

function GalleryContent() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [sliderVal, setSliderVal] = useState(45);
  const [scrubVal, setScrubVal] = useState(1.8);
  const [numberVal, setNumberVal] = useState(1080);
  const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [switchVal, setSwitchVal] = useState(true);
  const [selectVal, setSelectVal] = useState("smooth");
  const [colorVal, setColorVal] = useState("#7C93FF");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <div
      id="ui-gallery"
      data-theme={theme}
      className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] p-8 font-sans transition-colors duration-180"
    >
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-[var(--color-line)]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
              UI Design System Gallery
            </h1>
            <p className="text-sm text-[var(--color-text-2)] mt-1">
              Interactive review of all MockupMotion UI primitives in {theme} mode.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={toggleTheme}
              icon={<Icon icon={theme === "dark" ? Sun : Moon} size={15} />}
            >
              Theme: {theme === "dark" ? "Dark" : "Light"}
            </Button>
            <Button
              variant="primary"
              onClick={() => toast("Saved changes successfully", { durationMs: 3000 })}
            >
              Trigger Toast
            </Button>
          </div>
        </div>

        {/* 1. Buttons */}
        <div className="p-6 bg-[var(--color-panel)] rounded-lg border border-[var(--color-line)] space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-2)]">
            1. Buttons &amp; Icon Buttons
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary Action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="danger">Danger</Button>
            <Tooltip content="Custom shortcut preview" shortcut="⌘T">
              <Button variant="secondary" size="sm">
                Hover for Tooltip
              </Button>
            </Tooltip>
            <Button variant="secondary" loading>
              Loading
            </Button>
            <Button variant="secondary" disabled>
              Disabled
            </Button>
          </div>
          <Divider />
          <div className="flex items-center gap-3 pt-2">
            <IconButton
              aria-label="Play animation"
              tooltip="Play animation"
              shortcut="Space"
              icon={<Icon icon={Play} size={15} />}
            />
            <IconButton
              aria-label="Settings"
              tooltip="Project Settings"
              shortcut="⌘,"
              icon={<Icon icon={Settings} size={15} />}
            />
            <IconButton
              aria-label="Export video"
              variant="primary"
              tooltip="Export video"
              shortcut="⌘E"
              icon={<Icon icon={Download} size={15} />}
            />
            <IconButton
              aria-label="Reset composition"
              variant="ghost"
              tooltip="Reset defaults"
              icon={<Icon icon={RotateCcw} size={15} />}
            />
            <IconButton
              aria-label="Delete item"
              variant="danger"
              tooltip="Delete layer"
              shortcut="⌫"
              icon={<Icon icon={Trash2} size={15} />}
            />
          </div>
        </div>

        {/* 2. Sliders & ScrubLabel */}
        <div className="p-6 bg-[var(--color-panel)] rounded-lg border border-[var(--color-line)] space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-2)]">
            2. Slider &amp; ScrubLabel
          </h2>
          <div className="max-w-sm space-y-4">
            <div className="space-y-1">
              <ScrubLabel
                label="Camera Intensity"
                value={sliderVal}
                onChange={setSliderVal}
                defaultValue={50}
                min={0}
                max={100}
                step={1}
                unit="%"
              />
              <Slider
                value={sliderVal}
                onChange={setSliderVal}
                min={0}
                max={100}
                step={1}
                aria-label="Camera Intensity"
              />
            </div>

            <div className="space-y-1">
              <ScrubLabel
                label="Transition Shutter"
                value={scrubVal}
                onChange={setScrubVal}
                defaultValue={1.5}
                min={0.1}
                max={5.0}
                step={0.1}
                unit="s"
              />
              <Slider
                value={scrubVal}
                onChange={setScrubVal}
                min={0.1}
                max={5.0}
                step={0.1}
                aria-label="Transition Shutter"
              />
            </div>
          </div>
        </div>

        {/* 3. Inputs & Selectors */}
        <div className="p-6 bg-[var(--color-panel)] rounded-lg border border-[var(--color-line)] space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-2)]">
            3. Inputs, Selectors &amp; Controls
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            <Field label="Resolution">
              <NumberField
                value={numberVal}
                onChange={setNumberVal}
                min={360}
                max={4320}
                step={120}
                unit="px"
                aria-label="Resolution"
              />
            </Field>

            <Field label="Aspect Ratio">
              <SegmentedControl
                value={aspect}
                onChange={setAspect}
                options={[
                  { value: "16:9", label: "16:9" },
                  { value: "9:16", label: "9:16" },
                  { value: "1:1", label: "1:1" },
                ]}
                aria-label="Aspect Ratio"
              />
            </Field>

            <Field label="Easing Curve">
              <Select
                value={selectVal}
                onChange={setSelectVal}
                options={[
                  { value: "gentle", label: "Gentle Ease" },
                  { value: "smooth", label: "Smooth Ease" },
                  { value: "expoOut", label: "Exponential Out" },
                  { value: "spring", label: "Analytic Spring" },
                ]}
                aria-label="Easing Curve"
              />
            </Field>

            <Field label="Motion Blur">
              <Switch
                checked={switchVal}
                onCheckedChange={setSwitchVal}
                aria-label="Enable motion blur"
              />
            </Field>

            <Field label="Background Color">
              <ColorField
                value={colorVal}
                onChange={setColorVal}
                paletteSwatches={[
                  "#0B0B0D",
                  "#121215",
                  "#6366F1",
                  "#7C93FF",
                  "#10B981",
                  "#F59E0B",
                  "#EF4444",
                ]}
                aria-label="Background Color"
              />
            </Field>
          </div>
        </div>

        {/* 4. Menus & Popovers */}
        <div className="p-6 bg-[var(--color-panel)] rounded-lg border border-[var(--color-line)] space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-2)]">
            4. Menus, Popover &amp; Context Menu
          </h2>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" icon={<Icon icon={Settings} size={14} />}>
                  Dropdown Menu
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem icon={<Icon icon={Copy} size={14} />} shortcut="⌘C">
                  Duplicate Shot
                </DropdownMenuItem>
                <DropdownMenuItem icon={<Icon icon={Sparkles} size={14} />}>
                  Auto-frame Camera
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem icon={<Icon icon={Trash2} size={14} />} danger shortcut="⌫">
                  Delete Shot
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="secondary" icon={<Icon icon={Layers} size={14} />}>
                  Open Popover
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 text-sm">
                <div className="font-semibold text-[var(--color-text)] mb-1">Layer Settings</div>
                <div className="text-[12px] text-[var(--color-text-2)] mb-3">
                  Configure framing and parallax depth for this shot layer.
                </div>
                <Button size="sm" variant="primary" className="w-full">
                  Apply Layer
                </Button>
              </PopoverContent>
            </Popover>

            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div className="px-4 py-2 border border-dashed border-[var(--color-line)] rounded-md text-[12px] text-[var(--color-text-2)] cursor-context-menu select-none hover:border-[var(--color-line-strong)]">
                  Right click here for Context Menu
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem icon={<Icon icon={Camera} size={14} />}>
                  Take Snapshot
                </ContextMenuItem>
                <ContextMenuItem icon={<Icon icon={Copy} size={14} />} shortcut="⌘D">
                  Duplicate Node
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem icon={<Icon icon={Trash2} size={14} />} danger>
                  Remove Node
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">Open Modal Dialog</Button>
              </DialogTrigger>
              <DialogContent
                title="Export Video Package"
                description="Encode 1080p Web-Embed Bundle with MP4, WebM, and HTML snippet."
              >
                <div className="space-y-4 py-2">
                  <Field label="Resolution">
                    <Select
                      value="1080p"
                      onChange={() => {}}
                      options={[
                        { value: "720p", label: "720p (Fastest)" },
                        { value: "1080p", label: "1080p (FHD Standard)" },
                        { value: "4k", label: "4K (Ultra HD)" },
                      ]}
                    />
                  </Field>
                  <ProgressBar value={68} aria-label="Export progress" />
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[var(--color-line)]">
                  <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={() => setDialogOpen(false)}>
                    Start export
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* 5. Inspector Section & Cards */}
        <div className="p-6 bg-[var(--color-panel)] rounded-lg border border-[var(--color-line)] space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-2)]">
            5. Inspector Sections &amp; Cards
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border border-[var(--color-line)] rounded-md bg-[var(--color-raised)] overflow-hidden">
              <Section title="Camera Pose" defaultOpen onReset={() => {}}>
                <Field label="Preset">
                  <Select
                    value="orbit"
                    onChange={() => {}}
                    options={[
                      { value: "orbit", label: "Gentle Orbit" },
                      { value: "pushIn", label: "Subtle Push-In" },
                      { value: "isoDrift", label: "Isometric Drift" },
                    ]}
                  />
                </Field>
                <Field label="Distance">
                  <Slider value={75} onChange={() => {}} aria-label="Distance" />
                </Field>
              </Section>
              <Section title="Stage Atmosphere" defaultOpen={false}>
                <Field label="Palette">
                  <ColorField value="#18181B" onChange={() => {}} aria-label="Atmosphere Color" />
                </Field>
              </Section>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <ThumbnailCard
                  title="Aurelia Architecture"
                  badge="Hero"
                  selected
                  imageSrc="/demo/aurelia/desktop-hero.webp"
                  aspectRatio="16:9"
                />
                <ThumbnailCard
                  title="Northwind SaaS"
                  badge="Full"
                  imageSrc="/demo/northwind/desktop-hero.webp"
                  aspectRatio="16:9"
                />
              </div>
              <EmptyState
                icon={FolderOpen}
                title="No custom templates yet"
                description="Save your composition as a reusable template to access it across projects."
                action={<Button size="sm">Create Template</Button>}
              />
            </div>
          </div>
        </div>

        {/* 6. Tabs, Spinners & Progress */}
        <div className="p-6 bg-[var(--color-panel)] rounded-lg border border-[var(--color-line)] space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-2)]">
            6. Tabs, Indicators &amp; Badges
          </h2>
          <Tabs defaultValue="overview">
            <TabsList
              items={[
                { id: "overview", label: "Overview" },
                { id: "layers", label: "Layers (3)" },
                { id: "transitions", label: "Transitions" },
              ]}
            />
            <TabsContent value="overview">
              <div className="flex items-center gap-6 py-2">
                <div className="flex items-center gap-2">
                  <Spinner size="sm" />
                  <span className="text-xs text-[var(--color-text-2)]">Processing frame...</span>
                </div>
                <div className="flex items-center gap-2">
                  <Kbd>Shift</Kbd>
                  <span className="text-xs text-[var(--color-text-2)]">+</span>
                  <Kbd>Space</Kbd>
                  <span className="text-xs text-[var(--color-text-2)]">Loop playback</span>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="layers">
              <div className="text-xs text-[var(--color-text-2)] py-2">Active render layers</div>
            </TabsContent>
            <TabsContent value="transitions">
              <div className="text-xs text-[var(--color-text-2)] py-2">
                Crossfade duration: 0.4s
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function UiGallery() {
  return (
    <TooltipProvider>
      <ToastProvider>
        <GalleryContent />
      </ToastProvider>
    </TooltipProvider>
  );
}
