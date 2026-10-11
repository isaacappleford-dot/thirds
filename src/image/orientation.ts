/** EXIF orientation helpers. Pure where possible; unit-tested. */

/** Output size for an EXIF orientation (5–8 swap width and height). */
export function orientedSize(w: number, h: number, orientation: number) {
  return orientation >= 5 && orientation <= 8 ? { width: h, height: w } : { width: w, height: h };
}

/**
 * Canvas transform that draws an un-rotated (raw) image of size w×h so it
 * appears correctly oriented on a canvas of orientedSize(w, h, o).
 * Returns [a, b, c, d, e, f] for ctx.setTransform, in units of the drawn size.
 */
export function orientationTransform(o: number, w: number, h: number): [number, number, number, number, number, number] {
  switch (o) {
    case 2:
      return [-1, 0, 0, 1, w, 0];
    case 3:
      return [-1, 0, 0, -1, w, h];
    case 4:
      return [1, 0, 0, -1, 0, h];
    case 5:
      return [0, 1, 1, 0, 0, 0];
    case 6:
      return [0, 1, -1, 0, h, 0];
    case 7:
      return [0, -1, -1, 0, h, w];
    case 8:
      return [0, -1, 1, 0, 0, w];
    default:
      return [1, 0, 0, 1, 0, 0];
  }
}

/** Insert a minimal EXIF APP1 segment carrying `orientation` right after SOI. */
export function withExifOrientation(jpeg: Uint8Array, orientation: number): Uint8Array {
  const payload = [
    0x45, 0x78, 0x69, 0x66, 0, 0, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, // big-endian TIFF header, IFD at 8
    0, 1, // one entry
    0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, // Orientation, SHORT, 1
    0, 0, 0, 0, // no next IFD
  ];
  const len = payload.length + 2;
  const seg = new Uint8Array([0xff, 0xe1, len >> 8, len & 0xff, ...payload]);
  const out = new Uint8Array(jpeg.length + seg.length);
  out.set(jpeg.subarray(0, 2), 0);
  out.set(seg, 2);
  out.set(jpeg.subarray(2), 2 + seg.length);
  return out;
}
