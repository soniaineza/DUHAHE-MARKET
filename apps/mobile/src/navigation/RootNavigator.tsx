import { BottomTabBar, createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useNavigation, type NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Order } from '@duhahe/shared';

import Icon, { type IconName } from '../components/Icon';
import DesktopHeader from '../components/DesktopHeader';

import HomeScreen from '../screens/HomeScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import CheckoutSuccessScreen from '../screens/CheckoutSuccessScreen';
import PaymentScreen from '../screens/PaymentScreen';
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
  Payment: { order: Order };
  About: undefined;
  Tracking: { orderNumber: string; phone?: string };
  Notifications: undefined;
  Addresses: undefined;
  SignIn: undefined;
  SignUp: undefined;
  Favorites: undefined;
};

/**
 * Keeps form-style screens a readable width and centred on wide displays,
 * instead of stretching edge to edge across a monitor. Phones are unaffected.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function narrow(Screen: React.ComponentType<any>, maxWidth = 720) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Wrapped = (props: any) => (
    <View style={{ flex: 1, width: '100%', maxWidth, alignSelf: 'center' }}>
      <Screen {...props} />
    </View>
  );
  Wrapped.displayName = `Narrow(${Screen.displayName || Screen.name || 'Screen'})`;
  return Wrapped;
}

const Cart = narrow(CartScreen, 860);
const Checkout = narrow(CheckoutScreen, 860);
const Payment = narrow(PaymentScreen, 640);
const CheckoutSuccess = narrow(CheckoutSuccessScreen, 640);
const About = withChrome(narrow(AboutScreen, 760));
const Tracking = withChrome(narrow(OrderTrackingScreen, 760));
const Notifications = withChrome(narrow(NotificationsScreen, 760));
const Addresses = withChrome(narrow(AddressesScreen, 760));
const SignIn = narrow(SignInScreen, 520);
const SignUp = narrow(SignUpScreen, 520);
const Orders = narrow(OrdersScreen, 860);
const Account = narrow(AccountScreen, 760);

type TabName = keyof TabParamList;
type Overlay = 'Search' | 'About' | 'Notifications' | 'Addresses';
const DESKTOP_MIN = 900;

/**
 * Desktop navigation for the five tab screens: the site header replaces the bottom bar.
 * The header only needs "go to tab" and "open overlay"; this adapts them to the tab navigator.
 */
