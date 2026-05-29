import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { OrderWithItems } from '@orderhub/contracts';
import { api } from '@/lib/api-client';
import { formatMoney } from '@/lib/format-money';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.orders
      .byId(id)
      .then((r) => {
        if (!cancelled) setOrder(r.order);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function pay() {
    if (!order) return;
    setBusy(true);
    try {
      const { order: updated } = await api.orders.pay(order.id, {
        card: {
          number: cardNumber.replace(/\s+/g, ''),
          holderName,
          expiry,
          cvv,
        },
      });
      setOrder(updated);
      setShowPay(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment failed';
      Alert.alert('Payment failed', msg);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!order) return;
    setBusy(true);
    try {
      const { order: updated } = await api.orders.cancel(order.id);
      setOrder(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cancel failed';
      Alert.alert('Cancel failed', msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  if (!order) return <Text style={{ padding: 20 }}>Order not found.</Text>;

  const canPay = order.status === 'PENDING' && order.paymentStatus !== 'PAID';
  const canCancel = order.status === 'PENDING';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Order #{order.id.slice(0, 8)}</Text>
      <Text style={styles.status}>
        {order.status} · {order.paymentStatus}
      </Text>
      {order.items.map((it) => (
        <View key={it.id} style={styles.row}>
          <Text style={{ flex: 1 }}>
            {it.productId.slice(0, 8)} × {it.quantity}
          </Text>
          <Text>{formatMoney(it.unitPrice)}</Text>
        </View>
      ))}
      <View style={styles.row}>
        <Text style={styles.total}>Total</Text>
        <Text style={styles.total}>{formatMoney(order.total)}</Text>
      </View>

      {canPay && !showPay ? (
        <Pressable
          style={styles.button}
          onPress={() => setShowPay(true)}
          disabled={busy}
        >
          <Text style={styles.buttonText}>Pay</Text>
        </Pressable>
      ) : null}

      {showPay ? (
        <View style={{ marginTop: 24 }}>
          <Text style={styles.label}>Card number</Text>
          <TextInput
            style={styles.input}
            value={cardNumber}
            onChangeText={setCardNumber}
            keyboardType="number-pad"
          />
          <Text style={styles.label}>Cardholder name</Text>
          <TextInput
            style={styles.input}
            value={holderName}
            onChangeText={setHolderName}
          />
          <Text style={styles.label}>Expiry (MM/YY)</Text>
          <TextInput
            style={styles.input}
            value={expiry}
            onChangeText={setExpiry}
          />
          <Text style={styles.label}>CVV</Text>
          <TextInput
            style={styles.input}
            value={cvv}
            onChangeText={setCvv}
            keyboardType="number-pad"
            secureTextEntry
          />
          <Pressable
            style={[styles.button, busy && { opacity: 0.6 }]}
            onPress={pay}
            disabled={busy}
          >
            <Text style={styles.buttonText}>
              {busy ? 'Paying…' : 'Submit payment'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {canCancel ? (
        <Pressable
          style={[styles.cancelButton, busy && { opacity: 0.6 }]}
          onPress={cancel}
          disabled={busy}
        >
          <Text style={styles.cancelText}>Cancel order</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700' },
  status: { color: '#666', marginTop: 4, marginBottom: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  total: { fontWeight: '700' },
  label: { marginTop: 12, marginBottom: 6, color: '#444' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#111',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  cancelButton: {
    marginTop: 12,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c33',
  },
  cancelText: { color: '#c33', fontWeight: '600' },
});
