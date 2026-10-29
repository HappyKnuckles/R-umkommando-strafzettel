import { ReactNode, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { formatMoney } from '../lib/format';

export const colors = {
  bg: '#F3F4F6',
  card: '#FFFFFF',
  primary: '#1E3A8A',
  primarySoft: '#DBEAFE',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  money: '#B91C1C',
  danger: '#DC2626',
  success: '#15803D',
};

export function Screen({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: colors.bg }}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.7 }]}
    >
      {children}
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  small,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = buttonVariants[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.7 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: v.fg }]}>{title}</Text>
    </Pressable>
  );
}

const buttonVariants: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: '#fff', border: colors.primary },
  secondary: { bg: colors.card, fg: colors.primary, border: colors.primary },
  danger: { bg: colors.card, fg: colors.danger, border: colors.danger },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
};

export function IconButton({
  icon,
  onPress,
  color = colors.muted,
}: {
  icon: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.5 }]}
    >
      <Text style={{ fontSize: 18, color }}>{icon}</Text>
    </Pressable>
  );
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

/** Red for money owed, green for credits (negative amounts). */
export function moneyColor(cents: number) {
  return cents < 0 ? colors.success : colors.money;
}

/** Red while a member still owes money, green when settled or owed a payout. */
export function openColor(open: number) {
  return open > 0 ? colors.money : colors.success;
}

export function Money({ cents, style }: { cents: number; style?: object }) {
  return (
    <Text style={[styles.money, { color: moneyColor(cents) }, style]}>{formatMoney(cents)}</Text>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

/** Text input with an add button, used for quickly adding names. */
export function AddRow({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (name: string) => void;
}) {
  const [value, setValue] = useState('');
  const submit = () => {
    const name = value.trim();
    if (!name) return;
    onAdd(name);
    setValue('');
  };
  return (
    <View style={styles.addRow}>
      <Input
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        onSubmitEditing={submit}
        returnKeyType="done"
        style={{ flex: 1 }}
      />
      <Button title="+" onPress={submit} disabled={!value.trim()} style={{ minWidth: 48 }} />
    </View>
  );
}

export function Counter({
  value,
  onChange,
  activeColor = colors.money,
}: {
  value: number;
  onChange: (n: number) => void;
  activeColor?: string;
}) {
  return (
    <View style={styles.counter}>
      <Pressable
        onPress={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        style={({ pressed }) => [
          styles.counterBtn,
          (pressed || value === 0) && { opacity: value === 0 ? 0.3 : 0.6 },
        ]}
      >
        <Text style={styles.counterBtnText}>−</Text>
      </Pressable>
      <Text style={[styles.counterValue, value > 0 && { color: activeColor }]}>{value}</Text>
      <Pressable
        onPress={() => onChange(value + 1)}
        style={({ pressed }) => [
          styles.counterBtn,
          styles.counterBtnPlus,
          pressed && { opacity: 0.6 },
        ]}
      >
        <Text style={[styles.counterBtnText, { color: '#fff' }]}>+</Text>
      </Pressable>
    </View>
  );
}

/** Cross-platform text prompt (Alert.prompt only exists on iOS). */
export function TextPrompt({
  visible,
  title,
  initial = '',
  placeholder,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  initial?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (visible) setValue(initial);
  }, [visible, initial]);
  const submit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Input
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            autoFocus
            onSubmitEditing={submit}
          />
          <View style={styles.modalButtons}>
            <Button title="Abbrechen" variant="ghost" onPress={onClose} />
            <Button title="Speichern" onPress={submit} disabled={!value.trim()} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function confirm(title: string, message: string, onConfirm: () => void, okLabel = 'Löschen') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Abbrechen', style: 'cancel' },
    { text: okLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

export function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export function StatGrid({ items }: { items: { label: string; value: string; color?: string }[] }) {
  return (
    <View style={styles.statGrid}>
      {items.map((s) => (
        <View key={s.label} style={styles.stat}>
          <Text style={[styles.statValue, s.color && { color: s.color }]}>{s.value}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 48, gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { paddingVertical: 6, paddingHorizontal: 12 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  iconButton: { padding: 4 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: 10,
    padding: 3,
  },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: colors.card },
  segmentText: { fontSize: 14, fontWeight: '500', color: colors.muted },
  segmentTextActive: { color: colors.primary, fontWeight: '700' },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '500', color: colors.text },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 20, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 13 },
  money: { color: colors.money, fontWeight: '700', fontSize: 16 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: 4 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  counterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnPlus: { backgroundColor: colors.primary },
  counterBtnText: { fontSize: 22, fontWeight: '600', color: colors.text, marginTop: -2 },
  counterValue: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: colors.card, borderRadius: 14, padding: 18, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.bg,
    borderRadius: 10,
    padding: 10,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
