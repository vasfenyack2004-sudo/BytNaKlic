import { Stack } from 'expo-router';
import React from 'react';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        // Ховаємо стандартний верхній бар, бо в тебе є свій кастомний золотий хедер
        headerShown: false, 
        // Робимо фон прозорим, щоб він не перебивав твою цеглу
        contentStyle: { backgroundColor: 'transparent' }
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}