
import React, { useEffect, useRef } from 'react';
import { GestureType, HandPosition } from '../types';

interface HandTrackerProps {
  onGesture: (gesture: GestureType, position: HandPosition) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

const HandTracker: React.FC<HandTrackerProps> = ({ onGesture, videoRef }) => {
  useEffect(() => {
    const loadMediaPipe = async () => {
      const script = document.createElement('script');
      script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        const Hands = (window as any).Hands;
        const hands = new Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6
        });

        hands.onResults((results: any) => {
          if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            onGesture(GestureType.NONE, { x: 0.5, y: 0.5 });
            return;
          }

          const landmarks = results.multiHandLandmarks[0];
          
          // Use index finger tip (landmark 8) for pointing, or middle base (9) for stable centering
          const indexTip = landmarks[8];
          const indexBase = landmarks[5];
          const thumbTip = landmarks[4];
          const middleTip = landmarks[12];
          const middleBase = landmarks[9];
          const ringTip = landmarks[16];
          const pinkyTip = landmarks[20];

          const currentPos = { x: indexTip.x, y: indexTip.y };
          
          // Logic for POINT: Index extended, others (middle, ring, pinky) folded
          const isIndexExtended = indexTip.y < indexBase.y;
          const isMiddleFolded = middleTip.y > middleBase.y;
          const isRingFolded = ringTip.y > landmarks[13].y;
          const isPinkyFolded = pinkyTip.y > landmarks[17].y;
          
          // Logic for PINCH: Thumb and Index tips are close
          const distPinch = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) + 
            Math.pow(thumbTip.y - indexTip.y, 2)
          );

          // Logic for OPEN: Middle finger extended
          const isMiddleExtended = middleTip.y < middleBase.y;

          if (distPinch < 0.05) {
            onGesture(GestureType.PINCH, { x: landmarks[9].x, y: landmarks[9].y });
          } else if (isIndexExtended && isMiddleFolded && isRingFolded) {
            onGesture(GestureType.POINT, currentPos);
          } else if (isMiddleExtended) {
            onGesture(GestureType.OPEN, { x: landmarks[9].x, y: landmarks[9].y });
          } else {
            onGesture(GestureType.FIST, { x: landmarks[9].x, y: landmarks[9].y });
          }
        });

        const processVideo = async () => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            await hands.send({ image: videoRef.current });
          }
          requestAnimationFrame(processVideo);
        };
        processVideo();
      };
    };

    loadMediaPipe();
  }, [onGesture, videoRef]);

  return null;
};

export default HandTracker;
