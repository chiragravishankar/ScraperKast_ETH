import { ImageResponse } from 'next/og';

// Next.js generates /favicon.ico (and apple-touch-icon etc.) from this file.
// Change the emoji or background color to rebrand.

export const size        = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#028090',
          borderRadius: 8,
          fontSize: 22,
        }}
      >
        🌊
      </div>
    ),
    { ...size },
  );
}
