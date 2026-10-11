/** Disjoint-set forest over string keys, with path compression. */
export class UnionFind {
  private readonly parent = new Map<string, string>();

  add(key: string): void {
    if (!this.parent.has(key)) this.parent.set(key, key);
  }

  find(key: string): string {
    this.add(key);
    let root = key;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cur = key;
    while (cur !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  /** Returns false if a and b were already in the same set. */
  union(a: string, b: string): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    // Keep the lexicographically smaller root so results are deterministic.
    if (ra < rb) this.parent.set(rb, ra);
    else this.parent.set(ra, rb);
    return true;
  }

  groups(): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const key of this.parent.keys()) {
      const r = this.find(key);
      const g = out.get(r);
      if (g) g.push(key);
      else out.set(r, [key]);
    }
    for (const g of out.values()) g.sort();
    return out;
  }
}
