/** Public capability identity and exact named service; neither grants authority. */
import { defineCapability } from '@loop-kit/capabilities';

export interface Counter { read(): number; increment(step?: number): number }
export const counter = defineCapability<Counter>({ id: 'example:counter/value', version: '1' });
export const counterService = 'primary';
