import React, { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface CameraModalProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' },
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError('Unable to access camera.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);

        canvasRef.current.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `cap-${Date.now()}.jpg`, { type: 'image/jpeg' });
            onCapture(file);
            onClose();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      <div className="w-full h-full bg-black relative flex flex-col">
        <button 
          onClick={onClose}
          className="absolute right-4 z-10 p-3 bg-gray-800/80 active:bg-gray-700 backdrop-blur-md rounded-full text-white"
          style={{ top: 'calc(1rem + var(--sat))' }}
        >
          <X size={24} />
        </button>

        {error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white p-6 text-center">
            <p className="mb-4">{error}</p>
            <button onClick={onClose} className="px-6 py-3 bg-brand-green rounded-xl font-bold">Close</button>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full flex-1 object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute left-0 right-0 flex flex-col items-center gap-6" style={{ bottom: 'calc(2rem + var(--sab))' }}>
              <p className="text-white text-[10px] font-black uppercase tracking-widest bg-black/40 px-4 py-1.5 rounded-full backdrop-blur-sm">Capture Meal</p>
              <button 
                onClick={handleCapture}
                className="w-20 h-20 rounded-full bg-white border-4 border-gray-400/50 flex items-center justify-center active:scale-90 transition-transform shadow-2xl"
              >
                <div className="w-16 h-16 rounded-full bg-brand-green"></div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CameraModal;