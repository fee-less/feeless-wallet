import { useEffect, useRef } from 'react';
import QRCodeWithLogo from 'qrcode-with-logos';

interface CompactQRCodeProps {
  value: string;
  size?: number;
  margin?: number;
}

export function CompactQRCode({ value, size = 120, margin = 0 }: CompactQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const qrcode = new QRCodeWithLogo({
      canvas: canvasRef.current,
      content: value,
      width: size,
      image: undefined, // No logo
      nodeQrCodeOptions: {
        color: {
          dark: '#ffffff',
          light: '#383838'
        },
        errorCorrectionLevel: 'L',
        margin: 0,
        // Higher scale for better quality
        scale: 6
      }
    });

    // Handle the promise properly
    const generateQR = async () => {
      try {
        await qrcode.toCanvas();
      } catch (err) {
        console.error('Error generating QR code:', err);
      }
    };
    
    generateQR();
  }, [value, size, margin]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        backgroundColor: '#383838',
        imageRendering: 'pixelated',
        borderRadius: '8px' // Slightly rounded corners for the container
      }}
    />
  );
} 