import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import Ionicons from "react-native-vector-icons/Ionicons"
import { useAuth } from "@/auth/AuthProvider"
import { AppBootScreen } from "@/components/AppBootScreen"
import { useI18n } from "@/i18n/I18nProvider"
import AccountScreen from "@/screens/AccountScreen"
import AlertsScreen from "@/screens/AlertsScreen"
import CaptureScreen from "@/screens/CaptureScreen"
import HomeScreen from "@/screens/HomeScreen"
import VideosScreen from "@/screens/VideosScreen"
import type { MainTabParamList } from "./types"

const Tab = createBottomTabNavigator<MainTabParamList>()

export function TabNavigator() {
  const { ready } = useAuth()
  const { messages } = useI18n()
  if (!ready) return <AppBootScreen />
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: "#0f172a", borderTopColor: "#334155" },
        tabBarActiveTintColor: "#38bdf8",
        tabBarInactiveTintColor: "#94a3b8",
        headerStyle: { backgroundColor: "#0f172a" },
        headerTintColor: "#f8fafc",
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: messages.home.title,
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Capture"
        component={CaptureScreen}
        options={{
          title: messages.capture.title,
          tabBarButton: () => null,
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tab.Screen
        name="Videos"
        component={VideosScreen}
        options={{
          title: messages.videos.title,
          tabBarIcon: ({ color, size }) => <Ionicons name="film-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          title: messages.notifications.title,
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          title: messages.account.title,
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  )
}
