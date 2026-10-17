// Steps for App flow tests (`App.test.tsx`), which drive the app the way a user does.
// The Firebase mocks in `App.test.tsx` already sign the user in; these add the rest.
import { fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';

/** Gives App a fresh Google access token, stored under Google access's keys, so saves sync to Drive and Sheets instead of skipping sync. */
export const signInWithDrive = (token = 'mock-token') => {
  localStorage.setItem('drive_token', token);
  localStorage.setItem('drive_token_timestamp', String(Date.now()));
};

/** Picks a receipt image in the upload input, which starts parsing and then opens ParsingReview. */
export const uploadReceipt = (file = new File(['(⌐□_□)'], 'receipt.png', { type: 'image/png' })) => {
  vi.mocked(URL.createObjectURL).mockReturnValue('blob:mock');
  const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
  const uploadInput = Array.from(inputs).find((input) => !input.getAttribute('capture'));
  if (!uploadInput) throw new Error('No upload input: is App rendered on the main view?');
  fireEvent.change(uploadInput, { target: { files: [file] } });
};

/** Waits for ParsingReview and confirms it, which opens SessionView and auto-saves when that's on. */
export const confirmReview = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /^(Confirm|אישור)$/ }, { timeout: 5000 }));
};
