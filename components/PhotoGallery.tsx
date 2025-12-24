
import React, { useRef, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PhotoData, GestureType } from '../types';

interface PhotoGalleryProps {
  photos: PhotoData[];
  gesture: GestureType;
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ photos, gesture }) => {
  const { camera } = useThree();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const meshRefs = useRef<{ [key: string]: THREE.Mesh }>({});

  useFrame((state) => {
    const isPinch = gesture === GestureType.PINCH;
    const isScatter = gesture === GestureType.OPEN;
    const time = state.clock.getElapsedTime();

    // 1. Detection Logic: Identify which photo to focus on
    if (isPinch) {
      if (!focusedId) {
        let minDistance = Infinity;
        let nearestId = null;
        Object.keys(meshRefs.current).forEach(id => {
          const m = meshRefs.current[id];
          if (!m) return;
          
          // Get screen-space position to find center-most item
          const worldPos = new THREE.Vector3();
          m.getWorldPosition(worldPos);
          const screenPos = worldPos.project(camera);
          
          const dist = Math.sqrt(screenPos.x ** 2 + screenPos.y ** 2);
          if (dist < minDistance) {
            minDistance = dist;
            nearestId = id;
          }
        });
        setFocusedId(nearestId);
      }
    } else {
      setFocusedId(null);
    }

    // 2. Animation Logic: Update positions and rotations
    photos.forEach((photo) => {
      const mesh = meshRefs.current[photo.id];
      if (!mesh || !mesh.parent) return;

      const isFocused = focusedId === photo.id;
      let targetPos = new THREE.Vector3(...photo.position);
      let targetScale = 0.8;

      if (isFocused) {
        // ABSOLUTE CENTERING:
        // Define a point exactly in front of the camera in world space
        // We use -8 depth to keep it close but not clipping
        const centerWorld = new THREE.Vector3(0, 0, -8);
        centerWorld.applyMatrix4(camera.matrixWorld);
        
        // Convert that world position to the local space of the SceneWrapper (the parent)
        // This effectively "cancels out" the rotation of the tree wrapper
        const localTarget = centerWorld.clone();
        mesh.parent.worldToLocal(localTarget);
        
        targetPos.copy(localTarget);
        targetScale = 6.0; // Optimized size (70% screen height feel)
        
        // Face the camera perfectly (billboarding)
        const camWorldPos = new THREE.Vector3();
        camera.getWorldPosition(camWorldPos);
        mesh.lookAt(camWorldPos);
      } else if (isScatter) {
        targetPos.set(
          photo.position[0] * 8 + Math.sin(time + photo.id.length) * 3,
          photo.position[1] * 6 + Math.cos(time + photo.id.length) * 3,
          photo.position[2] * 4
        );
        mesh.rotation.y += 0.01;
      } else {
        // Ornament mode: follow tree rotation/position
        mesh.rotation.y += 0.005;
      }

      // Smooth interpolation for cinematic movement
      mesh.position.lerp(targetPos, 0.15);
      mesh.scale.setScalar(THREE.MathUtils.lerp(mesh.scale.x, targetScale, 0.1));
    });
  });

  return (
    <>
      {photos.map((photo) => (
        <PhotoItem 
          key={photo.id} 
          photo={photo} 
          setRef={(ref) => { if(ref) meshRefs.current[photo.id] = ref; }} 
        />
      ))}
    </>
  );
};

const PhotoItem: React.FC<{ photo: PhotoData, setRef: (ref: THREE.Mesh | null) => void }> = ({ photo, setRef }) => {
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(photo.url);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [photo.url]);
  
  return (
    <mesh ref={setRef} position={photo.position} rotation={photo.rotation}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial 
        map={texture} 
        transparent 
        side={THREE.DoubleSide}
        color={0xffffff}
      />
    </mesh>
  );
};

export default PhotoGallery;
