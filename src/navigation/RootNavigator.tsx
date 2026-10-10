import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { StatusBar } from "react-native"
import { useAuth } from "@/auth/AuthProvider"
import { AppBootScreen } from "@/components/AppBootScreen"
import AthleteScheduleScreen from "@/screens/AthleteScheduleScreen"
import SignInScreen from "@/screens/SignInScreen"
import TeamScheduleScreen from "@/screens/TeamScheduleScreen"
import VideoDetailScreen from "@/screens/VideoDetailScreen"
import { navigationLinking } from "./linking"
import { TabNavigator } from "./TabNavigator"
import type { RootStackParamList } from "./types"

const Stack = createNativeStackNavigator<RootStackParamList>()

const screenOptions = {
  headerStyle: { backgroundColor: "#0f172a" },
  headerTintColor: "#f8fafc",
}

export function RootNavigator() {
  const { ready, signedIn } = useAuth()
  if (!ready) return <AppBootScreen />
  return (
    <NavigationContainer linking={navigationLinking}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <Stack.Navigator screenOptions={screenOptions}>
        {signedIn ? (
          <>
            <Stack.Screen name="Main" component={TabNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="VideoDetail" component={VideoDetailScreen} options={{ title: "Video" }} />
            <Stack.Screen name="AthleteSchedule" component={AthleteScheduleScreen} />
            <Stack.Screen name="TeamSchedule" component={TeamScheduleScreen} />
          </>
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
