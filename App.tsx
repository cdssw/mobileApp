// mobileApp/src/App.tsx (상태 추적 강화)

import React, { useRef, useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import CameraScreen from './src/screens/CameraScreen';

const WEBVIEW_URL = 'http://192.168.219.103:3000/user/ocr';

const App = () => {
  const webViewRef = useRef<WebView>(null);
  const [isCameraOpen, setCameraOpen] = useState(false);
  const [pendingBase64, setPendingBase64] = useState<string | null>(null);
  const [isWebViewReady, setIsWebViewReady] = useState(false);

  // --- 👇 로그 추가 1: pendingBase64 상태가 변경될 때마다 로그를 출력합니다 ---
  useEffect(() => {
    if (pendingBase64) {
      console.log(`[App.tsx State Check] pendingBase64 state updated. Length: ${pendingBase64.length}`);
    } else {
      console.log('[App.tsx State Check] pendingBase64 state is now null.');
    }
  }, [pendingBase64]);

  // 스크립트 주입을 위한 useEffect
  useEffect(() => {
    if (pendingBase64 && isWebViewReady && webViewRef.current) {
      console.log('[App.tsx Injector] Conditions met. Injecting script...');
      const script = `window.postMessage('${pendingBase64}', '*'); true;`;
      webViewRef.current.injectJavaScript(script);
      console.log('[App.tsx Injector] Script injection finished.');
      // 스크립트 주입 후에는 상태를 초기화하여 중복 주입을 방지합니다.
      setPendingBase64(null);
    }
  }, [pendingBase64, isWebViewReady]);

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    // 이전에 추가했던 "핑퐁 테스트" 관련 로그는 그대로 둡니다.
    console.log('[App.tsx] Received message from WebView. Raw data:', event.nativeEvent.data);
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[App.tsx] Parsed message data:', data);

      if (data?.type === 'OPEN_CAMERA') {
        console.log('[App.tsx] OPEN_CAMERA message received. Opening camera...');
        setCameraOpen(true);
      } else if (data?.type === 'ACK_DATA_RECEIVED') {
        console.log('✅✅✅ [App.tsx] SUCCESS! WebView confirmed data reception (Pong).');
      } else if (data?.type === 'WEBVIEW_READY') {
        console.log('[App.tsx] WebView reported it is ready.');
      }
    } catch (error) {
      console.error('[App.tsx] Failed to parse message from WebView.', error);
    }
  };

  const handleCameraClose = () => {
    console.log('[App.tsx] Closing camera screen.');
    setCameraOpen(false);
  };

  const handlePhotoTaken = (base64Data: string) => {
    console.log('[App.tsx] handlePhotoTaken called. Setting pendingBase64 state...');
    setCameraOpen(false);
    // 상태를 설정합니다. 위의 useEffect가 이 변경을 감지하고 로그를 찍을 것입니다.
    setPendingBase64(base64Data);
  };

  if (isCameraOpen) {
    return (
      <CameraScreen
        onClose={handleCameraClose}
        onPhotoTaken={handlePhotoTaken}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: WEBVIEW_URL }}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        onError={(e) => console.error('[App.tsx] WebView loading error: ', e.nativeEvent)}
        onHttpError={(e) => console.error(`[App.tsx] HTTP error:`, e.nativeEvent)}
        onLoadEnd={() => {
          console.log('[App.tsx] WebView content load ended. Setting isWebViewReady to true.');
          setIsWebViewReady(true);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;