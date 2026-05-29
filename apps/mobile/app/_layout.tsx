import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/use-auth';

export default function RootLayout() {
  const init = useAuth((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: '#fff' } }}>
        <Stack.Screen name="index" options={{ title: 'OrderHub' }} />
        <Stack.Screen name="login/index" options={{ title: 'Sign in' }} />
        <Stack.Screen name="register/index" options={{ title: 'Register' }} />
        <Stack.Screen name="products/index" options={{ title: 'Products' }} />
        <Stack.Screen name="products/[slug]" options={{ title: 'Product' }} />
        <Stack.Screen name="cart/index" options={{ title: 'Cart' }} />
        <Stack.Screen name="checkout/index" options={{ title: 'Checkout' }} />
        <Stack.Screen name="orders/index" options={{ title: 'My Orders' }} />
        <Stack.Screen name="orders/[id]" options={{ title: 'Order' }} />
        <Stack.Screen name="profile/index" options={{ title: 'Profile' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
