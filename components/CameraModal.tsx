import React, { useRef, useState, useEffect } from 'react';
import { X, Camera, RefreshCw } from 'lucide-react';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, // Prefer back camera on mobile
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError('Unable to access camera. Please allow permissions.');
      console.error(err);
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
        // Match canvas size to video size
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);

        canvasRef.current.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            onCapture(file);
            onClose();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-black rounded-2xl overflow-hidden relative border border-gray-700">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-gray-800 rounded-full text-white"
        >
          <X size={24} />
        </button>

        {error ? (
          <div className="h-96 flex flex-col items-center justify-center text-white p-6 text-center">
            <p className="mb-4">{error}</p>
            <button onClick={onClose} className="px-4 py-2 bg-gray-700 rounded-lg">Close</button>
          </div>
        ) : (
          <div className="relative">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-[60vh] object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-8">
              <button 
                onClick={handleCapture}
                className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center hover:scale-105 transition-transform"
              >
                <div className="w-12 h-12 rounded-full bg-brand-green"></div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraModal;