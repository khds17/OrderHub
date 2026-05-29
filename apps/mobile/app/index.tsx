import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/features/auth/use-auth';
import { useCart } from '@/features/cart/use-cart';

export default function Home() {
  const { user, status } = useAuth();
  const itemCount = useCart((s) => s.items.reduce((a, i) => a + i.quantity, 0));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OrderHub</Text>
      <Text style={styles.subtitle}>
        {status === 'authenticated' ? `Hi, ${user?.name}` : 'Welcome'}
      </Text>

      <View style={styles.grid}>
        <NavCard href="/products" label="Browse products" />
        <NavCard href="/cart" label={`Cart (${itemCount})`} />
        {status === 'authenticated' ? (
          <>
            <NavCard href="/orders" label="My orders" />
            <NavCard href="/profile" label="Profile" />
          </>
        ) : (
          <>
            <NavCard href="/login" label="Sign in" />
            <NavCard href="/register" label="Create account" />
          </>
        )}
      </View>
    </View>
  );
}

function NavCard({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href as never} asChild>
      <Pressable style={styles.card}>
        <Text style={styles.cardText}>{label}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 16, color: '#555', marginTop: 4, marginBottom: 24 },
  grid: { gap: 12 },
  card: {
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    backgroundColor: '#fafafa',
  },
  cardText: { fontSize: 18, fontWeight: '500' },
});
