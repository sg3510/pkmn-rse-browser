import {
  resolveTileAt,
  type ResolvedTile,
} from '../../components/map/utils';
import type { RenderContext } from '../../components/map/types';

export { resolveTileAt };
export type { RenderContext, ResolvedTile };

export function useMapLogic() {
  return { resolveTileAt };
}
