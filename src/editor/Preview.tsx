import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Play, Pause, RotateCcw, Upload, Sparkles } from "lucide-react";
import type { Project } from "../types";
import { outputDimensions } from "../rendering/geometry";
import { renderScene } from "../rendering/renderer";
import { Toggle } from "./Controls";
export interface PreviewHandle {
  time: () => number;
  pause: () => void;
}
export const Preview = forwardRef<
  PreviewHandle,
  {
    project: Project;
    busy: boolean;
    onUpload: () => void;
    onDemo: () => void;
    onLoop: (v: boolean) => void;
  }
>(function Preview({ project, busy, onUpload, onDemo, onLoop }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null),
    clock = useRef(0),
    renderedAt = useRef(0);
  const [playing, setPlaying] = useState(true),
    [time, setTime] = useState(0),
    [scrubbing, setScrubbing] = useState(false);
  const [dragging, setDragging] = useState(false);
  useImperativeHandle(
    ref,
    () => ({ time: () => clock.current, pause: () => setPlaying(false) }),
    [],
  );
  const duration = project.composition.motion.duration;
  useEffect(() => {
    clock.current = Math.min(clock.current, duration);
    setTime(clock.current);
  }, [duration]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ctx = element.getContext("2d");
    if (!ctx) return;
    const { width, height } = outputDimensions(project.aspectRatio, 720);
    element.width = width;
    element.height = height;
    let frame = 0,
      last = performance.now(),
      lastUi = 0;
    const draw = () => {
      renderScene({
        ctx,
        width,
        height,
        time: clock.current,
        composition: project.composition,
        images: project.images,
      });
      renderedAt.current = clock.current;
    };
    draw();
    if (playing && !scrubbing && !busy && project.images.length) {
      const tick = (now: number) => {
        const next = clock.current + Math.min((now - last) / 1000, 0.1);
        last = now;
        if (next >= duration) {
          clock.current = project.composition.motion.loop
            ? next % duration
            : duration;
          if (!project.composition.motion.loop) setPlaying(false);
        } else clock.current = next;
        draw();
        if (now - lastUi > 75) {
          setTime(clock.current);
          lastUi = now;
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(frame);
  }, [
    project.composition,
    project.images,
    project.aspectRatio,
    playing,
    scrubbing,
    busy,
    duration,
  ]);
  const seek = (value: number) => {
    clock.current = value;
    setTime(value);
    const element = canvas.current;
    if (element) {
      const ctx = element.getContext("2d");
      if (ctx)
        renderScene({
          ctx,
          width: element.width,
          height: element.height,
          time: value,
          composition: project.composition,
          images: project.images,
        });
    }
  };
  const toggle = () => {
    if (clock.current >= duration) seek(0);
    setPlaying((p) => !p);
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        e.code === "Space" &&
        !["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName) &&
        !target.isContentEditable
      ) {
        e.preventDefault();
        if (clock.current >= duration) {
          clock.current = 0;
          setTime(0);
        }
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [duration]);
  const format = (value: number) =>
    `00:${String(Math.floor(value)).padStart(2, "0")}`;
  return (
    <div className="preview-workspace">
      <div
        className={`canvas-area ${dragging ? "dragging" : ""}`}
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDrop={() => setDragging(false)}
      >
        <div
          className="canvas-fit"
          style={
            {
              aspectRatio: project.aspectRatio.replace(":", " / "),
              "--canvas-ratio": project.aspectRatio
                .split(":")
                .map(Number)
                .reduce((a, b) => a / b),
            } as React.CSSProperties
          }
        >
          <canvas ref={canvas} aria-label="Presentation video preview" />
          {!project.images.length && (
            <div className="empty-canvas">
              <button
                className="empty-upload"
                onClick={onUpload}
                aria-label="Upload screenshots"
              >
                <Upload size={27} />
              </button>
              <h1>Your work deserves a little motion.</h1>
              <p>
                Drop your screenshots here, or choose a few.
                <br />
                We’ll take care of the presentation.
              </p>
              <button className="primary-button" onClick={onUpload}>
                Add screenshots
              </button>
              <button className="demo-button" onClick={onDemo}>
                <Sparkles size={14} />
                Try a demo
              </button>
              <span>PNG, JPG, WebP or AVIF</span>
            </div>
          )}
        </div>
      </div>
      <div className="playback-bar">
        <button
          className="play-button"
          aria-label={playing ? "Pause preview" : "Play preview"}
          title="Play / pause (Space)"
          onClick={toggle}
          disabled={!project.images.length || busy}
        >
          {playing && project.images.length ? (
            <Pause size={19} fill="currentColor" />
          ) : (
            <Play size={20} fill="currentColor" />
          )}
        </button>
        <button
          className="icon-button"
          aria-label="Restart preview"
          onClick={() => {
            seek(0);
            setPlaying(true);
          }}
          disabled={!project.images.length}
        >
          <RotateCcw size={18} />
        </button>
        <div className="playback-divider" />
        <input
          type="range"
          aria-label="Preview playhead"
          min={0}
          max={duration}
          step={0.01}
          value={time}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setScrubbing(true);
          }}
          onPointerUp={() => setScrubbing(false)}
          onPointerCancel={() => setScrubbing(false)}
          onBlur={() => setScrubbing(false)}
          onChange={(e) => seek(Number(e.target.value))}
          style={
            {
              "--range-progress": `${(time / duration) * 100}%`,
            } as React.CSSProperties
          }
        />
        <span className="timecode">
          {format(time)} / {format(duration)}
        </span>
        <div className="playback-divider" />
        <Toggle
          label="Loop"
          checked={project.composition.motion.loop}
          onChange={onLoop}
        />
      </div>
    </div>
  );
});
