import { View } from 'react-native';

import type { TileState } from '@/components/ui';

import { FloorTile } from './FloorTile';

export type FloorTileModel = {
  id: number;
  label: string;
  seats: number;
  state: TileState;
  detail: string;
  selected?: boolean;
  target?: boolean;
};

type FloorPlanProps = {
  tiles: readonly FloorTileModel[];
  onSelect: (id: number) => void;
};

/**
 * The room. Tables have no coordinates in the data, so they are laid out in reading order and
 * wrap to the available width; a table's size hints at how many people it seats.
 */
export function FloorPlan({ tiles, onSelect }: FloorPlanProps) {
  return (
    <View accessibilityLabel="Floor plan" className="flex-row flex-wrap content-start gap-4 p-6">
      {tiles.map((tile) => (
        <FloorTile
          key={tile.id}
          testID={`tile-${tile.label}`}
          label={tile.label}
          seats={tile.seats}
          state={tile.state}
          detail={tile.detail}
          selected={tile.selected}
          target={tile.target}
          onPress={() => onSelect(tile.id)}
        />
      ))}
    </View>
  );
}
