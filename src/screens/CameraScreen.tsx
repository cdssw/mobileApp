// mobileApp/src/screens/CameraScreen.tsx (최종 수정본)

import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, TakePhotoOptions } from 'react-native-vision-camera';
import ImageResizer from 'react-native-image-resizer';
import RNFS from 'react-native-fs';

interface CameraScreenProps {
    onClose: () => void;
    onPhotoTaken: (base64Data: string) => void;
}

const CameraScreen = ({ onClose, onPhotoTaken }: CameraScreenProps) => {
    const { hasPermission, requestPermission } = useCameraPermission();
    const device = useCameraDevice('back');
    const camera = useRef<Camera>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [flash, setFlash] = useState<TakePhotoOptions['flash']>('off');

    useEffect(() => {
        if (!hasPermission) {
            requestPermission();
        }
    }, [hasPermission, requestPermission]);

    const takePhoto = async () => {
        if (camera.current == null || isProcessing) return;
        setIsProcessing(true);
        console.log('[CameraScreen] 1. Starting photo process...');

        try {
            // 1. 사진 촬영
            const photo = await camera.current.takePhoto({ flash: flash });
            console.log(`[CameraScreen] 2. Photo taken successfully. Path: ${photo.path}`);

            // 2. 이미지 압축 및 리사이즈
            const resizedImage = await ImageResizer.createResizedImage(
                `file://${photo.path}`, 1600, 1600, 'JPEG', 70, 0
            );
            console.log(`[CameraScreen] 3. Image resized. Size: ${(resizedImage.size / 1024).toFixed(2)} KB`);

            if (resizedImage.size > 4 * 1024 * 1024) {
                Alert.alert('Error', 'Image size is too large after compression (> 4MB).');
                setIsProcessing(false);
                return;
            }

            // 3. 압축된 이미지를 Base64 문자열로 변환
            console.log('[CameraScreen] 4. Reading file to Base64...');
            const base64Data = await RNFS.readFile(resizedImage.uri, 'base64');
            console.log(`[CameraScreen] 5. Base64 data created. Length: ${base64Data.length}`);

            // 4. Base64 데이터를 부모 컴포넌트(App.tsx)로 전달
            console.log('[CameraScreen] 6. Calling onPhotoTaken to pass data to WebView...');
            onPhotoTaken(base64Data);
            console.log('[CameraScreen] 7. onPhotoTaken call finished.');

        } catch (error) {
            console.error('[CameraScreen] CRITICAL ERROR in takePhoto:', error);
            Alert.alert(
                'Processing Error',
                `An error occurred while processing the photo: ${(error as Error).message}`
            );
            setIsProcessing(false);
        }
    };

    if (device == null) {
        return <View style={styles.container}><Text>No camera device found.</Text></View>;
    }
    if (!hasPermission) {
        return <View style={styles.container}><Text>No camera permission.</Text></View>;
    }

    // --- 👇 여기가 누락되었던 JSX 렌더링 부분입니다 ---
    return (
        <View style={styles.container}>
            <Camera ref={camera} style={StyleSheet.absoluteFill} device={device} isActive={true} photo={true} />

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.buttonText}>X</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.flashButton} onPress={() => setFlash(f => f === 'on' ? 'off' : 'on')}>
                <Text style={styles.buttonText}>⚡️ {flash}</Text>
            </TouchableOpacity>

            <View style={styles.captureButtonContainer}>
                {isProcessing ? (
                    <ActivityIndicator size="large" color="#fff" />
                ) : (
                    <TouchableOpacity style={styles.captureButton} onPress={takePhoto} />
                )}
            </View>
        </View>
    );
};

// --- 👇 여기가 누락되었던 styles 정의 부분입니다 ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'black' },
    closeButton: { position: 'absolute', top: 50, left: 30, zIndex: 10, padding: 10 },
    flashButton: { position: 'absolute', top: 50, right: 30, zIndex: 10, padding: 10 },
    buttonText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
    captureButtonContainer: { position: 'absolute', bottom: 50, alignSelf: 'center' },
    captureButton: {
        width: 70, height: 70, borderRadius: 35,
        backgroundColor: 'white', borderWidth: 4, borderColor: 'gray',
    },
});

export default CameraScreen;