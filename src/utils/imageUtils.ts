
/**
 * Resizes an image to a maximum width or height, maintaining aspect ratio.
 * Returns a base64 string.
 */
export const resizeImage = (file: File | Blob, maxWidth: number = 1000, maxHeight: number = 1000): Promise<string> => {
  console.log("Resizing image...", file.size, "bytes");
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Image processing timed out. The file might be corrupted or too large."));
    }, 30000); // 30 second timeout

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      let width = img.width;
      let height = img.height;

      if (width <= maxWidth && height <= maxHeight) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
        return;
      }

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };

    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image. Please ensure the file is a valid image."));
    };

    img.src = objectUrl;
  });
};

/**
 * Compresses an image to fit within a target size (in bytes).
 */
export const compressImage = async (base64: string, targetSize: number = 800000): Promise<string> => {
  if (base64.length < targetSize) return base64;
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }

      const scale = Math.min(1, Math.sqrt(targetSize / base64.length) * 1.2);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Try different quality levels to get under target size
      let quality = 0.6;
      let result = canvas.toDataURL('image/jpeg', quality);
      
      if (result.length > targetSize) {
        quality = 0.4;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      
      resolve(result);
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
};
