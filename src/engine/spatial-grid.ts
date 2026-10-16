export class SpatialGrid<T extends { x: number; y: number }> {
  private cellSize: number;
  private grid: Map<string, T[]>;

  constructor(cellSize: number = 200) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  public clear(): void {
    this.grid.clear();
  }

  private getKey(cx: number, cy: number): string {
    return `${cx}:${cy}`;
  }

  public insert(item: T): void {
    const cx = Math.floor(item.x / this.cellSize);
    const cy = Math.floor(item.y / this.cellSize);
    const key = this.getKey(cx, cy);

    let cell = this.grid.get(key);
    if (!cell) {
      cell = [];
      this.grid.set(key, cell);
    }
    cell.push(item);
  }

  public remove(item: T): boolean {
    const cx = Math.floor(item.x / this.cellSize);
    const cy = Math.floor(item.y / this.cellSize);
    const key = this.getKey(cx, cy);

    const cell = this.grid.get(key);
    if (!cell) return false;

    const idx = cell.indexOf(item);
    if (idx !== -1) {
      cell.splice(idx, 1);
      return true;
    }
    return false;
  }

  public queryRadius(x: number, y: number, radius: number): T[] {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    const results: T[] = [];
    const rSq = radius * radius;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.grid.get(this.getKey(cx, cy));
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
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
    const minCx = Math.floor(minX / this.cellSize);
    const maxCx = Math.floor(maxX / this.cellSize);
    const minCy = Math.floor(minY / this.cellSize);
    const maxCy = Math.floor(maxY / this.cellSize);

    const results: T[] = [];

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.grid.get(this.getKey(cx, cy));
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
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
