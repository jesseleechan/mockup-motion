import * as THREE from "three";
let topLeftQuad: THREE.PlaneGeometry | undefined;
let topLeftQuadOwners = 0;

export function createTopLeftQuad(): THREE.PlaneGeometry {
  if (!topLeftQuad) {
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.translate(0.5, 0.5, 0);
    const positions = geometry.attributes.position;
    const uvs = geometry.attributes.uv;
    for (let i = 0; i < positions.count; i++) uvs.setY(i, positions.getY(i) > 0 ? 0 : 1);
    uvs.needsUpdate = true;
    topLeftQuad = geometry;
  }
  return topLeftQuad;
}

/** Keep the shared quad alive for the lifetime of one compositor. */
export function retainTopLeftQuad(): THREE.PlaneGeometry {
  topLeftQuadOwners++;
  return createTopLeftQuad();
}

/** Release one compositor's ownership and dispose the singleton after its last user. */
export function releaseTopLeftQuad(): void {
  if (topLeftQuadOwners === 0) return;
  topLeftQuadOwners--;
  if (topLeftQuadOwners === 0) {
    topLeftQuad?.dispose();
    topLeftQuad = undefined;
  }
}

export function createTopLeftQuadSubrange(vMax: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.translate(0.5, 0.5, 0);
  const positions = geometry.attributes.position;
  const uvs = geometry.attributes.uv;
  for (let i = 0; i < positions.count; i++) uvs.setY(i, positions.getY(i) > 0 ? 0 : vMax);
  uvs.needsUpdate = true;
  return geometry;
}
