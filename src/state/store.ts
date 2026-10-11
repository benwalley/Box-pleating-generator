/** A minimal observable state container. */
export type Listener<T> = (state: T, previous: T) => void;

export class Store<T> {
  private current: T;
  private readonly listeners = new Set<Listener<T>>();

  constructor(initial: T) {
    this.current = initial;
  }

  get state(): T {
    return this.current;
  }

  set(next: T): void {
    if (next === this.current) return;
    const previous = this.current;
    this.current = next;
    for (const l of this.listeners) l(next, previous);
  }

  update(fn: (state: T) => T): void {
    this.set(fn(this.current));
  }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
