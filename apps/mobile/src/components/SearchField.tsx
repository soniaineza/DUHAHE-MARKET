import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Icon from './Icon';
import { colors, radii } from '../theme';

interface Props {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  onClear?: () => void;
}

export default function SearchField({ value, onChangeText, placeholder, autoFocus, onSubmitEditing, onClear }: Props) {
  return (
    <View style={styles.wrap}>
      <Icon name="magnify" size={20} color={colors.faint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        style={styles.input}
        autoFocus={autoFocus}
        returnKeyType="search"
        autoCorrect={false}
        onSubmitEditing={onSubmitEditing}
      />
      {value.length > 0 && onClear ? (
        <Pressable onPress={onClear} hitSlop={8}>
          <Icon name="close-circle" size={18} color={colors.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.chip,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  input: { flex: 1, paddingVertical: 11, fontSize: 15, color: colors.ink },
});