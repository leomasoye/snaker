export class SpatialGrid<T extends { x: number; y: number }> {
  private cellSize: number;
  private offset: number = 3500;
  private cols: number = 36;
  private rows: number = 36;
  private cells: T[][];

  constructor(cellSize: number = 200) {
    this.cellSize = cellSize;
    const total = this.cols * this.rows;
    this.cells = Array.from({ length: total }, () => []);
  }

  public clear(): void {
    const total = this.cells.length;
    for (let i = 0; i < total; i++) {
      this.cells[i].length = 0;
    }
  }

  private getCellIndex(cx: number, cy: number): number {
    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return -1;
    return cy * this.cols + cx;
  }

  public insert(item: T): void {
    const cx = Math.floor((item.x + this.offset) / this.cellSize);
    const cy = Math.floor((item.y + this.offset) / this.cellSize);
    const idx = this.getCellIndex(cx, cy);
    if (idx !== -1) {
      this.cells[idx].push(item);
    }
  }

  public remove(item: T): boolean {
    const cx = Math.floor((item.x + this.offset) / this.cellSize);
    const cy = Math.floor((item.y + this.offset) / this.cellSize);
    const cellIdx = this.getCellIndex(cx, cy);
    if (cellIdx === -1) return false;

    const cell = this.cells[cellIdx];
    const idx = cell.indexOf(item);
    if (idx !== -1) {
      const last = cell.pop()!;
      if (idx < cell.length) {
        cell[idx] = last;
      }
      return true;
    }
    return false;
  }

  public queryRadius(x: number, y: number, radius: number): T[] {
    const minCx = Math.floor((x - radius + this.offset) / this.cellSize);
    const maxCx = Math.floor((x + radius + this.offset) / this.cellSize);
    const minCy = Math.floor((y - radius + this.offset) / this.cellSize);
    const maxCy = Math.floor((y + radius + this.offset) / this.cellSize);

    const results: T[] = [];
    const rSq = radius * radius;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const idx = this.getCellIndex(cx, cy);
        if (idx !== -1) {
          const cell = this.cells[idx];
          const len = cell.length;
          for (let i = 0; i < len; i++) {
            const item = cell[i];
            const dx = item.x - x;
            const dy = item.y - y;
            if (dx * dx + dy * dy <= rSq) {
              results.push(item);
            }
          }
        }
      }
    }
    return results;
  }

  public queryRect(minX: number, minY: number, maxX: number, maxY: number): T[] {
    const minCx = Math.floor((minX + this.offset) / this.cellSize);
    const maxCx = Math.floor((maxX + this.offset) / this.cellSize);
    const minCy = Math.floor((minY + this.offset) / this.cellSize);
    const maxCy = Math.floor((maxY + this.offset) / this.cellSize);

    const results: T[] = [];

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const idx = this.getCellIndex(cx, cy);
        if (idx !== -1) {
          const cell = this.cells[idx];
          const len = cell.length;
          for (let i = 0; i < len; i++) {
            const item = cell[i];
            if (item.x >= minX && item.x <= maxX && item.y >= minY && item.y <= maxY) {
              results.push(item);
            }
          }
        }
      }
    }
    return results;
  }
}
