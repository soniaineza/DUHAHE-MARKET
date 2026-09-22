import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Order } from '@duhahe/shared';
import Icon, { type IconName } from '../components/Icon';
import HomeScreen from '../screens/HomeScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import CheckoutSuccessScreen from '../screens/CheckoutSuccessScreen';
import DemoPaymentScreen from '../screens/DemoPaymentScreen';
import AboutScreen from '../screens/AboutScreen';
import OrderTrackingScreen from '../screens/OrderTrackingScreen';
import OrdersScreen from '../screens/OrdersScreen';
import CategoryScreen from '../screens/CategoryScreen';
import ProductDetailsScreen from '../screens/ProductDetailsScreen';
import SearchScreen from '../screens/SearchScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import AddressesScreen from '../screens/AddressesScreen';
import AccountScreen from '../screens/AccountScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import { useCart } from '../context/CartContext';
import { colors, radii } from '../theme';

export type TabParamList = {
  Home: undefined;
  Categories: undefined;
  Orders: undefined;
  Cart: undefined;
  Account: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  Category: { category: string };
  ProductDetails: { productId: string };
  Search: { q?: string } | undefined;
  Checkout: undefined;
  CheckoutSuccess: { orderNumber: string; total: number };
  DemoPayment: { order: Order };
  About: undefined;
  Tracking: { orderNumber: string; phone?: string };
  Notifications: undefined;
  Addresses: undefined;
  SignIn: undefined;
  SignUp: undefined;
  Favorites: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const icons: Record<keyof TabParamList, IconName> = {
  Home: 'home-variant',
  Categories: 'view-grid-outline',
  Orders: 'receipt-text-outline',
  Cart: 'cart-outline',
  Account: 'account-circle-outline',
};

function TabBarIcon({ route, focused, color }: { route: keyof TabParamList; focused: boolean; color: string }) {
  const { count } = useCart();
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Icon name={icons[route]} size={22} color={color} />
      {route === 'Cart' && count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </View>
  );
}

function TabNavigator() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
          tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t('tabs.home'),
          tabBarIcon: ({ focused, color }) => <TabBarIcon route="Home" focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{
          tabBarLabel: t('tabs.categories'),
          tabBarIcon: ({ focused, color }) => <TabBarIcon route="Categories" focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarLabel: t('tabs.orders'),
          tabBarIcon: ({ focused, color }) => <TabBarIcon route="Orders" focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarLabel: t('tabs.cart'),
          tabBarIcon: ({ focused, color }) => <TabBarIcon route="Cart" focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          tabBarLabel: t('tabs.account'),
          tabBarIcon: ({ focused, color }) => <TabBarIcon route="Account" focused={focused} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} options={{ animation: 'slide_from_right', presentation: 'card' }} />
      <Stack.Screen name="Category" component={CategoryScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="DemoPayment" component={DemoPaymentScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="CheckoutSuccess" component={CheckoutSuccessScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Tracking" component={OrderTrackingScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Addresses" component={AddressesScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 84,
    paddingTop: 8,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
    shadowColor: '#111111',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  tabLabel: { fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  tabItem: { paddingVertical: 2, minHeight: 58 },
  iconWrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 5, borderRadius: radii.pill },
  iconWrapActive: { backgroundColor: colors.primarySoft },
  badge: {
    position: 'absolute',
    top: -4,
    right: 10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 9, fontWeight: '900', color: colors.ink },
});