import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image, Package } from 'lucide-react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useFBX, useProgress, Stage } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';


// Component to handle model rendering
const Model = ({ modelFile, setModelInfo, setIsLoading,wireframe }) => {
  const { scene, camera } = useThree();
  const modelRef = useRef();
  const [model, setModel] = useState(null);
  // Add this useEffect after the main useEffect (around line 100):
useEffect(() => {
  if (model) {
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => {
            material.wireframe = wireframe;
          });
        } else {
          child.material.wireframe = wireframe;
        }
      }
    });
  }
}, [wireframe, model]);

  useEffect(() => {
    if (!modelFile) return;

    setIsLoading(true);
    const fileURL = URL.createObjectURL(modelFile);
    const fileExtension = modelFile.name.split('.').pop().toLowerCase();

    let loader;
    switch (fileExtension) {
      case 'glb':
      case 'gltf':
        loader = GLTFLoader;
        break;
      default:
        console.error('Unsupported file format');
        setIsLoading(false);
        return;
    }

    // Load model using R3F's useLoader
    const loadModel = async () => {
      try {
        const result = await new loader().loadAsync(fileURL, (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setModelInfo({ progress });
          }
        });

        let loadedModel = fileExtension === 'glb' || fileExtension === 'gltf' ? result.scene : result;

        // Center and scale model
        const box = new THREE.Box3().setFromObject(loadedModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;

        loadedModel.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        loadedModel.scale.multiplyScalar(scale);

        // Setup model for rendering
        loadedModel.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((material) => {
                  material.side = THREE.DoubleSide;
                   material.wireframe = wireframe;
                });
              } else {
                child.material.side = THREE.DoubleSide;
                child.material.wireframe = wireframe;
              }
            }
          }
        });

        // Update camera and controls
        const newBox = new THREE.Box3().setFromObject(loadedModel);
        const newCenter = newBox.getCenter(new THREE.Vector3());
        const newSize = newBox.getSize(new THREE.Vector3());
        const newMaxDim = Math.max(newSize.x, newSize.y, newSize.z);

        const fov = camera.fov * (Math.PI / 180);
        let cameraDistance = Math.abs(newMaxDim / Math.sin(fov / 2)) * 1.5;

        const direction = new THREE.Vector3()
          .subVectors(camera.position, new THREE.Vector3())
          .normalize();
        camera.position.copy(newCenter.clone().add(direction.multiplyScalar(cameraDistance)));
        camera.lookAt(newCenter);

        setModel(loadedModel);

        // Compute model stats
        const triangleCount = countTriangles(loadedModel);
        const materialCount = countMaterials(loadedModel);
        const meshCount = countMeshes(loadedModel);
        setModelInfo({
          triangles: triangleCount,
          materials: materialCount,
          meshes: meshCount,
          progress: 100,
        });

        setIsLoading(false);
        URL.revokeObjectURL(fileURL);
      } catch (error) {
        console.error('Error loading model:', error);
        setIsLoading(false);
        URL.revokeObjectURL(fileURL);
      }
    };

    loadModel();

    return () => {
      URL.revokeObjectURL(fileURL);
    };
  }, [modelFile, scene, camera, setIsLoading, setModelInfo]);

  // Count triangles
  const countTriangles = (model) => {
    let triangles = 0;
    model.traverse((child) => {
      if (child.isMesh && child.geometry) {
        if (child.geometry.index) {
          triangles += child.geometry.index.count / 3;
        } else if (child.geometry.attributes.position) {
          triangles += child.geometry.attributes.position.count / 3;
        }
      }
    });
    return Math.round(triangles);
  };


  // Count materials
  const countMaterials = (model) => {
    const materials = new Set();
    model.traverse((child) => {
      if (child.isMesh) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => materials.add(mat));
        } else if (child.material) {
          materials.add(child.material);
        }
      }
    });
    return materials.size;
  };

  // Count meshes
  const countMeshes = (model) => {
    let meshCount = 0;
    model.traverse((child) => {
      if (child.isMesh) meshCount++;
    });
    return meshCount;
  };

  return model ? <primitive object={model} ref={modelRef} /> : null;
};
export default Model;








  

