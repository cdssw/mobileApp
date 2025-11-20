// mobileApp/src/App.tsx (PDF 다운로드 기능 추가)

import React, { useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, View, Alert, Platform } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import Share from 'react-native-share'; // ✨ 추가
import RNFS from 'react-native-fs'; // ✨ 추가
import CameraScreen from './src/screens/CameraScreen';

// const WEBVIEW_URL = 'http://10.110.130.149:3000/user/ocr';
const WEBVIEW_URL = 'http://192.168.219.103:3000/user/ocr';

const App = () => {
  const webViewRef = useRef<WebView>(null);
  const [isCameraOpen, setCameraOpen] = useState(false);

  const handleWebViewMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data?.type === 'OPEN_CAMERA') {
        setCameraOpen(true);
      }

      // ✨ PDF 다운로드 처리 추가
      if (data?.type === 'DOWNLOAD_PDF') {
        const { base64Data, filename } = data.payload;
        await handlePdfDownload(base64Data, filename);
      }

    } catch (error) {
      console.error("Failed to parse message from WebView", error);
    }
  };

  // ✨ PDF 다운로드 및 공유 처리 함수
  const handlePdfDownload = async (base64Data: string, filename: string) => {
    try {
      console.log('[PDF] Download started:', filename);

      // 임시 파일 경로 생성
      const filePath = `${RNFS.DocumentDirectoryPath}/${filename}`;

      // Base64 데이터를 파일로 저장
      await RNFS.writeFile(filePath, base64Data, 'base64');
      console.log('[PDF] File saved to:', filePath);

      // 공유 시트 열기 (iOS/Android 모두 지원)
      const shareOptions = {
        title: '여권 정보 PDF',
        message: '여권 정보가 포함된 PDF 파일입니다.',
        url: Platform.OS === 'ios' ? filePath : `file://${filePath}`,
        type: 'application/pdf',
        subject: filename,
        filename: filename,
        saveToFiles: true, // iOS Files 앱에 저장 옵션
      };

      await Share.open(shareOptions);
      console.log('[PDF] Share dialog opened successfully');

      // WebView에 성공 메시지 전송
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          window.postMessage(${JSON.stringify({
          type: 'PDF_DOWNLOAD_SUCCESS'
        })}, '*'); 
          true;
        `);
      }

      // 성공 안내 메시지
      Alert.alert(
        'PDF 저장 완료',
        Platform.select({
          ios: 'PDF가 저장되었습니다.\n\n저장 위치:\n• 파일 앱 확인\n• 선택한 앱으로 공유됨',
          android: 'PDF가 저장되었습니다.\n\n저장 위치:\n• 내 파일 > 다운로드\n• 선택한 앱으로 공유됨',
        }) || 'PDF가 저장되었습니다.',
        [{ text: '확인' }]
      );

    } catch (error: any) {
      console.error('[PDF] Download error:', error);

      // 사용자가 취소한 경우는 에러로 처리하지 않음
      if (error.message !== 'User did not share') {
        Alert.alert(
          'PDF 저장 실패',
          'PDF 파일 저장 중 오류가 발생했습니다.'
        );

        // WebView에 실패 메시지 전송
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            window.postMessage(${JSON.stringify({
            type: 'PDF_DOWNLOAD_ERROR',
            error: error.message
          })}, '*'); 
            true;
          `);
        }
      }
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
          applicationNameForUserAgent="YourAppName/1.0"
          cacheEnabled={true}
          cacheMode="LOAD_CACHE_ELSE_NETWORK"
          scrollEnabled={true}
          bounces={false}
          showsVerticalScrollIndicator={false}
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
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
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