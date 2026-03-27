
/**
 * Resizes an image to a maximum width or height, maintaining aspect ratio.
 * Returns a base64 string.
 */
export const resizeImage = (file: File | Blob, maxWidth: number = 1000, maxHeight: number = 1000): Promise<string> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Image processing timed out. The file might be corrupted or too large."));
    }, 15000); // 15 second timeout

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
