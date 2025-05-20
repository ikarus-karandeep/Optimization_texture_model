import React, { useState, useRef, useEffect } from 'react';
import { Upload, Package } from 'lucide-react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useFBX, useProgress, Stage } from '@react-three/drei';
import * as THREE from 'three';

import TextureCompression from './TextureCompression';
import ModelCompression from './ModelCompression';
import Model from './Model';
import OptimizationResultsModal from './OptimizationResultsModal';
import { mod } from 'three/tsl';

const App = () => {
  const [selectedTab, setSelectedTab] = useState('model-compression');
  const [modelFile, setModelFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [showTexturePopup, setShowTexturePopup] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [modelInfo, setModelInfo] = useState(null);
  const [optimizedModelFile, setOptimizedModelFile] = useState(null);
  const dragCounter = useRef(0); // Counter to track drag events

  //model compression
  const [optimizationInProgress, setOptimizationInProgress] = useState(false);
  const [optimizationResults, setOptimizationResults] = useState([]);
  const [affectedNodes, setAffectedNodes] = useState([]);
  const [showOptimizationPopup, setShowOptimizationPopup] = useState(false);
  const [inputFileModel, setInputFileModel] = useState([{ name: modelFile?.name || '' }]);

  const sidebarTabs = [
    { id: 'model-compression', icon: Package, label: 'Model Compression' },
  ];

  const handleOptimizedModel = (optimizedModel) => {
    setOptimizedModelFile(optimizedModel);
  };

  const handleFileUpload = (event, type) => {
    const file = event.target.files[0];
    if (file) {
      if (type === 'model') {
        setModelFile(file);
        setSelectedTab('model-compression');
      } else if (type === 'image') {
        setImageFile(file);
        setShowTexturePopup(true);
      }
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    dragCounter.current = 0; // Reset counter
    setIsDragOver(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (['glb', 'gltf', 'obj', 'fbx'].includes(fileExtension)) {
      setModelFile(file);
      setSelectedTab('model-compression');
      console.log('Model file loaded:', file.name);
    } else if (['jpg', 'jpeg', 'png', 'webp'].includes(fileExtension)) {
      setImageFile(file);
      setShowTexturePopup(true);
      console.log('Image file loaded:', file.name);
    } else {
      console.warn('Unsupported file type:', fileExtension);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault(); // This is necessary to allow dropping
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragOver(false); // Hide drop zone when counter reaches zero
    }
  };
  const handleDragEnter = (event) => {
    event.preventDefault();
    dragCounter.current += 1;
    if (dragCounter.current === 1) {
      setIsDragOver(true); // Show drop zone only on first enter
    }
  };


  const closeTexturePopup = () => {
    setShowTexturePopup(false);
    setImageFile(null);
  };

  const renderContent = () => {
    switch (selectedTab) {
      case 'model-compression':
        return (
          <ModelCompression
            modelFile={modelFile}
            modelInfo={modelInfo}
            onOptimizationComplete={handleOptimizedModel}
            optimizationInProgress={optimizationInProgress}
            setOptimizationInProgress={setOptimizationInProgress}
            optimizationResults={optimizationResults}
            setOptimizationResults={setOptimizationResults}
            affectedNodes={affectedNodes}
            setAffectedNodes={setAffectedNodes}
            showOptimizationPopup={showOptimizationPopup}
            setShowOptimizationPopup={setShowOptimizationPopup}
            inputFileModel={inputFileModel}
            setInputFileModel={setInputFileModel}
          />

        );
      default:
        return <div>Content for {selectedTab}</div>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      {modelFile && (
        <div className="w-64 h-full bg-white border-r border-gray-200 flex flex-col shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Model Editor</h2>
            {modelFile && (
              <p className="text-sm text-gray-500 truncate mt-1">{modelFile.name}</p>
            )}
          </div>
          <div className="flex flex-col">
            {sidebarTabs.map((tab) => {
              const Icon = tab.icon;
              const isDisabled = tab.id === 'model-compression' && !modelFile;
              return (
                <button
                  key={tab.id}
                  onClick={() => !isDisabled && setSelectedTab(tab.id)}
                  disabled={isDisabled}
                  className={`flex items-center space-x-3 px-4 py-3 text-left transition-colors ${isDisabled
                    ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                    : selectedTab === tab.id
                      ? 'bg-blue-50 border-r-2 border-blue-500 text-blue-700'
                      : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  title={
                    isDisabled
                      ? 'Upload a model to enable Model Compression'
                      : ''
                  }
                >
                  <Icon
                    size={20}
                    className={
                      isDisabled
                        ? 'text-gray-400'
                        : selectedTab === tab.id
                          ? 'text-blue-600'
                          : 'text-gray-600'
                    }
                  />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex-1 p-4 overflow-auto">{renderContent()}</div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b p-4 shadow-sm">
          <div className="flex items-center justify-center space-x-4">
            <label
              className={`flex items-center space-x-2 ${modelFile || showTexturePopup ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 cursor-pointer hover:bg-blue-600'
                } text-white px-4 py-2 rounded-lg transition-colors`}
            >
              <Upload size={18} />
              <span>Upload Model</span>
              <input
                type="file"
                className="hidden"
                accept=".glb,.gltf,.obj,.fbx"
                onChange={(e) => handleFileUpload(e, 'model')}
                disabled={modelFile !== null || showTexturePopup}
              />
            </label>
            <label
              className={`flex items-center space-x-2 ${modelFile || showTexturePopup ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 cursor-pointer hover:bg-green-600'
                } text-white px-4 py-2 rounded-lg transition-colors`}
            >
              <Upload size={18} />
              <span>Upload Image</span>
              <input
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(e) => handleFileUpload(e, 'image')}
                disabled={modelFile !== null || showTexturePopup}
              />
            </label>

          </div>
        </div>

        {/* 3D Viewer */}
        <div
          className="flex-1 relative"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
        >
          <Canvas
            shadows
            camera={{ position: [3, 3, 3], fov: 60 }}
            gl={{ antialias: true, outputEncoding: THREE.sRGBEncoding }}
            style={{ width: '90%', height: '90%' }}
          >
            <ambientLight intensity={0.5} />
            <directionalLight
              position={[5, 10, 5]}
              intensity={1.8}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />
            <OrbitControls
              enableDamping
              dampingFactor={0.05}
              minDistance={1}
              maxDistance={100}
            />
            <Stage adjustCamera intensity={0.5} shadows="contact" environment="city">
              <Model
                modelFile={optimizedModelFile || modelFile}
                setModelInfo={setModelInfo}
                setIsLoading={setIsLoading}
              />
            </Stage>
          </Canvas>

          {/* Texture Compression Popup */}
          {showTexturePopup && imageFile && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
              <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Texture Compression</h3>
                  <button
                    onClick={closeTexturePopup}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <TextureCompression imageFile={imageFile} />
              </div>
            </div>
          )}

          {/* Loading Overlay */}
          {isLoading && modelInfo?.progress !== undefined && (
            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center z-20">
              <div className="bg-white p-6 rounded-lg shadow-lg text-center">
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-200"
                    style={{ width: `${modelInfo.progress}%` }}
                  ></div>
                </div>
                <p className="text-gray-700">Loading model... {modelInfo.progress}%</p>
              </div>
            </div>
          )}

          {/* Drop Zone Overlay */}
          {!modelFile && !imageFile && isDragOver && (
            <div className="absolute inset-0  bg-opacity-20 border-2 border-dashed border-blue-400 flex items-center justify-center z-10">
              <div className="text-center p-8 bg-white rounded-lg shadow-lg">
                <Upload size={48} className="mx-auto text-blue-500 mb-4" />
                <p className="text-lg font-medium text-gray-700">Drop your file here</p>
                <p className="text-sm text-gray-500 mt-2">
                  Supports: Models (.glb, .gltf, .obj, .fbx) or Images (.jpg, .png, .webp)
                </p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!modelFile && !imageFile && !isDragOver && (
            <>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center p-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <Upload size={64} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-lg font-medium text-gray-500">Drag & Drop Files Here</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Or use the upload buttons at the top to select files
                  </p>
                </div>
              </div>
            </>
          )}
          {showOptimizationPopup && (
            <div className="absolute top-4 right-6 z-10 text-black p-4 rounded-lg shadow-lg">
              <OptimizationResultsModal
                optimizationResults={optimizationResults}
                setOptimizationResults={setOptimizationResults}
                affectedNodes={affectedNodes}
                setAffectedNodes={setAffectedNodes}
                showOptimizationPopup={showOptimizationPopup}
                setShowOptimizationPopup={setShowOptimizationPopup}
                inputFileModel={inputFileModel}
                setInputFileModel={setInputFileModel}
              />
            </div>
          )}




        </div>
      </div>
    </div>
  );
};

export default App;