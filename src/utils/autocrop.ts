/**
 * Smart automatic receipt detection and cropping using canvas-based image analysis.
 */

interface Point {
  x: number;
  y: number;
}

export interface CropBoundary {
  points: Point[]; // Percentage coordinates (0 to 100)
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Iterates through the image buffer to find the bounding box of the most prominent,
 * bright, high-contrast region containing the receipt paper.
 */
export const detectReceipt = (
  imageSrc: string
): Promise<CropBoundary> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Create offscreen canvas with small size for swift processing (under 2ms)
      const canvas = document.createElement('canvas');
      const targetWidth = 150;
      const targetHeight = Math.round((img.height / img.width) * targetWidth);
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(getDefaultBoundary());
        return;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      let imgData;
      try {
        imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      } catch (err) {
        // Fallback for security/cors constraints
        resolve(getDefaultBoundary());
        return;
      }

      const data = imgData.data;
      const totalPixels = targetWidth * targetHeight;
      const grayscale = new Uint8Array(totalPixels);
      
      let sum = 0;
      let maxBright = 0;
      let minBright = 255;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Grayscale conversion using luminance formula
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        grayscale[i / 4] = gray;
        sum += gray;
        if (gray > maxBright) maxBright = gray;
        if (gray < minBright) minBright = gray;
      }

      const avgBright = sum / totalPixels;

      // Low contrast threshold fallback
      if (maxBright - minBright < 40) {
        resolve(getDefaultBoundary());
        return;
      }

      // Compute dynamic threshold for receipt paper detection
      // Receipts are usually bright, so threshold should be higher than the average, closer to max
      const threshold = Math.min(230, Math.max(90, avgBright + (maxBright - avgBright) * 0.35));

      // Calculate pixel densities horizontally and vertically
      const columnDensities = new Int32Array(targetWidth);
      const rowDensities = new Int32Array(targetHeight);

      for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
          const idx = y * targetWidth + x;
          if (grayscale[idx] >= threshold) {
            columnDensities[x]++;
            rowDensities[y]++;
          }
        }
      }

      // Fine-tune filters to discard minor outliers/noise (margins, shadows, edge reflections)
      const columnThreshold = targetHeight * 0.10; // Col needs at least 10% of height as bright pixels
      const rowThreshold = targetWidth * 0.10;    // Row needs at least 10% of width as bright pixels

      let minXIndex = 0;
      let maxXIndex = targetWidth - 1;

      for (let x = 0; x < targetWidth; x++) {
        if (columnDensities[x] >= columnThreshold) {
          minXIndex = x;
          break;
        }
      }

      for (let x = targetWidth - 1; x >= minXIndex; x--) {
        if (columnDensities[x] >= columnThreshold) {
          maxXIndex = x;
          break;
        }
      }

      let minYIndex = 0;
      let maxYIndex = targetHeight - 1;

      for (let y = 0; y < targetHeight; y++) {
        if (rowDensities[y] >= rowThreshold) {
          minYIndex = y;
          break;
        }
      }

      for (let y = targetHeight - 1; y >= minYIndex; y--) {
        if (rowDensities[y] >= rowThreshold) {
          maxYIndex = y;
          break;
        }
      }

      // Apply safe safety padding around the detected bounds (5% padding)
      const padX = Math.round(targetWidth * 0.03);
      const padY = Math.round(targetHeight * 0.03);

      const finalMinX = Math.max(0, minXIndex - padX);
      const finalMaxX = Math.min(targetWidth - 1, maxXIndex + padX);
      const finalMinY = Math.max(0, minYIndex - padY);
      const finalMaxY = Math.min(targetHeight - 1, maxYIndex + padY);

      // Verify aspect ratio and minimum size bounds to avoid cropping too aggressively on reflections
      const detectedWidthPerc = ((finalMaxX - finalMinX) / targetWidth) * 100;
      const detectedHeightPerc = ((finalMaxY - finalMinY) / targetHeight) * 100;

      if (detectedWidthPerc < 15 || detectedHeightPerc < 15) {
        resolve(getDefaultBoundary());
        return;
      }

      const points = [
        { x: (finalMinX / targetWidth) * 100, y: (finalMinY / targetHeight) * 100 },
        { x: (finalMaxX / targetWidth) * 100, y: (finalMinY / targetHeight) * 100 },
        { x: (finalMaxX / targetWidth) * 100, y: (finalMaxY / targetHeight) * 100 },
        { x: (finalMinX / targetWidth) * 100, y: (finalMaxY / targetHeight) * 100 },
      ];

      resolve({
        points,
        boundingBox: {
          x: (finalMinX / targetWidth) * img.width,
          y: (finalMinY / targetHeight) * img.height,
          width: ((finalMaxX - finalMinX) / targetWidth) * img.width,
          height: ((finalMaxY - finalMinY) / targetHeight) * img.height,
        },
      });
    };

    img.onerror = () => {
      resolve(getDefaultBoundary());
    };

    img.src = imageSrc;
  });
};

/**
 * Returns default cropping bounds if detection fails or image context is neutral.
 */
export const getDefaultBoundary = (): CropBoundary => {
  return {
    points: [
      { x: 15, y: 5 },
      { x: 85, y: 5 },
      { x: 85, y: 95 },
      { x: 15, y: 95 },
    ],
    boundingBox: {
      x: 0.15,
      y: 0.05,
      width: 0.70,
      height: 0.90,
    },
  };
};

/**
 * Cuts/crops an image immediately using the bounding box from the auto receipt detector.
 */
export const cropImageToBoundary = (
  imageSrc: string,
  boundary: CropBoundary
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageSrc);
        return;
      }

      // Convert boundingBox percentage coordinates or direct pixel calculations
      let { x, y, width, height } = boundary.boundingBox;

      // Ensure proper bounding mapping if percentages were returned vs absolute
      if (x < 1 && y < 1 && width < 1 && height < 1) {
        x = x * img.width;
        y = y * img.height;
        width = width * img.width;
        height = height * img.height;
      }

      // Clamp dimensions to image boundaries
      x = Math.max(0, Math.min(img.width, x));
      y = Math.max(0, Math.min(img.height, y));
      width = Math.max(10, Math.min(img.width - x, width));
      height = Math.max(10, Math.min(img.height - y, height));

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => {
      resolve(imageSrc);
    };
    img.src = imageSrc;
  });
};
