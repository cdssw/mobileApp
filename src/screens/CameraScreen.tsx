// mobileApp/src/src/screens/CameraScreen.tsx (개선된 크롭 로직 - 완전판)

import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import ImageEditor from '@react-native-community/image-editor';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

const UPLOAD_URL = 'http://10.110.130.109:3000/api/upload';

interface CameraScreenProps {
    onClose: () => void;
    onUploadComplete: (result: { uploadId: string; imageUrl: string }) => void;
}

// ========== 설정 영역 ==========
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const PASSPORT_ASPECT_RATIO = 1.42; // 여권 비율 (높이/너비)

// ✨ 크롭 안전 마진 설정 (가이드보다 넓게 크롭하여 잘림 방지)
// 0.03 ~ 0.1 범위에서 조정 가능 (권장: 0.05)
const CROP_SAFETY_MARGIN = 0.05; // 5% 여유

// 화면에 표시될 가이드라인 (사용자가 보는 영역)
const guidelineWidth = screenWidth * 0.9;
const guidelineHeight = guidelineWidth / PASSPORT_ASPECT_RATIO;
const guidelineX = (screenWidth - guidelineWidth) / 2;
const guidelineY = (screenHeight * 0.5) - (guidelineHeight / 2);

// ==============================

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

    // 정확한 크롭 영역 계산 함수 (안전 마진 적용)
    const calculateCropArea = (
        photoWidth: number,
        photoHeight: number,
        orientation?: string
    ) => {
        // 실제 사진의 너비/높이 (orientation 고려)
        let actualPhotoWidth = photoWidth;
        let actualPhotoHeight = photoHeight;

        if (orientation === 'landscape-left' || orientation === 'landscape-right') {
            actualPhotoWidth = photoHeight;
            actualPhotoHeight = photoWidth;
        }

        // 카메라 프리뷰와 실제 사진의 aspect ratio
        const cameraPreviewAspectRatio = screenHeight / screenWidth;
        const photoAspectRatio = actualPhotoHeight / actualPhotoWidth;

        // 스케일 계산 - 카메라가 화면에 어떻게 맞춰지는지 (Cover 방식)
        let scaleX = 1;
        let scaleY = 1;
        let offsetX = 0;
        let offsetY = 0;

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

        // ✨ 안전 마진을 적용한 확장된 크롭 영역 계산
        const marginX = guidelineWidth * CROP_SAFETY_MARGIN;
        const marginY = guidelineHeight * CROP_SAFETY_MARGIN;

        const expandedGuideX = guidelineX - marginX;
        const expandedGuideY = guidelineY - marginY;
        const expandedGuideWidth = guidelineWidth + (marginX * 2);
        const expandedGuideHeight = guidelineHeight + (marginY * 2);

        // 실제 사진 상의 픽셀 좌표로 변환
        const cropX = Math.round((expandedGuideX + offsetX) * scaleX);
        const cropY = Math.round((expandedGuideY + offsetY) * scaleY);
        const cropWidth = Math.round(expandedGuideWidth * scaleX);
        const cropHeight = Math.round(expandedGuideHeight * scaleY);

        // 경계 체크 (사진 범위를 벗어나지 않도록)
        const finalCropX = Math.max(0, Math.min(cropX, actualPhotoWidth - cropWidth));
        const finalCropY = Math.max(0, Math.min(cropY, actualPhotoHeight - cropHeight));
        const finalCropWidth = Math.min(cropWidth, actualPhotoWidth - finalCropX);
        const finalCropHeight = Math.min(cropHeight, actualPhotoHeight - finalCropY);

        // 상세 로깅
        console.log('========== CROP CALCULATION DEBUG ==========');
        console.log(`[Photo] Original: ${photoWidth}x${photoHeight}, Orientation: ${orientation}`);
        console.log(`[Photo] Actual: ${actualPhotoWidth}x${actualPhotoHeight}`);
        console.log(`[Screen] Size: ${screenWidth}x${screenHeight}`);
        console.log(`[Guide] Display: ${guidelineWidth.toFixed(1)}x${guidelineHeight.toFixed(1)} at (${guidelineX.toFixed(1)}, ${guidelineY.toFixed(1)})`);
        console.log(`[Guide] Expanded (${(CROP_SAFETY_MARGIN * 100).toFixed(0)}% margin): ${expandedGuideWidth.toFixed(1)}x${expandedGuideHeight.toFixed(1)}`);
        console.log(`[Scale] X: ${scaleX.toFixed(3)}, Y: ${scaleY.toFixed(3)}`);
        console.log(`[Offset] X: ${offsetX.toFixed(1)}, Y: ${offsetY.toFixed(1)}`);
        console.log(`[Crop] Calculated: ${cropWidth}x${cropHeight} at (${cropX}, ${cropY})`);
        console.log(`[Crop] Final: ${finalCropWidth}x${finalCropHeight} at (${finalCropX}, ${finalCropY})`);
        console.log('==========================================');

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
        console.log('[CameraScreen] 📸 Starting photo capture process...');

        try {
            // 1. 사진 촬영
            const photo = await camera.current.takePhoto();
            console.log(`[CameraScreen] ✅ Photo captured successfully`);
            console.log(`[CameraScreen] Path: ${photo.path}`);

            // 2. 크롭 영역 계산
            const cropData = calculateCropArea(
                photo.width,
                photo.height,
                photo.orientation
            );

            // 3. 이미지 크롭
            console.log(`[CameraScreen] ✂️ Starting image crop...`);
            // @ts-ignore - 라이브러리 타입과 실제 반환값이 다를 수 있음
            const cropResultObject = await ImageEditor.cropImage(
                `file://${photo.path}`,
                cropData
            );

            const croppedImageURI = cropResultObject?.uri || cropResultObject?.path;

            if (!croppedImageURI || typeof croppedImageURI !== 'string') {
                console.error('[CameraScreen] ❌ Crop result object:', cropResultObject);
                throw new Error('Image cropping failed to return a valid URI.');
            }

            console.log(`[CameraScreen] ✅ Image cropped successfully: ${croppedImageURI}`);

            // 4. 서버 업로드
            const formData = new FormData();
            formData.append('file', {
                uri: croppedImageURI,
                type: 'image/jpeg',
                name: 'cropped-passport.jpg',
            } as any);

            console.log(`[CameraScreen] 📤 Uploading to ${UPLOAD_URL}...`);
            const response = await fetch(UPLOAD_URL, {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const result = await response.json();
            console.log('[CameraScreen] 📥 Server response:', result);

            if (!response.ok || !result.uploadId) {
                throw new Error(result.error || 'Upload failed.');
            }

            console.log('[CameraScreen] ✅ Upload successful!');
            onUploadComplete(result);

        } catch (error) {
            console.error('[CameraScreen] ❌ CRITICAL ERROR:', error);
            Alert.alert('오류', `문제가 발생했습니다: ${(error as Error).message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // 권한 또는 디바이스 체크
    if (!device) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>카메라를 찾을 수 없습니다.</Text>
            </View>
        );
    }

    if (!hasPermission) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>카메라 권한이 필요합니다.</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
                    <Text style={styles.buttonText}>권한 요청</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* 카메라 프리뷰 */}
            <Camera
                ref={camera}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                photo={true}
                enableZoomGesture={false}
            />

            {/* 오버레이 및 가이드라인 */}
            <View style={styles.overlay} pointerEvents="box-none">
                {/* 상단 어두운 영역 */}
                <View style={[styles.darkSection, { height: guidelineY }]} />

                {/* 중앙 영역 (가이드라인 포함) */}
                <View style={{ height: guidelineHeight, flexDirection: 'row' }}>
                    <View style={[styles.darkSection, { width: guidelineX }]} />

                    {/* 가이드라인 박스 */}
                    <View style={styles.guideline}>
                        {/* 모서리 마커 */}
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
                <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            {/* 촬영 버튼 */}
            <View style={styles.captureButtonContainer}>
                {isProcessing ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#4CAF50" />
                        <Text style={styles.loadingText}>처리 중...</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.captureButton}
                        onPress={takePhotoAndUpload}
                        disabled={isProcessing}
                    >
                        <View style={styles.captureButtonInner} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: 'white',
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 30,
    },
    permissionButton: {
        backgroundColor: '#4CAF50',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 25,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    darkSection: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    guideline: {
        width: guidelineWidth,
        height: guidelineHeight,
        borderColor: '#4CAF50',
        borderWidth: 3,
        borderRadius: 12,
        position: 'relative',
        backgroundColor: 'transparent',
    },
    // 모서리 마커 스타일
    corner: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderColor: '#4CAF50',
        borderWidth: 4,
    },
    cornerTopLeft: {
        top: -3,
        left: -3,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderTopLeftRadius: 12,
    },
    cornerTopRight: {
        top: -3,
        right: -3,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
        borderTopRightRadius: 12,
    },
    cornerBottomLeft: {
        bottom: -3,
        left: -3,
        borderRightWidth: 0,
        borderTopWidth: 0,
        borderBottomLeftRadius: 12,
    },
    cornerBottomRight: {
        bottom: -3,
        right: -3,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderBottomRightRadius: 12,
    },
    textContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: guidelineY - 50,
        alignItems: 'center',
    },
    guidelineText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 1,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    captureButtonContainer: {
        position: 'absolute',
        bottom: 50,
        alignSelf: 'center',
        zIndex: 1,
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'white',
        borderWidth: 6,
        borderColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButtonInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#4CAF50',
    },
    loadingContainer: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 30,
        paddingVertical: 20,
        borderRadius: 15,
    },
    loadingText: {
        color: 'white',
        marginTop: 10,
        fontSize: 14,
        fontWeight: '600',
    },
});

export default CameraScreen;