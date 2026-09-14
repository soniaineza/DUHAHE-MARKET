import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { colors } from '../theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  name: IconName;
  size?: number;
  color?: string;
}

export default function Icon({ name, size = 22, color = colors.ink }: Props) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

export { MaterialCommunityIcons };