function TabsDesktopHeader({ state, navigation }: BottomTabBarProps) {
  const active = state.routes[state.index]?.name as TabName | undefined;
  const go = (tab: TabName) => {
    const route = state.routes.find((r) => r.name === tab);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(tab as never);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const open = (screen: Overlay) => (navigation.getParent() as any)?.navigate(screen, screen === 'Search' ? { q: undefined } : undefined);
  return <DesktopHeader active={active} go={go} open={open} />;
}

/**
 * Puts the same desktop header above browse screens that live outside the tabs (category, product,
 * search, ...), so desktop visitors keep their navigation everywhere. Phones are untouched.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withChrome(Screen: React.ComponentType<any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Wrapped = (props: any) => {
    const { width } = useWindowDimensions();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = useNavigation<any>();
    if (width < DESKTOP_MIN) return <Screen {...props} />;
    return (
      <View style={{ flex: 1 }}>
        <DesktopHeader
          go={(tab) => nav.navigate('Tabs', { screen: tab })}
          open={(screen) => nav.navigate(screen, screen === 'Search' ? { q: undefined } : undefined)}
        />
        <View style={{ flex: 1 }}>
          <Screen {...props} />
        </View>
      </View>
    );
  };
  Wrapped.displayName = `Chrome(${Screen.displayName || Screen.name || 'Screen'})`;
  return Wrapped;
}

const ProductDetails = withChrome(ProductDetailsScreen);
const CategoryPage = withChrome(CategoryScreen);
const SearchPage = withChrome(SearchScreen);
const FavoritesPage = withChrome(FavoritesScreen);

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const icons: Record<keyof TabParamList, IconName> = {
  Home: 'home-variant',
  Categories: 'view-grid-outline',
  Orders: 'receipt-text-outline',
  Cart: 'cart-outline',
  Account: 'account-circle-outline',
};

function TabBarIcon({
  route,
  focused,
  color,
}: {
  route: keyof TabParamList;
  focused: boolean;
  color: string;
}) {
  const { count } = useCart();

  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Icon
        name={icons[route]}
        size={24}
        color={focused ? colors.surface : color}
      />

      {route === 'Cart' && count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </View>
  );
}

function TabNavigator() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = width >= DESKTOP_MIN;

  // Phones / small tablets: compact bottom bar that respects the safe area.
  const tabBarStyle = [
    styles.tabBar,
    {
      height: TAB_BAR_HEIGHT + insets.bottom,
      paddingBottom: insets.bottom + 8,
    },
  ];

  return (
    <Tab.Navigator
      tabBar={(props) => (desktop ? <TabsDesktopHeader {...props} /> : <BottomTabBar {...props} />)}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle,
        // Desktop: site header on top. Elsewhere: the bottom bar.
        tabBarPosition: desktop ? 'top' : 'bottom',
        // Wide viewports otherwise default to side-by-side labels, which collide with the active pill.
        tabBarLabelPosition: 'below-icon',
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
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon
              route="Home"
              focused={focused}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{
          tabBarLabel: t('tabs.categories'),
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon
              route="Categories"
              focused={focused}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Orders"
        component={Orders}
        options={{
          tabBarLabel: t('tabs.orders'),
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon
              route="Orders"
              focused={focused}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Cart"
        component={Cart}
        options={{
          tabBarLabel: t('tabs.cart'),
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon
              route="Cart"
              focused={focused}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Account"
        component={Account}
        options={{
          tabBarLabel: t('tabs.account'),
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon
              route="Account"
              focused={focused}
              color={color}
            />
          ),
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

      <Stack.Screen
        name="SignIn"
        component={SignIn}
        options={{ animation: 'fade' }}
      />

      <Stack.Screen
        name="SignUp"
        component={SignUp}
        options={{ animation: 'slide_from_right' }}
      />

      <Stack.Screen
        name="ProductDetails"
        component={ProductDetails}
        options={{
          animation: 'slide_from_right',
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name="Category"
        component={CategoryPage}
        options={{ animation: 'slide_from_right' }}
      />

      <Stack.Screen
        name="Search"
        component={SearchPage}
        options={{ animation: 'slide_from_right' }}
      />

      <Stack.Screen
        name="Checkout"
        component={Checkout}
        options={{ animation: 'slide_from_bottom' }}
      />

      <Stack.Screen
        name="Payment"
        component={Payment}
        options={{ animation: 'fade' }}
      />

      <Stack.Screen
        name="CheckoutSuccess"
        component={CheckoutSuccess}
        options={{ animation: 'fade' }}
      />

      <Stack.Screen
        name="About"
        component={About}
        options={{ animation: 'slide_from_right' }}
      />

      <Stack.Screen
        name="Tracking"
        component={Tracking}
        options={{ animation: 'fade' }}
      />

      <Stack.Screen
        name="Notifications"
        component={Notifications}
        options={{ animation: 'slide_from_right' }}
      />

      <Stack.Screen
        name="Addresses"
        component={Addresses}
        options={{ animation: 'slide_from_right' }}
      />

      <Stack.Screen
        name="Favorites"
        component={FavoritesPage}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}

const TAB_BAR_HEIGHT = 70;

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    elevation: 8,
  },

  tabLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    marginTop: 2,
  },

  tabItem: {
    paddingVertical: 0,
  },

  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 30,
    borderRadius: radii.pill,
  },

  iconWrapActive: {
    backgroundColor: colors.ink,
  },

  badge: {
    position: 'absolute',
    top: -7,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.ink,
  },
});