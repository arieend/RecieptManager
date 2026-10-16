
/** The mime type a data URL declares, e.g. `image/jpeg` or `application/pdf`. */
export const mimeTypeOf = (dataUrl: string): string =>
  dataUrl.match(/^data:([^;,]+)/)?.[1] ?? 'image/jpeg';

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heic',
};

/** The file extension for a data URL's mime type, defaulting to `jpg`. */
export const extensionOf = (dataUrl: string): string =>
  EXTENSIONS[mimeTypeOf(dataUrl)] ?? 'jpg';

/**
 * Detects if a file or string is a PDF document.
 */
export const isPdfFile = (file: File | Blob | string): boolean => {
  if (typeof file === 'string') {
    return file.startsWith('data:application/pdf') || file.toLowerCase().includes('application/pdf');
  }
  if (file.type && file.type.toLowerCase().includes('pdf')) {
    return true;
  }
  if ('name' in file && typeof file.name === 'string') {
    return file.name.toLowerCase().endsWith('.pdf');
  }
  return false;
};

/**
 * Detects if a file or string is a HEIC or HEIF image.
 */
export const isHeicFile = (file: File | Blob | string): boolean => {
  if (typeof file === 'string') {
    return file.startsWith('data:image/heic') || file.startsWith('data:image/heif');
  }
  if (file.type) {
    const t = file.type.toLowerCase();
    if (t.includes('heic') || t.includes('heif')) return true;
  }
  if ('name' in file && typeof file.name === 'string') {
    const n = file.name.toLowerCase();
    if (n.endsWith('.heic') || n.endsWith('.heif')) return true;
  }
  return false;
};

/**
 * Safely reads a File or Blob into a base64 Data URL using FileReader.
 */
export const readFileAsDataUrl = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = () => reject(new Error("Failed to read file into memory."));
    reader.readAsDataURL(file);
  });
};

/**
 * Converts a HEIC/HEIF blob to a JPEG blob using heic2any if available in the browser.
 * Falls back to the original blob if conversion is unsupported or fails.
 */
export const convertHeicToBlob = async (file: Blob | File): Promise<Blob> => {
  if (typeof window === 'undefined') return file;
  try {
    const heic2anyModule = await import('heic2any');
    const heic2any = (heic2anyModule as any).default || heic2anyModule;
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.85
    });
    return Array.isArray(result) ? result[0] : result;
  } catch (err) {
    console.warn("HEIC decoding fallback engaged, passing original blob:", err);
    return file;
  }
};

/**
 * Resizes an image (File, Blob, or base64 data URL) to a maximum width or height,
 * maintaining aspect ratio and compressing to JPEG.
 * Includes automatic HEIC conversion and resilient fallback to raw base64 if canvas decoding fails.
 */
export const resizeImage = async (
  file: File | Blob | string,
  maxWidth: number = 1000,
  maxHeight: number = 1000
): Promise<string> => {
  if (!file) {
    throw new Error("No image file provided.");
  }

  // Handle PDF: PDFs must never be resized via canvas
  if (isPdfFile(file)) {
    if (typeof file === 'string') return file;
    return readFileAsDataUrl(file);
  }

  let fileToProcess: Blob | File | string = file;

  // Convert HEIC/HEIF if needed
  if (typeof file !== 'string' && isHeicFile(file)) {
    try {
      fileToProcess = await convertHeicToBlob(file);
    } catch (e) {
      console.warn("HEIC conversion failed:", e);
    }
  }

  return new Promise(async (resolve, reject) => {
    let objectUrl: string | null = null;
    let imageSrc: string;

    if (typeof fileToProcess === 'string') {
      imageSrc = fileToProcess;
    } else {
      try {
        objectUrl = URL.createObjectURL(fileToProcess);
        imageSrc = objectUrl;
      } catch (e) {
        try {
          const rawData = await readFileAsDataUrl(fileToProcess as Blob);
          resolve(rawData);
          return;
        } catch (readErr) {
          reject(new Error("Unable to read image file. Please ensure the file is a valid image."));
          return;
        }
      }
    }

    const cleanup = () => {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (e) {}
      }
    };

    const timeout = setTimeout(async () => {
      cleanup();
      if (typeof file !== 'string') {
        try {
          const fallbackData = await readFileAsDataUrl(file);
          if (fallbackData) {
            resolve(fallbackData);
            return;
          }
        } catch (e) {}
      }
      reject(new Error("Image processing timed out. The file might be corrupted or too large."));
    }, 25000);

    const img = new Image();

    img.onload = () => {
      clearTimeout(timeout);
      cleanup();

      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width <= 0 || height <= 0) {
          width = 800;
          height = 600;
        }

        if (width <= maxWidth && height <= maxHeight) {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(typeof file === 'string' ? file : imageSrc);
            return;
          }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
          return;
        }

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(typeof file === 'string' ? file : imageSrc);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch (canvasErr) {
        console.warn("Canvas resizing error, using fallback data URL:", canvasErr);
        if (typeof file === 'string') {
          resolve(file);
        } else {
          readFileAsDataUrl(file).then(resolve).catch(reject);
        }
      }
    };

    img.onerror = async () => {
      clearTimeout(timeout);
      cleanup();

      // Resilient fallback: If canvas Image() decode fails (e.g. browser lacks codec),
      // read the raw file as a data URL so Gemini OCR can still parse it directly!
      if (typeof file !== 'string') {
        try {
          console.warn("Browser image decoding failed; attempting FileReader fallback for receipt processing...");
          const rawData = await readFileAsDataUrl(file);
          if (rawData && rawData.length > 50) {
            resolve(rawData);
            return;
          }
        } catch (e) {
          console.error("FileReader fallback failed:", e);
        }
      } else if (file.startsWith('data:')) {
        resolve(file);
        return;
      }

      reject(new Error("Failed to load image. Please ensure the file is a valid image (JPG, PNG, WebP, HEIC) or PDF."));
    };

    img.src = imageSrc;
  });
};

/**
 * Compresses an image to fit within a target size (in bytes).
 */
export const compressImage = async (base64: string, targetSize: number = 800000): Promise<string> => {
  if (!base64 || base64.length < targetSize) return base64;
  
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(base64), 5000);
    const img = new Image();

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64);
          return;
        }

        const scale = Math.min(1, Math.sqrt(targetSize / base64.length) * 1.2);
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        let quality = 0.6;
        let result = canvas.toDataURL('image/jpeg', quality);
        
        if (result.length > targetSize) {
          quality = 0.4;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        
        resolve(result);
      } catch (e) {
        resolve(base64);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(base64);
    };

    img.src = base64;
  });
};

/**
 * Turns an upload or camera capture into a data URL ready for receipt parsing.
 * Camera captures pass through; PDFs are read as-is; images are resized to JPEG
 * (HEIC converted first), keeping their own type only if decoding fails.
 */
export const prepareReceiptImage = async (input: File | string): Promise<string> => {
  if (typeof input === 'string') return input;

  if (isPdfFile(input)) {
    const dataUrl = await readFileAsDataUrl(input);
    return dataUrl.replace(/^data:[^;]*;base64,/, 'data:application/pdf;base64,');
  }

  return resizeImage(input);
};
