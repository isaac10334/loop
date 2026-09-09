/** @module Interface loopkit:app/ui@0.1.0 **/
/**
 * # Variants
 * 
 * ## `"refresh"`
 * 
 * ## `"increment"`
 * 
 * ## `"delayed-increment"`
 * 
 * ## `"read-note"`
 * 
 * ## `"write-note"`
 */
export type Action = 'refresh' | 'increment' | 'delayed-increment' | 'read-note' | 'write-note';
/**
 * # Variants
 * 
 * ## `"column"`
 * 
 * ## `"row"`
 * 
 * ## `"text"`
 * 
 * ## `"button"`
 */
export type Kind = 'column' | 'row' | 'text' | 'button';
/**
 * # Variants
 * 
 * ## `"start"`
 * 
 * ## `"center"`
 * 
 * ## `"end"`
 * 
 * ## `"stretch"`
 */
export type Alignment = 'start' | 'center' | 'end' | 'stretch';
/**
 * Flat preorder tree; parent is an earlier node index, absent only on root.
 */
export interface Node {
  parent?: number,
  kind: Kind,
  text: string,
  action?: Action,
  gap: number,
  align: Alignment,
}
export interface View {
  count: number,
  status: string,
  nodes: Array<Node>,
}
