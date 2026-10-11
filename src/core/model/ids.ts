import type { Id } from './types.ts';

let counter = 0;

/** Short, unique, human-skimmable ids such as "f_lx3k2a7". */
export function createId(prefix: 'f' | 'r'): Id {
  counter = (counter + 1) % 1296;
  const time = Date.now().toString(36).slice(-5);
  const rand = Math.floor(Math.random() * 1296).toString(36).padStart(2, '0');
  return `${prefix}_${time}${counter.toString(36).padStart(2, '0')}${rand}`;
}
