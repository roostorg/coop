/**
 * Maps an Ant Design `Tooltip`/`Popover` `placement` string to the
 * `{ side, align }` pair that Radix (and coop-ui's Tooltip/Popover) use.
 * antd's 12 placements collapse onto Radix's 4 sides × 3 alignments.
 */
export type RadixSide = 'top' | 'right' | 'bottom' | 'left';
export type RadixAlign = 'start' | 'center' | 'end';

const PLACEMENT_MAP: Record<string, { side: RadixSide; align: RadixAlign }> = {
  top: { side: 'top', align: 'center' },
  topLeft: { side: 'top', align: 'start' },
  topRight: { side: 'top', align: 'end' },
  bottom: { side: 'bottom', align: 'center' },
  bottomLeft: { side: 'bottom', align: 'start' },
  bottomRight: { side: 'bottom', align: 'end' },
  left: { side: 'left', align: 'center' },
  leftTop: { side: 'left', align: 'start' },
  leftBottom: { side: 'left', align: 'end' },
  right: { side: 'right', align: 'center' },
  rightTop: { side: 'right', align: 'start' },
  rightBottom: { side: 'right', align: 'end' },
};

export function placementToSideAlign(placement: string | undefined): {
  side: RadixSide;
  align: RadixAlign;
} {
  return (
    (placement ? PLACEMENT_MAP[placement] : undefined) ?? PLACEMENT_MAP.top
  );
}
