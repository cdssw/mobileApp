// mobileApp/src/App.tsx (WebView 최적화 + imageUrl 전달)

import React, { useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import CameraScreen from './src/screens/CameraScreen';


// const WEBVIEW_URL = 'http://192.168.219.103:3000/user/ocr';
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

  // --- 👇 핵심 수정 부분 ---
  const handleUploadComplete = (result: { uploadId: string; imageUrl: string }) => {
    console.log(`[App.tsx] Upload complete. Received result:`, result);
    setCameraOpen(false);

    setTimeout(() => {
      if (webViewRef.current) {
        console.log(`[App.tsx] Injecting UPLOAD_COMPLETE message with payload to WebView.`);
        // result 객체 전체를 payload로 전달합니다.
        const message = { type: 'UPLOAD_COMPLETE', payload: result };
        const script = `window.postMessage(${JSON.stringify(message)}, '*'); true;`;
        webViewRef.current.injectJavaScript(script);
      } else {
        console.error("[App.tsx] WebView ref is null after timeout. Injection failed.");
      }
    }, 500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={isCameraOpen ? styles.hidden : styles.visible}>
        <WebView
          ref={webViewRef}
          source={{ uri: WEBVIEW_URL }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={['*']}
          incognito={isCameraOpen}
          applicationNameForUserAgent="YourAppName/1.0"
        />
      </View>
      {isCameraOpen && (
        <CameraScreen
          onClose={() => setCameraOpen(false)}
          onUploadComplete={handleUploadComplete}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  visible: { flex: 1 },
  hidden: { flex: 0, height: 0, width: 0, position: 'absolute' },
});

export default App;