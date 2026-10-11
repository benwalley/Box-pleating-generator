import type { ToolId } from '../../state/types.ts';
import { FlapTool } from './flap-tool.ts';
import { PanTool } from './pan-tool.ts';
import { RiverTool } from './river-tool.ts';
import { SelectTool } from './select-tool.ts';
import type { Tool } from './tool.ts';

export type { Tool, ToolContext, ToolPointer, Overlay } from './tool.ts';

/** Tool order here is the order shown in the tool rail. */
export function createTools(): Record<ToolId, Tool> {
  return {
    select: new SelectTool(),
    flap: new FlapTool(),
    river: new RiverTool(),
    pan: new PanTool(),
  };
}

export const TOOL_ORDER: readonly ToolId[] = ['select', 'flap', 'river', 'pan'];
