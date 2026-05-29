import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Link } from 'expo-router';
import type { Product } from '@orderhub/contracts';
import { api } from '@/lib/api-client';
import { formatMoney } from '@/lib/format-money';

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.products
      .list({ q: q || undefined, limit: 50 })
      .then((r) => {
        if (!cancelled) setProducts(r.products);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search products"
        value={q}
        onChangeText={setQ}
        autoCapitalize="none"
      />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <Link href={`/products/${item.slug}` as never} asChild>
              <Pressable style={styles.row}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.price}>{formatMoney(item.price)}</Text>
              </Pressable>
            </Link>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No products.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  search: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 16, flex: 1 },
  price: { fontSize: 16, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 32, color: '#888' },
});
