import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider } from "@/providers/AuthProvider";
import { RealtimeSyncProvider } from "@/providers/RealtimeSyncProvider";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup-volunteer" options={{ headerShown: false }} />
      <Stack.Screen name="signup-organization" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ title: "Reset Password" }} />
      <Stack.Screen name="event-detail" options={{ title: "Event Details" }} />
      <Stack.Screen name="create-event" options={{ title: "Create Event" }} />
      <Stack.Screen name="edit-event" options={{ title: "Edit Event" }} />
      <Stack.Screen name="event-history" options={{ title: "Event History" }} />
      <Stack.Screen name="event-recap" options={{ title: "Event Recap" }} />
      <Stack.Screen name="edit-profile" options={{ title: "Edit Profile" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="shop" options={{ title: "Joy Shop" }} />
      <Stack.Screen name="followers" options={{ title: "Connections" }} />
      <Stack.Screen name="user-profile" options={{ title: "Profile" }} />
      <Stack.Screen name="org-profile" options={{ title: "Organization" }} />
      <Stack.Screen name="conversation" options={{ title: "Conversation" }} />
      <Stack.Screen name="send-announcement" options={{ title: "Send Announcement" }} />
      <Stack.Screen name="donate" options={{ title: "Donate" }} />
      <Stack.Screen name="donate-form" options={{ title: "Donate" }} />
      <Stack.Screen name="donate-webview" options={{ title: "Donate", headerShown: false }} />
      <Stack.Screen name="nominate" options={{ title: "Nominate" }} />
      <Stack.Screen name="impact" options={{ title: "Impact" }} />
      <Stack.Screen name="manage-volunteers" options={{ title: "Manage Volunteers" }} />
      <Stack.Screen name="photo-approval" options={{ title: "Photo Approval" }} />
      <Stack.Screen name="redemption-management" options={{ title: "Redemptions" }} />
      <Stack.Screen name="partners" options={{ title: "Partners" }} />
      <Stack.Screen name="client-detail" options={{ title: "Client Details" }} />
      <Stack.Screen name="event-day-of" options={{ headerShown: false }} />
      <Stack.Screen name="event-feedback" options={{ headerShown: false }} />
      <Stack.Screen name="dealt-joy-player" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <RealtimeSyncProvider>
            <RootLayoutNav />
          </RealtimeSyncProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
