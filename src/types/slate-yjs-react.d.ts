// src/types/slate-yjs-react.d.ts
declare module '@slate-yjs/react' {
  import { RefObject } from 'react';

  /**  
   * Data for a single remote cursor/selection  
   */
  export interface CursorOverlayData<T> {
    clientId: string;
    data: T;
    /** DOMRect for the caret element */
    caretPosition: DOMRect | null;
    /** array of DOMRects for the selection highlights */
    selectionRects: DOMRect[];
  }

  /**  
   * Returns an array of remote cursors & their bounding‐boxes  
   */
  export function useRemoteCursorOverlayPositions<T>(opts: {
    containerRef: RefObject<HTMLElement>;
  }): [CursorOverlayData<T>[]];
}
