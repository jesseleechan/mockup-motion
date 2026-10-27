import { holdsRows } from "../engine/textures/sizing";

/** A decoded image and the rows it keeps (textureRows; null is the whole image). */
export interface Decoded {
  bitmap: ImageBitmap;
  held: number | null;
}

interface Decode extends Decoded {
  key: string;
  /** Requests that got this bitmap and haven't handed it back yet. */
  users: number;
}

interface PendingDecode {
  rows: number | null;
  /** Requests waiting for this decode, the one that started it included. */
  users: number;
  promise: Promise<Decode>;
}

/**
 * The decodes an asset provider lends out (`AssetProvider.releaseImage`). Each request borrows
 * a bitmap and hands it back once; the last one back closes it. So the provider holds only what
 * someone still uses: a screenshot the document dropped, a decode that a wider or taller one
 * replaced, and a page the engine has cut into strips are closed as soon as the engine lets go.
 *
 * Requests for the same asset and width share one decode when it holds the rows they ask for,
 * also while it is still decoding.
 */
export class DecodeCache {
  /** The decode that new requests for an asset and width borrow. */
  private shared = new Map<string, Decode>();
  private pending = new Map<string, PendingDecode[]>();
  private lent = new Map<ImageBitmap, Decode>();

  async borrow(
    assetId: string,
    maxWidth: number,
    rows: number | null,
    decode: () => Promise<Decoded>,
  ): Promise<ImageBitmap> {
    const key = `${assetId}:${maxWidth}`;
    const shared = this.shared.get(key);
    if (shared && holdsRows(shared.held, rows)) {
      shared.users++;
      return shared.bitmap;
    }

    let pending = this.pending.get(key)?.find((p) => holdsRows(p.rows, rows));
    if (pending) pending.users++;
    else pending = this.start(key, rows, decode);
    return (await pending.promise).bitmap;
  }

  /** Hands back one borrow of `bitmap`; the last one closes it. A bitmap not lent here is left. */
  release(bitmap: ImageBitmap): void {
    const entry = this.lent.get(bitmap);
    if (!entry) return;
    entry.users--;
    if (entry.users > 0) return;
    this.lent.delete(bitmap);
    if (this.shared.get(entry.key) === entry) this.shared.delete(entry.key);
    bitmap.close();
  }

  /** A decode listed as pending until it settles. It starts once listed, so it can't fail first. */
  private start(key: string, rows: number | null, decode: () => Promise<Decoded>): PendingDecode {
    const pending: PendingDecode = {
      rows,
      users: 1,
      promise: Promise.resolve()
        .then(decode)
        .then(
          (decoded) => this.lend(key, pending, decoded),
          (err: unknown) => {
            this.unlist(key, pending);
            throw err;
          },
        ),
    };
    this.pending.set(key, [...(this.pending.get(key) ?? []), pending]);
    return pending;
  }

  /** Counts the requests that waited for a finished decode, in the step that unlists it. */
  private lend(key: string, pending: PendingDecode, { bitmap, held }: Decoded): Decode {
    this.unlist(key, pending);
    const entry: Decode = { key, bitmap, held, users: pending.users };
    this.lent.set(bitmap, entry);
    const shared = this.shared.get(key);
    // A decode for fewer rows, started before a taller one finished, isn't shared.
    if (!shared || holdsRows(held, shared.held)) this.shared.set(key, entry);
    return entry;
  }

  private unlist(key: string, pending: PendingDecode): void {
    const rest = (this.pending.get(key) ?? []).filter((p) => p !== pending);
    if (rest.length > 0) this.pending.set(key, rest);
    else this.pending.delete(key);
  }
}
