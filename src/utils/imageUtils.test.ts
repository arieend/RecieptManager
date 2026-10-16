import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resizeImage, compressImage, isPdfFile, isHeicFile, readFileAsDataUrl, extensionOf, prepareReceiptImage } from './imageUtils';

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

  it('identifies PDF files correctly', () => {
    expect(isPdfFile(new File([''], 'receipt.pdf', { type: 'application/pdf' }))).toBe(true);
    expect(isPdfFile(new File([''], 'RECEIPT.PDF', { type: '' }))).toBe(true);
    expect(isPdfFile(new File([''], 'test.bin', { type: 'application/x-pdf' }))).toBe(true);
    expect(isPdfFile('data:application/pdf;base64,xyz')).toBe(true);
    expect(isPdfFile(new File([''], 'image.jpg', { type: 'image/jpeg' }))).toBe(false);
  });

  it('identifies HEIC/HEIF files correctly', () => {
    expect(isHeicFile(new File([''], 'photo.heic', { type: 'image/heic' }))).toBe(true);
    expect(isHeicFile(new File([''], 'photo.HEIC', { type: '' }))).toBe(true);
    expect(isHeicFile(new File([''], 'photo.heif', { type: '' }))).toBe(true);
    expect(isHeicFile('data:image/heic;base64,xyz')).toBe(true);
    expect(isHeicFile(new File([''], 'image.png', { type: 'image/png' }))).toBe(false);
  });

  it('resizes base64 string directly', async () => {
    const result = await resizeImage('data:image/jpeg;base64,incoming');
    expect(result).toBe('data:image/jpeg;base64,mock-data');
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

  it.each([
    ['data:image/jpeg;base64,x', 'jpg'],
    ['data:application/pdf;base64,x', 'pdf'],
    ['data:image/png;base64,x', 'png'],
    ['data:image/webp;base64,x', 'webp'],
    ['data:image/heic;base64,x', 'heic'],
    ['data:image/heif;base64,x', 'heic'],
    ['data:image/gif;base64,x', 'jpg'],
    ['not a data url', 'jpg'],
  ])('gives %s the extension .%s', (dataUrl, extension) => {
    expect(extensionOf(dataUrl)).toBe(extension);
  });

  describe('prepareReceiptImage', () => {
    it('passes a camera capture through unchanged', async () => {
      expect(await prepareReceiptImage('data:image/jpeg;base64,camera')).toBe('data:image/jpeg;base64,camera');
    });

    it('reads a PDF as-is and labels it application/pdf even without a file type', async () => {
      const pdf = new File(['%PDF-1.4'], 'receipt.pdf', { type: '' });

      expect(await prepareReceiptImage(pdf)).toBe(`data:application/pdf;base64,${btoa('%PDF-1.4')}`);
      expect(global.URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('resizes an image file to JPEG', async () => {
      const png = new File(['png'], 'receipt.png', { type: 'image/png' });

      expect(await prepareReceiptImage(png)).toBe('data:image/jpeg;base64,mock-data');
    });
  });
});
