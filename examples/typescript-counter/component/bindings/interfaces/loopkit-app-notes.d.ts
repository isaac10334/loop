/** @module Interface loopkit:app/notes@0.1.0 **/
export function acquire(): Store;
/**
 * # Variants
 * 
 * ## `"denied"`
 * 
 * ## `"revoked"`
 */
export type AccessError = 'denied' | 'revoked';

export class Store {
  /**
   * This type does not have a public constructor.
   */
  private constructor();
  read(): string;
  write(value: string): void;
}
