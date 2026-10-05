import { describe, expect, it } from "vitest";
import { defaultStyle } from "../src/doc/defaults";
import { DeviceShadowGroup, getShadowParameters } from "../src/engine/shadows/DeviceShadow";
import { FinalPass } from "../src/engine/post/final";

describe("Shadows & Final Pass (quality-bar §5)", () => {
  it("getShadowParameters matches quality-bar §5 for every preset", () => {
    // none
    const none = getShadowParameters("none");
    expect(none.contactOpacity).toBe(0);
    expect(none.ambientOpacity).toBe(0);

    // soft: contact blur 0.6%, opacity 0.22, offset y -0.25%; ambient blur 6%, opacity 0.10, offset y -2.5%
    const soft = getShadowParameters("soft");
    expect(soft.contactBlur).toBeCloseTo(0.006, 4);
    expect(soft.contactOpacity).toBeCloseTo(0.22, 2);
    expect(soft.contactOffsetY).toBeCloseTo(-0.0025, 4);
    expect(soft.ambientBlur).toBeCloseTo(0.06, 3);
    expect(soft.ambientOpacity).toBeCloseTo(0.1, 2);
    expect(soft.ambientOffsetY).toBeCloseTo(-0.025, 3);

    // medium: ambient blur 8%, opacity 0.16, offset y -3.5%
    const medium = getShadowParameters("medium");
    expect(medium.contactBlur).toBeCloseTo(0.006, 4);
    expect(medium.contactOpacity).toBeCloseTo(0.22, 2);
    expect(medium.ambientBlur).toBeCloseTo(0.08, 3);
    expect(medium.ambientOpacity).toBeCloseTo(0.16, 2);
    expect(medium.ambientOffsetY).toBeCloseTo(-0.035, 3);

    // dramatic: ambient blur 11%, opacity 0.24, offset y -5.0%
    const dramatic = getShadowParameters("dramatic");
    expect(dramatic.contactBlur).toBeCloseTo(0.006, 4);
    expect(dramatic.contactOpacity).toBeCloseTo(0.22, 2);
    expect(dramatic.ambientBlur).toBeCloseTo(0.11, 3);
    expect(dramatic.ambientOpacity).toBeCloseTo(0.24, 2);
    expect(dramatic.ambientOffsetY).toBeCloseTo(-0.05, 3);
  });

  it("DeviceShadowGroup creates contact and ambient meshes and updates correctly", () => {
    const shadow = new DeviceShadowGroup(0.8, 0.5, 0.016);
    expect(shadow.group.children.length).toBe(2);

    const style = {
      ...defaultStyle(),
      shadow: "dramatic" as const,
      background: { kind: "solid" as const, color: "#141417" },
    };
    shadow.update(style);

    // Disposes cleanly
    shadow.dispose();
  });

  it("FinalPass instantiates, resizes, and disposes without errors", () => {
    const pass = new FinalPass({
      width: 1920,
      height: 1080,
      supersample: 1.5,
    });

    pass.resize(1280, 720, 2);
    pass.dispose();
  });
});
