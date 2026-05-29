import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import type { Order } from '@orderhub/contracts';
import { api } from '@/lib/api-client';
import { formatMoney } from '@/lib/format-money';

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.orders
      .listMine({ limit: 50 })
      .then((r) => {
        if (!cancelled) setOrders(r.orders);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;

  return (
    <FlatList
      style={styles.list}
      data={orders}
      keyExtractor={(o) => o.id}
      renderItem={({ item }) => (
        <Link href={`/orders/${item.id}` as never} asChild>
          <Pressable style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
              <Text style={styles.status}>{item.status}</Text>
            </View>
            <Text style={styles.total}>{formatMoney(item.total)}</Text>
          </Pressable>
        </Link>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No orders yet.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#fff' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  orderId: { fontWeight: '600', fontSize: 16 },
  status: { color: '#666', marginTop: 2 },
  total: { fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 48, color: '#888' },
});
