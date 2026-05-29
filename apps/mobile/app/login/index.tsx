import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/features/auth/use-auth';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!email || !password) return;
    setBusy(true);
    try {
      await login(email, password);
      router.replace('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      Alert.alert('Sign in failed', msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Pressable
        style={[styles.button, busy && { opacity: 0.6 }]}
        onPress={onSubmit}
        disabled={busy}
      >
        <Text style={styles.buttonText}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Text>
      </Pressable>
      <Link href="/register" style={styles.link}>
        Don&apos;t have an account? Register
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { marginTop: 12, marginBottom: 6, color: '#444' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    marginTop: 20,
    backgroundColor: '#111',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 20, color: '#3366cc', textAlign: 'center' },
});
