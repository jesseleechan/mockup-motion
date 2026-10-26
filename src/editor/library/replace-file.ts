import { validateAndDecodeAsset } from "../../assets/decode";
import type { AssetRef } from "../../doc/types";

/**
 * The asset that "Replace file…" makes of `existing` with `file`: the new file's name, type, size
 * and pixel size, with the asset's id, role and other fields kept. A file the import would
 * reject, such as one that can't be decoded, throws the import's message, so the caller can
 * leave the asset and its stored file as they were.
 */
export async function replacementRef(existing: AssetRef, file: File): Promise<AssetRef> {
  const { ref } = await validateAndDecodeAsset(file, file.name);
  return {
    ...existing,
    name: ref.name,
    mime: ref.mime,
    bytes: ref.bytes,
    width: ref.width,
    height: ref.height,
  };
}
