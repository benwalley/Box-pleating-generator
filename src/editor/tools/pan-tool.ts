import { PanDrag, type Tool, type ToolContext, type ToolPointer } from './tool.ts';

/** Pan tool: drag anywhere to move the view. Space+drag does the same from any tool. */
export class PanTool implements Tool {
  readonly id = 'pan' as const;
  readonly label = 'Pan';
  readonly shortcut = 'H';
  readonly hint = 'Drag to move around. Scroll to zoom.';
  private readonly pan = new PanDrag();

  onPointerDown(p: ToolPointer): void {
    this.pan.start(p);
  }

  onPointerMove(p: ToolPointer, ctx: ToolContext): void {
    this.pan.move(p, ctx);
  }

  onPointerUp(): void {
    this.pan.end();
  }

  cancel(): void {
    this.pan.end();
  }

  cursor(): string {
    return this.pan.active ? 'grabbing' : 'grab';
  }
}
