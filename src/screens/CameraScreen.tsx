// mobileApp/src/src/screens/CameraScreen.tsx (개선된 크롭 로직)

import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import ImageEditor from '@react-native-community/image-editor';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

const UPLOAD_URL = 'http://192.168.219.103:3000/api/upload';

interface CameraScreenProps {
    onClose: () => void;
    onUploadComplete: (result: { uploadId: string; imageUrl: string }) => void;
}

// 화면 크기 및 가이드라인 크기/위치 계산
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const PASSPORT_ASPECT_RATIO = 1.42; // 여권 비율 (높이/너비)
const guidelineWidth = screenWidth * 0.9;
const guidelineHeight = guidelineWidth / PASSPORT_ASPECT_RATIO;
const guidelineX = (screenWidth - guidelineWidth) / 2;
const guidelineY = (screenHeight * 0.5) - (guidelineHeight / 2);

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

    // 정확한 크롭 영역 계산 함수
    const calculateCropArea = (
        photoWidth: number,
        photoHeight: number,
        orientation?: string
    ) => {
        // 카메라 프리뷰의 aspect ratio
        const cameraPreviewAspectRatio = screenHeight / screenWidth;

        // 실제 사진의 aspect ratio
        let actualPhotoWidth = photoWidth;
        let actualPhotoHeight = photoHeight;

        // orientation이 회전된 경우 처리 (landscape로 촬영된 경우)
        if (orientation === 'landscape-left' || orientation === 'landscape-right') {
            actualPhotoWidth = photoHeight;
            actualPhotoHeight = photoWidth;
        }

        const photoAspectRatio = actualPhotoHeight / actualPhotoWidth;

        // 스케일 계산 - 카메라가 화면에 어떻게 맞춰지는지
        let scaleX = 1;
        let scaleY = 1;
        let offsetX = 0;
        let offsetY = 0;

        // Cover 방식으로 화면에 맞춤 (react-native-vision-camera의 기본 동작)
        if (photoAspectRatio > cameraPreviewAspectRatio) {
            // 사진이 더 세로로 길 때
            scaleX = actualPhotoWidth / screenWidth;
            scaleY = scaleX;
            const scaledHeight = actualPhotoHeight / scaleY;
            offsetY = (scaledHeight - screenHeight) / 2;
        } else {
            // 사진이 더 가로로 길 때
            scaleY = actualPhotoHeight / screenHeight;
            scaleX = scaleY;
            const scaledWidth = actualPhotoWidth / scaleX;
            offsetX = (scaledWidth - screenWidth) / 2;
        }

        // 가이드라인의 실제 사진 상의 좌표 계산
        const cropX = Math.round((guidelineX + offsetX) * scaleX);
        const cropY = Math.round((guidelineY + offsetY) * scaleY);
        const cropWidth = Math.round(guidelineWidth * scaleX);
        const cropHeight = Math.round(guidelineHeight * scaleY);

        // 경계 체크
        const finalCropX = Math.max(0, Math.min(cropX, actualPhotoWidth - cropWidth));
        const finalCropY = Math.max(0, Math.min(cropY, actualPhotoHeight - cropHeight));
        const finalCropWidth = Math.min(cropWidth, actualPhotoWidth - finalCropX);
        const finalCropHeight = Math.min(cropHeight, actualPhotoHeight - finalCropY);

        return {
            offset: {
                x: finalCropX,
                y: finalCropY,
            },
            size: {
                width: finalCropWidth,
                height: finalCropHeight,
            },
        };
    };

    const takePhotoAndUpload = async () => {
        if (camera.current == null || isProcessing) return;
        setIsProcessing(true);
        console.log('[CameraScreen] 1. Starting photo process...');

        try {
            const photo = await camera.current.takePhoto();
            console.log(`[CameraScreen] 2. Photo taken. Path: ${photo.path}, W: ${photo.width}, H: ${photo.height}, Orientation: ${photo.orientation}`);

            // 정확한 크롭 영역 계산
            const cropData = calculateCropArea(
                photo.width,
                photo.height,
                photo.orientation
            );

            console.log(`[CameraScreen] 3. Calculated crop area:`, cropData);

            // 이미지 크롭
            // @ts-ignore - 라이브러리 타입과 실제 반환값이 다를 수 있음
            const cropResultObject = await ImageEditor.cropImage(
                `file://${photo.path}`,
                cropData
            );

            const croppedImageURI = cropResultObject?.uri || cropResultObject?.path;

            if (!croppedImageURI || typeof croppedImageURI !== 'string') {
                console.error("Failed to extract URI from crop result:", cropResultObject);
                throw new Error('Image cropping failed to return a valid URI.');
            }

            console.log(`[CameraScreen] 4. Image cropped. Final URI: ${croppedImageURI}`);

            // 서버 업로드
            const formData = new FormData();
            formData.append('file', {
                uri: croppedImageURI,
                type: 'image/jpeg',
                name: 'cropped-passport.jpg',
            } as any);

            console.log('[CameraScreen] 5. Uploading cropped file...');
            const response = await fetch(UPLOAD_URL, {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const result = await response.json();
            console.log('[CameraScreen] 6. Server response:', result);

            if (!response.ok || !result.uploadId) {
                throw new Error(result.error || 'Upload failed.');
            }

            console.log('[CameraScreen] 7. Upload successful.');
            onUploadComplete(result);

        } catch (error) {
            console.error('[CameraScreen] CRITICAL ERROR:', error);
            Alert.alert('Error', `An error occurred: ${(error as Error).message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!device) return <View style={styles.container}><Text style={styles.errorText}>No camera found.</Text></View>;
    if (!hasPermission) return <View style={styles.container}><Text style={styles.errorText}>Camera permission not granted.</Text></View>;

    return (
        <View style={styles.container}>
            <Camera
                ref={camera}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                photo={true}
                enableZoomGesture={false} // 줌 제스처 비활성화로 일관성 유지
            />

            {/* 오버레이 및 가이드라인 */}
            <View style={styles.overlay} pointerEvents="box-none">
                {/* 상단 어두운 영역 */}
                <View style={[styles.darkSection, { height: guidelineY }]} />

                {/* 중앙 영역 (가이드라인 포함) */}
                <View style={{ height: guidelineHeight, flexDirection: 'row' }}>
                    <View style={[styles.darkSection, { width: guidelineX }]} />
                    <View style={styles.guideline}>
                        {/* 모서리 마커 추가 (선택사항) */}
                        <View style={[styles.corner, styles.cornerTopLeft]} />
                        <View style={[styles.corner, styles.cornerTopRight]} />
                        <View style={[styles.corner, styles.cornerBottomLeft]} />
                        <View style={[styles.corner, styles.cornerBottomRight]} />
                    </View>
                    <View style={styles.darkSection} />
                </View>

                {/* 하단 어두운 영역 */}
                <View style={styles.darkSection} />

                {/* 안내 텍스트 */}
                <View style={styles.textContainer}>
                    <Text style={styles.guidelineText}>여권을 이 안에 맞춰주세요</Text>
                </View>
            </View>

            {/* 닫기 버튼 */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.buttonText}>✕</Text>
            </TouchableOpacity>

            {/* 촬영 버튼 */}
            <View style={styles.captureButtonContainer}>
                {isProcessing ? (
                    <ActivityIndicator size="large" color="#fff" />
                ) : (
                    <TouchableOpacity
                        style={styles.captureButton}
                        onPress={takePhotoAndUpload}
                        disabled={isProcessing}
                    />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black'
    },
    errorText: {
        color: 'white',
        fontSize: 18,
        textAlign: 'center',
        marginTop: 50
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent'
    },
    darkSection: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)'
    },
    guideline: {
        width: guidelineWidth,
        height: guidelineHeight,
        borderColor: '#4CAF50',
        borderWidth: 2,
        borderRadius: 12,
        position: 'relative',
    },
    // 모서리 마커 스타일 (선택사항)
    corner: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderColor: '#4CAF50',
        borderWidth: 3,
    },
    cornerTopLeft: {
        top: -2,
        left: -2,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderTopLeftRadius: 12,
    },
    cornerTopRight: {
        top: -2,
        right: -2,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
        borderTopRightRadius: 12,
    },
    cornerBottomLeft: {
        bottom: -2,
        left: -2,
        borderRightWidth: 0,
        borderTopWidth: 0,
        borderBottomLeftRadius: 12,
    },
    cornerBottomRight: {
        bottom: -2,
        right: -2,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderBottomRightRadius: 12,
    },
    textContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: guidelineY - 40,
        alignItems: 'center'
    },
    guidelineText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 1,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
    },
    captureButtonContainer: {
        position: 'absolute',
        bottom: 50,
        alignSelf: 'center',
        zIndex: 1
    },
    captureButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'white',
        borderWidth: 5,
        borderColor: '#4CAF50'
    },
});

export default CameraScreen;