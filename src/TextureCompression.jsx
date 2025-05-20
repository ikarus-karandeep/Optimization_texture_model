import React, { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';

const TextureCompression = ({ imageFile }) => {
  const [optimizationSettings, setOptimizationSettings] = useState({
    quality: 0.75, // Represents target size as a percentage of original (75%)
    maxWidth: 1024, // Default dimension
    format: 'png', // Default output format
  });
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState(0);
  const [originalImageSize, setOriginalImageSize] = useState(null);
  const [compressedImageSize, setCompressedImageSize] = useState(null);
  const [compressionRatio, setCompressionRatio] = useState(null);
  const [optimizedImageUrl, setOptimizedImageUrl] = useState(null);

  // Format file size for display
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Reset all state when imageFile changes
  useEffect(() => {
    // Clean up previous optimized image URL if it exists
    if (optimizedImageUrl) {
      URL.revokeObjectURL(optimizedImageUrl);
    }
    
    // If new image file is provided, set its size
    if (imageFile) {
      setOriginalImageSize(imageFile.size);
    } else {
      // Reset all state variables if no image is provided
      setOriginalImageSize(null);
      setCompressedImageSize(null);
      setCompressionRatio(null);
      setOptimizedImageUrl(null);
      setIsOptimizing(false);
      setOptimizationProgress(0);
      
      // Reset optimization settings to defaults
      setOptimizationSettings({
        quality: 0.75,
        maxWidth: 1024,
        format: 'png',
      });
    }
    
    // Clean up on unmount
    return () => {
      if (optimizedImageUrl) {
        URL.revokeObjectURL(optimizedImageUrl);
      }
    };
  }, [imageFile]);

  // Handle quality (target size) change
  const handleQualityChange = (e) => {
    const value = parseFloat(e.target.value) / 100;
    setOptimizationSettings({
      ...optimizationSettings,
      quality: value,
    });
  };

  // Handle dimension change
  const handleMaxWidthChange = (e) => {
    const value = parseInt(e.target.value.split('x')[0]);
    setOptimizationSettings({
      ...optimizationSettings,
      maxWidth: value,
    });
  };

  // Handle format change
  const handleFormatChange = (format) => {
    setOptimizationSettings({
      ...optimizationSettings,
      format,
    });
  };

  // Optimize image
  const optimizeImage = async () => {
    if (!imageFile) return;
    setIsOptimizing(true);
    setOptimizationProgress(10);

    try {
      const originalSize = imageFile.size;
      const targetSize = Math.min(
        (originalSize * optimizationSettings.quality) / (1024 * 1024),
        originalSize / (1024 * 1024) * 0.9 // Cap at 90% of original
      );

      // Get original image dimensions
      const img = new Image();
      img.src = URL.createObjectURL(imageFile);
      await new Promise((resolve) => (img.onload = resolve));

      const maxWidthOrHeight = Math.min(
        optimizationSettings.maxWidth,
        Math.max(img.width, img.height)
      );

      const options = {
        maxWidthOrHeight,
        useWebWorker: true,
        initialQuality: Math.min(optimizationSettings.quality, 0.6),
        maxSizeMB: targetSize > 0.01 ? targetSize : 0.01,
        exifOrientation: false, // Strip metadata
      };

      if (optimizationSettings.format === 'jpeg') {
        options.fileType = 'image/jpeg';
      } else if (optimizationSettings.format === 'png') {
        options.fileType = 'image/png';
      } else if (optimizationSettings.format === 'webp') {
        options.fileType = 'image/webp';
      }

      setOptimizationProgress(50);
      let optimizedBlob = await imageCompression(imageFile, options);

      // Retry if optimized image is larger
      if (optimizedBlob.size > originalSize) {
        console.warn('Optimized image is larger than original. Retrying with lower quality.');
        options.initialQuality *= 0.8;
        options.maxSizeMB *= 0.8;
        optimizedBlob = await imageCompression(imageFile, options);
      }

      // Calculate compression ratio
      const actualRatio = (optimizedBlob.size / originalSize) * 100;
      setCompressionRatio(actualRatio.toFixed(1));
      setCompressedImageSize(optimizedBlob.size);

      // Create preview URL
      // Clean up previous URL if it exists
      if (optimizedImageUrl) {
        URL.revokeObjectURL(optimizedImageUrl);
      }
      const optimizedPreviewUrl = URL.createObjectURL(optimizedBlob);
      setOptimizedImageUrl(optimizedPreviewUrl);

      setOptimizationProgress(100);
    } catch (error) {
      console.error('Error optimizing image:', error);
      alert('Failed to optimize image: ' + error.message);
    } finally {
      setTimeout(() => {
        setIsOptimizing(false);
        setOptimizationProgress(0);
      }, 500);
    }
  };

  // Save optimized image
  const saveImage = () => {
    if (!optimizedImageUrl) {
      alert('No optimized image available. Please optimize first.');
      return;
    }
    const link = document.createElement('a');
    link.href = optimizedImageUrl;
    const baseName = imageFile.name.split('.').slice(0, -1).join('.');
    const extension = optimizationSettings.format === 'jpeg' ? 'jpg' : optimizationSettings.format;
    link.download = `optimized_${baseName}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-800">Optimization Settings</h3>
      {imageFile ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">File: {imageFile.name}</p>
          {originalImageSize && (
            <p className="text-sm text-gray-600">
              Original Size: {formatFileSize(originalImageSize)}
              {compressedImageSize && (
                <span>
                  {' '}
                  (Compressed to {formatFileSize(compressedImageSize)} - {compressionRatio}% of original)
                </span>
              )}
            </p>
          )}
          {compressedImageSize > originalImageSize && (
            <p className="text-sm text-red-600">
              Warning: The optimized image is larger than the original. Try a lower quality setting or a different format.
            </p>
          )}

          {/* Target Size Slider */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Target Size (% of original)</label>
            <input
              type="range"
              min="1"
              max="100"
              value={optimizationSettings.quality * 100}
              onChange={handleQualityChange}
              className="w-full accent-orange-500"
              disabled={isOptimizing}
            />
            <span className="text-sm text-gray-600">{Math.round(optimizationSettings.quality * 100)}%</span>
          </div>

          {/* Dimensions Radio Buttons */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Dimensions</label>
            <div className="space-y-1">
              {['512x512', '1024x1024', '2048x2048', '4096x4096'].map((dim) => (
                <div key={dim}>
                  <input
                    type="radio"
                    id={`dim-${dim}`}
                    name="dimensions"
                    value={dim}
                    checked={optimizationSettings.maxWidth === parseInt(dim.split('x')[0])}
                    onChange={handleMaxWidthChange}
                    className="mr-2"
                    disabled={isOptimizing}
                  />
                  <label htmlFor={`dim-${dim}`} className="text-sm text-gray-600">
                    {dim}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Output Format Buttons */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Output Format</label>
            <div className="flex space-x-2">
              <button
                className={`flex-1 py-2 px-4 border rounded ${
                  optimizationSettings.format === 'jpeg'
                    ? 'bg-orange-500 text-white'
                    : 'border-gray-300 hover:bg-gray-100'
                }`}
                onClick={() => handleFormatChange('jpeg')}
                disabled={isOptimizing}
              >
                JPEG
              </button>
              
              <button
                className={`flex-1 py-2 px-4 border rounded ${
                  optimizationSettings.format === 'png'
                    ? 'bg-orange-500 text-white'
                    : 'border-gray-300 hover:bg-gray-100'
                }`}
                onClick={() => handleFormatChange('png')}
                disabled={isOptimizing}
              >
                PNG
              </button>
              
              <button
                className={`flex-1 py-2 px-4 border rounded ${
                  optimizationSettings.format === 'webp'
                    ? 'bg-orange-500 text-white'
                    : 'border-gray-300 hover:bg-gray-100'
                }`}
                onClick={() => handleFormatChange('webp')}
                disabled={isOptimizing}
              >
                WebP
              </button>
            </div>
          </div>

          {/* Optimize and Save Buttons */}
          <div className="flex space-x-2">
            <button
              className={`flex-1 py-2 px-4 border border-orange-500 text-orange-500 rounded ${
                isOptimizing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-50'
              }`}
              onClick={optimizeImage}
              disabled={isOptimizing}
            >
              {isOptimizing ? `Optimizing ${optimizationProgress}%` : 'Optimize'}
            </button>
            <button
              className={`flex-1 py-2 px-4 bg-orange-500 text-white rounded ${
                !optimizedImageUrl || isOptimizing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-600'
              }`}
              onClick={saveImage}
              disabled={!optimizedImageUrl || isOptimizing}
            >
              Save
            </button>
          </div>

          {/* Optimized Image Preview */}
          {/* {optimizedImageUrl && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-700 mb-2">Preview</h4>
              <img src={optimizedImageUrl} alt="Optimized preview" className="max-w-full h-auto border rounded" />
            </div>
          )} */}
        </div>
      ) : (
        <p className="text-gray-500">Upload an image to enable optimization settings.</p>
      )}
    </div>
  );
};

export default TextureCompression;