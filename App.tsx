// mobileApp/src/App.tsx (WebView 크기 고정 버전)

import React, { useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import CameraScreen from './src/screens/CameraScreen';

const WEBVIEW_URL = 'http://10.110.130.109:3000/user/ocr';

const App = () => {
  const webViewRef = useRef<WebView>(null);
  const [isCameraOpen, setCameraOpen] = useState(false);

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === 'OPEN_CAMERA') {
        setCameraOpen(true);
      }
    } catch (error) {
      console.error("Failed to parse message from WebView", error);
    }
  };

  const handleUploadComplete = (result: { uploadId: string; imageUrl: string }) => {
    console.log(`[App.tsx] Upload complete. Received result:`, result);

    // ✨ 먼저 WebView에 메시지 전송 (카메라 닫기 전)
    if (webViewRef.current) {
      console.log(`[App.tsx] Injecting UPLOAD_COMPLETE message with payload to WebView.`);
      const message = { type: 'UPLOAD_COMPLETE', payload: result };
      const script = `window.postMessage(${JSON.stringify(message)}, '*'); true;`;
      webViewRef.current.injectJavaScript(script);
    }

    // ✨ 메시지 전송 후 카메라 닫기
    setTimeout(() => {
      setCameraOpen(false);
    }, 100);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ✨ WebView를 항상 전체 크기로 유지 */}
      <View style={styles.webviewContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: WEBVIEW_URL }}
          style={styles.webview}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={['*']}
          // ✨ incognito 제거 (WebView 재생성 방지)
          applicationNameForUserAgent="YourAppName/1.0"
          // ✨ 캐시 활성화로 빠른 복원
          cacheEnabled={true}
          cacheMode="LOAD_CACHE_ELSE_NETWORK"
          // ✨ 스크롤 관련 안정화
          scrollEnabled={true}
          bounces={false}
          showsVerticalScrollIndicator={false}
          // ✨ viewport 메타 태그
          injectedJavaScriptBeforeContentLoaded={`
            window.isReactNativeWebView = true;
            true;
          `}
          injectedJavaScript={`
            const meta = document.createElement('meta');
            meta.setAttribute('name', 'viewport');
            meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
            const existingMeta = document.querySelector('meta[name="viewport"]');
            if (existingMeta) {
              existingMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
            } else {
              document.getElementsByTagName('head')[0].appendChild(meta);
            }
            true;
          `}
        />
      </View>

      {/* ✨ 카메라를 절대 위치로 WebView 위에 오버레이 */}
      {isCameraOpen && (
        <View style={styles.cameraContainer}>
          <CameraScreen
            onClose={() => setCameraOpen(false)}
            onUploadComplete={handleUploadComplete}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webviewContainer: {
    flex: 1,
    // ✨ 크기가 절대 변하지 않음
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  // ✨ 카메라를 절대 위치로 전체 화면 오버레이
  cameraContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: '#000000',
  },
});

export default App;