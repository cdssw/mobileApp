// mobileApp/src/types/react-native-image-resizer.d.ts

declare module 'react-native-image-resizer' {
    interface Response {
        path: string;
        uri: string;
        size: number;
        name: string;
    }

    export function createResizedImage(
        uri: string,
        maxWidth: number,
        maxHeight: number,
        compressFormat: 'JPEG' | 'PNG' | 'WEBP',
        quality: number,
        rotation?: number,
        outputPath?: string,
        keepMeta?: boolean,
        options?: {
            mode?: 'contain' | 'cover' | 'stretch',
            onlyScaleDown?: boolean,
        }
    ): Promise<Response>;
}