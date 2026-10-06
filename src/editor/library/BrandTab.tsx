import React, { useEffect, useState } from "react";
import { Button, ColorField, Field, Icon, Switch } from "../../ui";
import { useEditorStore } from "../../state/store";
import {
  type BrandKit,
  deleteBrandKit,
  listBrandKits,
  saveBrandKit,
  setDefaultBrandKit,
} from "../../storage/brand-kits";
import { Plus, Sparkles, Trash2 } from "lucide-react";

const BUILTIN_FONTS = [
  "Inter",
  "Instrument Serif",
  "Fraunces",
  "Geist",
  "DM Sans",
  "DM Serif Display",
  "Space Grotesk",
];

const DEFAULT_KIT: BrandKit = {
  id: "default-kit",
  name: "Studio default",
  colors: ["#FFFFFF", "#6366F1", "#1E1E24", "#F4F4F5", "#3B82F6", "#10B981"],
  fontDisplay: "Inter",
  fontBody: "Inter",
  browserUrl: "acme.design",
  isDefault: true,
  updatedAt: Date.now(),
};

export const BrandTab: React.FC = () => {
  const doc = useEditorStore((s) => s.doc);
  const applyBrandKit = useEditorStore((s) => s.applyBrandKit);

  const [kits, setKits] = useState<BrandKit[]>([]);
  const [selectedKitId, setSelectedKitId] = useState<string>("default-kit");
  const [activeKit, setActiveKit] = useState<BrandKit>(DEFAULT_KIT);
  const [_loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const list = await listBrandKits();
        if (!active) return;
        if (list.length === 0) {
          await saveBrandKit(DEFAULT_KIT);
          if (active) {
            setKits([DEFAULT_KIT]);
            setActiveKit(DEFAULT_KIT);
            setSelectedKitId(DEFAULT_KIT.id);
          }
        } else {
          setKits(list);
          const def = list.find((k) => k.isDefault) ?? list[0];
          setActiveKit(def);
          setSelectedKitId(def.id);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleSelectKit = (id: string) => {
    setSelectedKitId(id);
    const found = kits.find((k) => k.id === id);
    if (found) setActiveKit(found);
  };

  const handleUpdateKit = async (patch: Partial<BrandKit>) => {
    const updated = { ...activeKit, ...patch, updatedAt: Date.now() };
    setActiveKit(updated);
    setKits((prev) => prev.map((k) => (k.id === updated.id ? updated : k)));
    await saveBrandKit(updated);
  };

  const handleCreateNewKit = async () => {
    const newKit: BrandKit = {
      id: crypto.randomUUID(),
      name: `Brand kit ${kits.length + 1}`,
      colors: ["#FFFFFF", "#6366F1", "#141417"],
      fontDisplay: "Inter",
      fontBody: "Inter",
      browserUrl: "studio.design",
      isDefault: false,
      updatedAt: Date.now(),
    };
    await saveBrandKit(newKit);
    setKits((prev) => [...prev, newKit]);
    setActiveKit(newKit);
    setSelectedKitId(newKit.id);
  };

  const handleDeleteKit = async () => {
    if (kits.length <= 1) return;
    if (confirm(`Delete brand kit "${activeKit.name}"?`)) {
      await deleteBrandKit(activeKit.id);
      const remaining = kits.filter((k) => k.id !== activeKit.id);
      setKits(remaining);
      setActiveKit(remaining[0]);
      setSelectedKitId(remaining[0].id);
    }
  };

  const handleApply = () => {
    applyBrandKit(activeKit);
  };

  const logoAssets = doc.assets.filter((a) => a.role === "logo" || a.kind === "image");

  return (
    <div className="flex-1 flex flex-col min-h-0 px-3 pt-2 overflow-y-auto space-y-4 pb-6 text-xs select-none">
      {/* Kit Selector & Add */}
      <div className="flex items-center gap-1.5">
        <select
          value={selectedKitId}
          onChange={(e) => handleSelectKit(e.target.value)}
          className="flex-1 h-8 px-2 rounded border border-[var(--color-line)] bg-[var(--color-raised)] text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
        >
          {kits.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name} {k.isDefault ? "★" : ""}
            </option>
          ))}
        </select>

        <button
          type="button"
          title="New brand kit"
          onClick={handleCreateNewKit}
          className="p-2 rounded bg-[var(--color-raised)] hover:bg-[var(--color-hover)] text-[var(--color-text)] border border-[var(--color-line)] transition-colors cursor-pointer"
        >
          <Icon icon={Plus} size={14} />
        </button>

        {kits.length > 1 && (
          <button
            type="button"
            title="Delete brand kit"
            onClick={handleDeleteKit}
            className="p-2 rounded bg-[var(--color-raised)] hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)] text-[var(--color-text-3)] border border-[var(--color-line)] transition-colors cursor-pointer"
          >
            <Icon icon={Trash2} size={14} />
          </button>
        )}
      </div>

      {/* Kit Details */}
      <div className="space-y-3">
        <Field label="Name" htmlFor="kit-name">
          <input
            id="kit-name"
            type="text"
            value={activeKit.name}
            onChange={(e) => handleUpdateKit({ name: e.target.value })}
            className="w-full h-8 px-2.5 rounded border border-[var(--color-line)] bg-[var(--color-raised)] text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          />
        </Field>

        {/* Colors (up to 6) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-[var(--color-text-2)]">
            Colors ({activeKit.colors.length}/6)
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {activeKit.colors.map((color, idx) => (
              <ColorField
                key={idx}
                value={color}
                onChange={(c) => {
                  const updatedColors = [...activeKit.colors];
                  updatedColors[idx] = c;
                  handleUpdateKit({ colors: updatedColors });
                }}
              />
            ))}
            {activeKit.colors.length < 6 && (
              <button
                type="button"
                onClick={() => {
                  handleUpdateKit({ colors: [...activeKit.colors, "#6366F1"] });
                }}
                className="w-7 h-7 rounded border border-dashed border-[var(--color-line)] flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:border-[var(--color-line-strong)] cursor-pointer"
              >
                <Icon icon={Plus} size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Typography */}
        <div className="space-y-2">
          <Field label="Display font">
            <select
              value={activeKit.fontDisplay || "Inter"}
              onChange={(e) => handleUpdateKit({ fontDisplay: e.target.value })}
              className="w-full h-8 px-2 rounded border border-[var(--color-line)] bg-[var(--color-raised)] text-xs text-[var(--color-text)] outline-none"
            >
              {BUILTIN_FONTS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Body font">
            <select
              value={activeKit.fontBody || "Inter"}
              onChange={(e) => handleUpdateKit({ fontBody: e.target.value })}
              className="w-full h-8 px-2 rounded border border-[var(--color-line)] bg-[var(--color-raised)] text-xs text-[var(--color-text)] outline-none"
            >
              {BUILTIN_FONTS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Default Website URL */}
        <Field label="Default URL" htmlFor="kit-url">
          <input
            id="kit-url"
            type="text"
            value={activeKit.browserUrl || ""}
            placeholder="e.g. acme.com"
            onChange={(e) => handleUpdateKit({ browserUrl: e.target.value })}
            className="w-full h-8 px-2.5 rounded border border-[var(--color-line)] bg-[var(--color-raised)] text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          />
        </Field>

        {/* Logo Assets */}
        <div className="space-y-2">
          <Field label="Light logo">
            <select
              value={activeKit.logoLightAssetId || ""}
              onChange={(e) => handleUpdateKit({ logoLightAssetId: e.target.value || undefined })}
              className="w-full h-8 px-2 rounded border border-[var(--color-line)] bg-[var(--color-raised)] text-xs text-[var(--color-text)] outline-none"
            >
              <option value="">None</option>
              {logoAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Dark logo">
            <select
              value={activeKit.logoDarkAssetId || ""}
              onChange={(e) => handleUpdateKit({ logoDarkAssetId: e.target.value || undefined })}
              className="w-full h-8 px-2 rounded border border-[var(--color-line)] bg-[var(--color-raised)] text-xs text-[var(--color-text)] outline-none"
            >
              <option value="">None</option>
              {logoAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Default Kit Switch */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-[var(--color-text-2)]">
            Default brand for new projects
          </span>
          <Switch
            checked={activeKit.isDefault ?? false}
            onCheckedChange={(checked) => {
              if (checked) {
                setDefaultBrandKit(activeKit.id);
                handleUpdateKit({ isDefault: true });
              }
            }}
          />
        </div>
      </div>

      {/* Apply to Project Button */}
      <div className="pt-2">
        <Button
          variant="primary"
          className="w-full justify-center"
          onClick={handleApply}
          icon={<Icon icon={Sparkles} size={14} />}
        >
          Apply to project
        </Button>
      </div>
    </div>
  );
};
