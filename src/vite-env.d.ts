declare module 'upng-js' {
  export interface Image {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: any[];
    tabs: any;
    data: ArrayBufferLike;
  }
  export function decode(buffer: ArrayBuffer): Image;
  export function toRGBA8(out: Image): ArrayBuffer[];
}

