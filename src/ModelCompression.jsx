import React, { useState } from 'react';
import { optimizeModels } from './ThreeJsUtils'; // Adjust path to your ThreeJsUtils file
import OptimizationResultsModal from './OptimizationResultsModal'; // Adjust path or create this component

const ModelCompression = ({ modelFile,
  modelInfo,
  onOptimizationComplete,
  optimizationInProgress,
  setOptimizationInProgress,
  optimizationResults,
  setOptimizationResults,
  affectedNodes,
  setAffectedNodes,
  showOptimizationPopup,
  setShowOptimizationPopup,
  inputFileModel,
  setInputFileModel, }) => {
  // State for checkbox selections and slider value
  const [options, setOptions] = useState({
    useDracoCompression: false,
    compressTextures: false,
    simplifyGeometry: false,
    removeDuplicateVertices: false,
  });
  const [simplifyLevel, setSimplifyLevel] = useState(1); // Slider for simplification (0-100%)

  // State for optimization process
   // Mock inputFileModel

  // Handle checkbox changes
  const handleOptionChange = (e) => {
    const { name, checked } = e.target;
    setOptions((prev) => ({ ...prev, [name]: checked }));
  };

  // Handle slider change for Simplify Geometry
  const handleSimplifyLevelChange = (e) => {
    setSimplifyLevel(e.target.value);
  };

  // Handle model compression
const handleCompressModel = async () => {
  if (!modelFile) return;

  setOptimizationInProgress(true);

  // Create optimization configuration based on state
  const optimizationConfig = {
    useDraco: options.useDracoCompression,
    useTextureCompression: options.compressTextures,
    simplifyGeometry: options.simplifyGeometry,
    removeDuplicates: options.removeDuplicateVertices,
    simplificationRatio: simplifyLevel / 100, // Convert percentage to ratio (0-1)
    embedImages: false, // Set based on your requirements
  };

  try {
    const result = await optimizeModels(
      [modelFile], // Pass as array since optimizeModels expects File[]
      [optimizationConfig], // Single config for one file
      setOptimizationResults,
      setInputFileModel,
      inputFileModel,
      setShowOptimizationPopup,
      setAffectedNodes
    );
    
    // Check if we got results and send the optimized model back
    if (result && result.optimizedModels && result.optimizedModels.length > 0) {
      // Create a File object from the optimized blob
      const optimizedModel = new File(
        [result.optimizedModels[0].optimizedBlob],
        modelFile.name,
        { type: 'model/gltf-binary' }
      );
      
      // Pass the optimized model to the parent component
      onOptimizationComplete(optimizedModel);
      setShowOptimizationPopup(true);
    }
  } catch (error) {
    console.error('Optimization failed:', error);
    alert('An error occurred during model optimization.');
  } finally {
    setOptimizationInProgress(false);
  }
};

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-800">Model Compression Settings</h3>
      {modelFile ? (
        <div className="space-y-4">
          
          {/* Optimization Options */}
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-800">
              Optimization Options for {modelFile.name}
            </h4>
            <div className="space-y-1">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="useDracoCompression"
                  checked={options.useDracoCompression}
                  onChange={handleOptionChange}
                  className="h-4 w-4 text-red-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Use Draco Compression</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="compressTextures"
                  checked={options.compressTextures}
                  onChange={handleOptionChange}
                  className="h-4 w-4 text-red-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Compress Textures</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="simplifyGeometry"
                  checked={options.simplifyGeometry}
                  onChange={handleOptionChange}
                  className="h-4 w-4 text-red-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Simplify Geometry</span>
              </label>

              {/* Simplify Geometry Slider */}
              {options.simplifyGeometry && (
                <div className="ml-6 space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Simplification Level: <span >{simplifyLevel}% reduction</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={simplifyLevel}
                    onChange={handleSimplifyLevelChange}
                    className="w-full"
                  />
                </div>
              )}

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="removeDuplicateVertices"
                  checked={options.removeDuplicateVertices}
                  onChange={handleOptionChange}
                  className="h-4 w-4 text-red-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Remove Duplicate Vertices</span>
              </label>
            </div>
          </div>

          {/* Compress Button */}
          <button
            onClick={handleCompressModel}
            disabled={optimizationInProgress}
            className={`w-full py-2 px-4 rounded text-white ${
              optimizationInProgress
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {optimizationInProgress ? (
              <div className="flex items-center justify-center">
                <svg
                  className="animate-spin h-5 w-5 mr-2 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Optimizing...
              </div>
            ) : (
              'Compress Model'
            )}
          </button>
        </div>
      ) : (
        <p className="text-gray-500">Upload a model to enable compression settings.</p>
      )}
      
    </div>
  );
};

export default ModelCompression;