import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useCart, calculateCartTotal } from '@/features/cart/use-cart';
import { useAuth } from '@/features/auth/use-auth';
import { formatMoney } from '@/lib/format-money';

export default function CartScreen() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const status = useAuth((s) => s.status);
  const total = calculateCartTotal(items);

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.productId}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.price}>{formatMoney(item.unitPrice)}</Text>
            </View>
            <View style={styles.qty}>
              <Pressable
                style={styles.qtyBtn}
                onPress={() => setQuantity(item.productId, item.quantity - 1)}
              >
                <Text>-</Text>
              </Pressable>
              <Text style={styles.qtyNum}>{item.quantity}</Text>
              <Pressable
                style={styles.qtyBtn}
                onPress={() => setQuantity(item.productId, item.quantity + 1)}
              >
                <Text>+</Text>
              </Pressable>
              <Pressable
                onPress={() => remove(item.productId)}
                style={styles.removeBtn}
              >
                <Text style={{ color: '#c33' }}>✕</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Your cart is empty.</Text>
        }
      />
      {items.length > 0 ? (
        <View style={styles.footer}>
          <Text style={styles.total}>Total: {formatMoney(total)}</Text>
          <Pressable
            style={styles.checkoutBtn}
            onPress={() =>
              status === 'authenticated'
                ? router.push('/checkout')
                : router.push('/login')
            }
          >
            <Text style={styles.checkoutText}>
              {status === 'authenticated' ? 'Checkout' : 'Sign in to checkout'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  name: { fontSize: 16 },
  price: { color: '#666', marginTop: 2 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyNum: { minWidth: 24, textAlign: 'center' },
  removeBtn: { paddingHorizontal: 8 },
  empty: { textAlign: 'center', marginTop: 48, color: '#888' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  total: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  checkoutBtn: {
    backgroundColor: '#111',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkoutText: { color: '#fff', fontWeight: '600' },
});
