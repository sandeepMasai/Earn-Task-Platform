import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = TextInputProps & { label: string; error?: string };
export default function AuthInput({ label, error, secureTextEntry, style, onFocus, onBlur, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, focused && styles.focused, !!error && styles.invalid]}>
        <TextInput {...props} accessibilityLabel={label} accessibilityHint={error} placeholderTextColor="#738079"
          secureTextEntry={secureTextEntry && !visible} style={[styles.input, style]}
          onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }} />
        {secureTextEntry && <Pressable disabled={props.editable === false} accessibilityRole="button" accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onPress={() => setVisible(!visible)} style={styles.toggle}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={21} color="#53645E" />
        </Pressable>}
      </View>
      {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { marginBottom: 18 }, label: { fontSize: 13, fontWeight: '600', color: '#263D33', marginBottom: 8 },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DCE4DE', borderRadius: 14, backgroundColor: '#F8FAF7', minHeight: 54 },
  focused: { borderColor: '#176B54', backgroundColor: '#FFFFFF' }, invalid: { borderColor: '#B33D34' },
  input: { flex: 1, minWidth: 0, color: '#162D25', fontSize: 16, paddingHorizontal: 14, paddingVertical: 14 },
  toggle: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#B33D34', fontSize: 12, marginTop: 6 },
});
