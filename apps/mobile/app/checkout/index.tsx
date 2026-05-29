import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api-client';
import { useCart, calculateCartTotal } from '@/features/cart/use-cart';
import { formatMoney } from '@/lib/format-money';

export default function CheckoutScreen() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const [busy, setBusy] = useState(false);
  const total = calculateCartTotal(items);

  async function placeOrder() {
    if (items.length === 0) return;
    setBusy(true);
    try {
      const { order } = await api.orders.create({
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      });
      clear();
      router.replace(`/orders/${order.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Order failed';
      Alert.alert('Checkout failed', msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Review</Text>
      {items.map((i) => (
        <View key={i.productId} style={styles.line}>
          <Text style={{ flex: 1 }}>
            {i.name} × {i.quantity}
          </Text>
          <Text>{formatMoney(i.unitPrice)}</Text>
        </View>
      ))}
      <View style={styles.line}>
        <Text style={styles.total}>Total</Text>
        <Text style={styles.total}>{formatMoney(total)}</Text>
      </View>
      <Pressable
        style={[styles.button, busy && { opacity: 0.6 }]}
        onPress={placeOrder}
        disabled={busy || items.length === 0}
      >
        <Text style={styles.buttonText}>
          {busy ? 'Placing…' : 'Place order'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  total: { fontWeight: '700', fontSize: 16 },
  button: {
    marginTop: 24,
    backgroundColor: '#111',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
