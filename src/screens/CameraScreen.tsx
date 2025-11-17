// mobileApp/src/src/screens/CameraScreen.tsx (터치 문제 해결 버전)

import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import ImageResizer from 'react-native-image-resizer';

const UPLOAD_URL = 'http://192.168.219.103:3000/api/upload';

interface CameraScreenProps {
    onClose: () => void;
    onUploadComplete: (result: { uploadId: string; imageUrl: string }) => void;
}

// 화면 크기 및 가이드라인 크기 계산
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const PASSPORT_ASPECT_RATIO = 1.42;
const guidelineWidth = screenWidth * 0.9;
const guidelineHeight = guidelineWidth / PASSPORT_ASPECT_RATIO;
// 가이드라인의 상단 Y 좌표 계산
const guidelineY = (screenHeight * 0.5) - (guidelineHeight / 2) - 60; // 화면 중앙보다 살짝 위로

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
        try {
            const photo = await camera.current.takePhoto();
            const resizedImage = await ImageResizer.createResizedImage(
                `file://${photo.path}`, 1600, 1600, 'JPEG', 70, 0
            );
            const formData = new FormData();
            formData.append('file', {
                uri: resizedImage.uri,
                type: 'image/jpeg',
                name: resizedImage.name,
            });
            const response = await fetch(UPLOAD_URL, {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const result = await response.json();
            if (!response.ok || !result.uploadId || !result.imageUrl) {
                throw new Error(result.error || 'File upload failed.');
            }
            onUploadComplete(result);
        } catch (error) {
            Alert.alert('Error', `An error occurred: ${(error as Error).message}`);
            setIsProcessing(false);
        }
    };

    if (!device) return <View style={styles.container}><Text style={styles.errorText}>No camera found.</Text></View>;
    if (!hasPermission) return <View style={styles.container}><Text style={styles.errorText}>Camera permission not granted.</Text></View>;

    return (
        // --- 👇 최상위 뷰에 pointerEvents="box-none" 적용 ---
        // 이 뷰 자체는 터치를 받지 않지만, 자식들은 터치를 받을 수 있습니다.
        <View style={styles.container} pointerEvents="box-none">

            <Camera ref={camera} style={StyleSheet.absoluteFill} device={device} isActive={true} photo={true} />

            {/* --- 👇 오버레이 뷰에도 pointerEvents="box-none" 적용 --- */}
            {/* 이 뷰 자체는 터치를 무시하지만, 자식들은 pointerEvents 설정에 따라 동작합니다. */}
            <View style={styles.overlay} pointerEvents="box-none">

                {/* 상단 어두운 영역: 터치 이벤트를 무시하고 통과시킴 */}
                <View style={[styles.darkSection, { height: guidelineY }]} pointerEvents="none" />

                {/* 중간 영역 (가이드라인 포함) */}
                <View style={{ height: guidelineHeight, flexDirection: 'row' }} pointerEvents="box-none">
                    {/* 왼쪽 어두운 영역 */}
                    <View style={styles.darkSection} pointerEvents="none" />
                    {/* 가이드라인 테두리 */}
                    <View style={styles.guideline} />
                    {/* 오른쪽 어두운 영역 */}
                    <View style={styles.darkSection} pointerEvents="none" />
                </View>

                {/* 하단 어두운 영역 */}
                <View style={styles.darkSection} pointerEvents="none" />

                {/* 안내 문구는 별도의 절대 위치 컨테이너로 배치 */}
                <View style={styles.textContainer} pointerEvents="none">
                    <Text style={styles.guidelineText}>여권을 이 안에 맞춰주세요</Text>
                </View>
            </View>

            {/* 버튼들은 이제 오버레이에 막히지 않고 정상적으로 터치됩니다. */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.buttonText}>X</Text>
            </TouchableOpacity>

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
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    errorText: {
        color: 'white',
        fontSize: 18,
        textAlign: 'center',
        marginTop: 50,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    darkSection: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    guideline: {
        width: guidelineWidth,
        height: guidelineHeight,
        borderColor: 'white',
        borderWidth: 2,
        borderRadius: 12,
        borderStyle: 'dashed',
    },
    textContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: guidelineY + (guidelineHeight / 2) - 15, // 가이드라인 중앙에 위치
        alignItems: 'center',
    },
    guidelineText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 5,
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 1, // 오버레이보다 위에 있도록
        padding: 10,
    },
    buttonText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
    },
    captureButtonContainer: {
        position: 'absolute',
        bottom: 50,
        alignSelf: 'center',
        zIndex: 1,
    },
    captureButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'white',
        borderWidth: 4,
        borderColor: 'gray',
    },
});

export default CameraScreen;