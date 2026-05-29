import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Product } from '@orderhub/contracts';
import { api } from '@/lib/api-client';
import { formatMoney } from '@/lib/format-money';
import { useCart } from '@/features/cart/use-cart';

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const add = useCart((s) => s.add);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    api.products
      .byIdOrSlug(slug)
      .then((r) => {
        if (!cancelled) setProduct(r.product);
      })
      .catch(() => {
        if (!cancelled) Alert.alert('Failed to load product');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 32 }} />;
  }
  if (!product) {
    return (
      <View style={styles.container}>
        <Text>Product not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.price}>{formatMoney(product.price)}</Text>
      {product.description ? (
        <Text style={styles.desc}>{product.description}</Text>
      ) : null}
      <Pressable
        style={styles.button}
        onPress={() => {
          add({
            productId: product.id,
            slug: product.slug,
            name: product.name,
            unitPrice: product.price,
          });
          router.push('/cart');
        }}
      >
        <Text style={styles.buttonText}>Add to cart</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' },
  name: { fontSize: 24, fontWeight: '700' },
  price: { fontSize: 20, marginTop: 8, color: '#222' },
  desc: { marginTop: 16, color: '#444', lineHeight: 20 },
  button: {
    marginTop: 24,
    backgroundColor: '#111',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
