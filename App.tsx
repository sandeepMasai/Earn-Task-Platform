import React from 'react';
import { Provider } from 'react-redux';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <Provider store={store}>
      <StatusBar style="auto" />
      <AppNavigator />
      <Toast />
    </Provider>
  );
}

