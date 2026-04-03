import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resizeImage, compressImage } from './imageUtils';

describe('imageUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'mock-url');
    global.URL.revokeObjectURL = vi.fn();

    // Mock Image
    global.Image = class {
      onload: () => void = () => {};
      onerror: () => void = () => {};
      src: string = '';
      width: number = 2000;
      height: number = 1000;
      constructor() {
        setTimeout(() => this.onload(), 10);
      }
    } as any;

    // Mock Canvas
    const mockCtx = {
      drawImage: vi.fn(),
      getContext: vi.fn(() => mockCtx),
    };
    global.document.createElement = vi.fn((tag: string) => {
      if (tag === 'canvas') {
        return {
          getContext: vi.fn(() => mockCtx),
          toDataURL: vi.fn(() => 'data:image/jpeg;base64,mock-data'),
          width: 0,
          height: 0,
        };
      }
      return {};
    }) as any;
  });

  it('resizes an image correctly', async () => {
    const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
    const result = await resizeImage(file, 1000, 1000);
    
    expect(result).toBe('data:image/jpeg;base64,mock-data');
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
  });

  it('compresses an image correctly', async () => {
    const base64 = 'data:image/jpeg;base64,' + 'a'.repeat(1000000);
    const result = await compressImage(base64, 500000);
    
    expect(result).toBe('data:image/jpeg;base64,mock-data');
  });

  it('returns original base64 if already smaller than target size', async () => {
    const base64 = 'data:image/jpeg;base64,small';
    const result = await compressImage(base64, 1000000);
    
    expect(result).toBe(base64);
  });
});
