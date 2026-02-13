/** Lightweight ref shape matching React's useRef — avoids importing React in pure-logic modules. */
export interface MutableRef<T> {
  current: T;
}
