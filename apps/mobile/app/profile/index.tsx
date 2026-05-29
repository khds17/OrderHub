import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/features/auth/use-auth';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>You are not signed in.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Name</Text>
      <Text style={styles.value}>{user.name}</Text>
      <Text style={styles.label}>Email</Text>
      <Text style={styles.value}>{user.email}</Text>
      <Text style={styles.label}>Role</Text>
      <Text style={styles.value}>{user.role}</Text>

      <Pressable
        style={styles.button}
        onPress={async () => {
          await logout();
          router.replace('/');
        }}
      >
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { marginTop: 16, color: '#666' },
  value: { fontSize: 16, marginTop: 4 },
  button: {
    marginTop: 32,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c33',
  },
  buttonText: { color: '#c33', fontWeight: '600' },
});
