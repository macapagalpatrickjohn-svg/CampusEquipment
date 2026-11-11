import { Capacitor, registerPlugin } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint, CapacitorBarcodeScannerAndroidScanningLibrary } from '@capacitor/barcode-scanner';
import QRCode from 'qrcode';

const QrDownloads = registerPlugin<{ save(options: { filename: string; base64: string }): Promise<void> }>('QrDownloads');

export function makeQr(itemId: string) {
  return QRCode.toDataURL(itemId, { width: 640, margin: 4, errorCorrectionLevel: 'M' });
}

export async function downloadQr(itemId: string, url: string) {
  const filename = itemId + '.png';
  if (Capacitor.isNativePlatform()) {
    await QrDownloads.save({ filename, base64: url.split(',')[1] });
    return 'PNG saved in Downloads → Campus Equipment.';
  }
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  return 'QR download started.';
}

export async function readQr(): Promise<string> {
  const result = await CapacitorBarcodeScanner.scanBarcode({
    hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
    scanInstructions: 'Point the camera at an equipment QR label',
    android: { scanningLibrary: CapacitorBarcodeScannerAndroidScanningLibrary.ZXING },
  });
  return result.ScanResult ?? '';
}

export async function capture(source: CameraSource) {
  const result = await Camera.getPhoto({
    source, resultType: CameraResultType.Uri, width: 1200, height: 1200, quality: 82,
    correctOrientation: true, saveToGallery: false,
  });
  if (!result.webPath) throw new Error('Photo unavailable');
  const response = await fetch(result.webPath);
  if (!response.ok) throw new Error('Photo unavailable');
  return await resizePhoto(await response.blob());
}

export async function resizePhoto(file: Blob): Promise<Blob> {
  if (!file.size || file.size > 30 * 1024 * 1024) throw new Error('Unsupported image size');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing unavailable');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Could not convert photo')), 'image/jpeg', 0.82,
    ));
  } finally {
    URL.revokeObjectURL(url);
  }
}
