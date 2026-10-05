import {
  Upload,
  Plus,
  ImagePlus,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Monitor,
  Smartphone,
  MoreHorizontal,
} from "lucide-react";
import type { Project, UploadedImage } from "../types";
import { Select } from "./Controls";
interface MediaProps {
  project: Project;
  onUpload: () => void;
  onDemo: () => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onReplace: (id: string) => void;
  onReorder: (id: string, direction: number) => void;
  onCategory: (id: string, category: "desktop" | "mobile") => void;
}
export function MediaPanel(props: MediaProps) {
  const {
    project,
    onUpload,
    onDemo,
    onRemove,
    onReplace,
    onReorder,
    onCategory,
    onSelect,
  } = props;
  return (
    <div className="media-panel">
      <div className="library-heading">
        <h2>Your screenshots</h2>
        <p>The work behind the presentation.</p>
      </div>
      <button className="upload-zone" onClick={onUpload}>
        <Upload size={20} />
        <strong>Drop images or browse</strong>
        <span>PNG, JPG, WebP or AVIF</span>
      </button>
      {!project.images.length && (
        <button className="subtle-button demo-library" onClick={onDemo}>
          Try demo screenshots
        </button>
      )}
      <div className="media-list">
        {project.images.map((i, index) => (
          <div className="media-list-item" key={i.id}>
            <button
              className="library-image"
              onClick={() => onSelect(i.id)}
              aria-label={`Select ${i.name}`}
            >
              <img src={i.url} alt={i.name} />
            </button>
            <div className="media-item-heading">
              <strong title={i.name}>{i.name}</strong>
              <span>
                {i.width} × {i.height}
              </span>
            </div>
            <Select
              label={`Type for ${i.name}`}
              value={i.category ?? "desktop"}
              options={[
                { value: "desktop", label: "Desktop" },
                { value: "mobile", label: "Mobile" },
              ]}
              onChange={(v) => onCategory(i.id, v as "desktop" | "mobile")}
            />
            <div className="media-actions">
              <button
                className="icon-button"
                aria-label={`Move ${i.name} earlier`}
                disabled={index === 0}
                onClick={() => onReorder(i.id, -1)}
              >
                <ArrowLeft size={14} />
              </button>
              <button
                className="icon-button"
                aria-label={`Move ${i.name} later`}
                disabled={index === project.images.length - 1}
                onClick={() => onReorder(i.id, 1)}
              >
                <ArrowRight size={14} />
              </button>
              <button
                className="icon-button"
                aria-label={`Replace ${i.name}`}
                onClick={() => onReplace(i.id)}
              >
                <ImagePlus size={14} />
              </button>
              <button
                className="icon-button danger"
                aria-label={`Remove ${i.name}`}
                onClick={() => onRemove(i.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export function MediaStrip({
  project,
  onUpload,
  onSelect,
  onRemove,
  onReplace,
  onReorder,
}: MediaProps) {
  return (
    <div className="media-strip" aria-label="Project screenshots">
      {project.images.map((i, index) => (
        <div
          className={`media-card ${project.composition.assetIds.primary === i.id || (!project.composition.assetIds.primary && index === 0) ? "selected" : ""}`}
          key={i.id}
        >
          <button
            className="media-thumb"
            onClick={() => onSelect(i.id)}
            aria-label={`Use ${i.name}`}
          >
            <img src={i.url} alt={i.name} />
            <span className="image-number">{index + 1}</span>
            <span className="image-type">
              {i.category === "mobile" ? (
                <Smartphone size={12} />
              ) : (
                <Monitor size={12} />
              )}
            </span>
          </button>
          <details className="media-menu">
            <summary aria-label={`Options for ${i.name}`}>
              <MoreHorizontal size={16} />
            </summary>
            <div>
              <button onClick={() => onReplace(i.id)}>Replace image</button>
              <button
                disabled={index === 0}
                onClick={() => onReorder(i.id, -1)}
              >
                Move earlier
              </button>
              <button
                disabled={index === project.images.length - 1}
                onClick={() => onReorder(i.id, 1)}
              >
                Move later
              </button>
              <button className="danger" onClick={() => onRemove(i.id)}>
                Remove image
              </button>
            </div>
          </details>
        </div>
      ))}
      <button className="add-media" onClick={onUpload}>
        <Plus size={21} />
        <span>Add screenshots</span>
      </button>
    </div>
  );
}
