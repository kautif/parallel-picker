import { Image } from 'expo-image';
import { Platform, StyleSheet } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import Prepare from '@/components/Prepare';

import { NavigationIndependentTree } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Link } from 'expo-router';
import Backfill from '@/components/Backfill';
import Merge from '@/components/Merge';

const Stack = createNativeStackNavigator();

export default function HomeScreen() {
  return (
    <NavigationIndependentTree>
      <Stack.Navigator screenOptions={{ headerShown: false}}>
        <Stack.Screen name="Prepare" component={Prepare} options={{orientation: 'landscape_left'}}></Stack.Screen>
        <Stack.Screen name="Backfill" component={Backfill} options={{orientation: 'landscape_left'}}></Stack.Screen>
        <Stack.Screen name="Merge" component={Merge} options={{orientation: 'landscape_left'}}></Stack.Screen>
      </Stack.Navigator>
    </NavigationIndependentTree>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
