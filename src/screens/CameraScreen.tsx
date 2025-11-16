// mobileApp/src/src/screens/CameraScreen.tsx (파일 업로드 버전)

import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import ImageResizer from 'react-native-image-resizer';

const UPLOAD_URL = 'http://192.168.219.103:3000/api/upload';

// --- 👇 핵심 수정 부분 ---
interface CameraScreenProps {
    onClose: () => void;
    // 이제 uploadId와 imageUrl이 포함된 객체를 전달합니다.
    onUploadComplete: (result: { uploadId: string; imageUrl: string }) => void;
}

const CameraScreen = ({ onClose, onUploadComplete }: CameraScreenProps) => {
    const { hasPermission, requestPermission } = useCameraPermission();
    const device = useCameraDevice('back');
    const camera = useRef<Camera>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (!hasPermission) {
            requestPermission();
        }
    }, [hasPermission, requestPermission]);

    const takePhotoAndUpload = async () => {
        if (camera.current == null || isProcessing) return;
        setIsProcessing(true);
        console.log('[CameraScreen] 1. Starting photo and upload process...');

        try {
            const photo = await camera.current.takePhoto();
            console.log(`[CameraScreen] 2. Photo taken. Path: ${photo.path}`);

            const resizedImage = await ImageResizer.createResizedImage(
                `file://${photo.path}`, 1600, 1600, 'JPEG', 70, 0
            );
            console.log(`[CameraScreen] 3. Image resized. URI: ${resizedImage.uri}, Size: ${resizedImage.size}`);

            const formData = new FormData();
            formData.append('file', {
                uri: resizedImage.uri,
                type: 'image/jpeg',
                name: resizedImage.name,
            });

            console.log('[CameraScreen] 4. Uploading file to server...');
            const response = await fetch(UPLOAD_URL, {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const result = await response.json();
            console.log('[CameraScreen] 5. Server response received:', result);

            if (!response.ok || !result.uploadId || !result.imageUrl) {
                throw new Error(result.error || 'File upload failed or did not return required data.');
            }

            // --- 👇 핵심 수정 부분 ---
            // 성공 시, 서버가 반환한 result 객체 전체를 부모 컴포넌트로 전달합니다.
            console.log('[CameraScreen] 6. Upload successful. Calling onUploadComplete...');
            onUploadComplete(result);

        } catch (error) {
            console.error('[CameraScreen] CRITICAL ERROR:', error);
            Alert.alert('Error', `An error occurred during processing: ${(error as Error).message}`);
            setIsProcessing(false);
        }
    };

    if (!device) return <View style={styles.container}><Text>No camera found.</Text></View>;

    return (
        <View style={styles.container}>
            <Camera ref={camera} style={StyleSheet.absoluteFill} device={device} isActive={true} photo={true} />
            <TouchableOpacity style={styles.closeButton} onPress={onClose}><Text style={styles.buttonText}>X</Text></TouchableOpacity>
            <View style={styles.captureButtonContainer}>
                {isProcessing ? (
                    <ActivityIndicator size="large" color="#fff" />
                ) : (
                    <TouchableOpacity style={styles.captureButton} onPress={takePhotoAndUpload} />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'black' },
    closeButton: { position: 'absolute', top: 50, left: 30, zIndex: 10, padding: 10 },
    buttonText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
    captureButtonContainer: { position: 'absolute', bottom: 50, alignSelf: 'center' },
    captureButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'white', borderWidth: 4, borderColor: 'gray' },
});

export default CameraScreen;