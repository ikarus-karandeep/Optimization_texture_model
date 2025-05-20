import React, { useState } from 'react';
import Modal from 'react-responsive-modal';
export default function OptimizationResultsModal({
  showOptimizationPopup,
  setShowOptimizationPopup,
  affectedNodes,
  optimizationResults,
  
}) {
  const [selectedFilesForReplacement, setSelectedFilesForReplacement] = useState([]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownloadOptimizedModel = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `optimized_${fileName}.glb`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

 
  const toggleFileSelection = (fileIndex) => {
    setSelectedFilesForReplacement((prev) =>
      prev.includes(fileIndex) ? prev.filter((idx) => idx !== fileIndex) : [...prev, fileIndex]
    );
  };

  const toggleSelectAllFiles = () => {
    setSelectedFilesForReplacement(
      selectedFilesForReplacement.length === affectedNodes.length
        ? []
        : affectedNodes.map((_, idx) => idx)
    );
  };

  return (
    
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">Optimization Complete</h2>
        {affectedNodes.map((fileData, fileIndex) => (
          <div key={fileData.fileName} className="border-t pt-2">
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={selectedFilesForReplacement.includes(fileIndex)}
                  onChange={() => toggleFileSelection(fileIndex)}
                  className="absolute w-4 h-4 opacity-0 cursor-pointer z-10"
                />
                <div
                  className={`h-4 w-4 border rounded ${
                    selectedFilesForReplacement.includes(fileIndex) ? 'bg-[#C2410B] border-red-600' : 'border-gray-400'
                  }`}
                ></div>
              </div>
              <h3 className="font-semibold">{fileData.fileName}</h3>
              {optimizationResults[fileIndex]?.optimizedBlob &&
                optimizationResults[fileIndex]?.optimizedSize !== optimizationResults[fileIndex]?.originalSize && (
                  <button
                    onClick={() => handleDownloadOptimizedModel(optimizationResults[fileIndex].optimizedBlob, fileData.fileName)}
                    className="ml-2 flex items-center gap-1 bg-white border-2 border-[#EA580B] text-[#EA580B] px-2 py-1 text-sm rounded-lg hover:bg-[#EA580B] hover:text-white"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download
                  </button>
                )}
            </div>
            {optimizationResults[fileIndex] && (
              <div className="text-sm text-gray-600 mb-2 mt-2">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-1 px-2 text-left">Metric</th>
                      <th className="py-1 px-2 text-right">Original</th>
                      <th className="py-1 px-2 text-right">Optimized</th>
                      <th className="py-1 px-2 text-right">Reduction</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-200">
                      <td className="py-1 px-2">File Size</td>
                      <td className="py-1 px-2 text-right">{formatFileSize(optimizationResults[fileIndex].originalSize)}</td>
                      <td className="py-1 px-2 text-right">{formatFileSize(optimizationResults[fileIndex].optimizedSize)}</td>
                      <td className="py-1 px-2 text-right text-[#EA580B]">
                        {Math.round(
                          (1 - optimizationResults[fileIndex].optimizedSize / optimizationResults[fileIndex].originalSize) * 100
                        )}
                        %
                      </td>
                    </tr>
                    <tr className="border-t border-gray-200">
                      <td className="py-1 px-2">Vertices</td>
                      <td className="py-1 px-2 text-right">
                        {optimizationResults[fileIndex].originalVertexCount?.toLocaleString() || 'Unknown'}
                      </td>
                      <td className="py-1 px-2 text-right">
                        {optimizationResults[fileIndex].optimizedVertexCount?.toLocaleString() || 'Unknown'}
                      </td>
                      <td className="py-1 px-2 text-right text-[#EA580B]">
                        {optimizationResults[fileIndex].originalVertexCount &&
                        optimizationResults[fileIndex].optimizedVertexCount
                          ? `${Math.round(
                              (1 -
                                optimizationResults[fileIndex].optimizedVertexCount /
                                  optimizationResults[fileIndex].originalVertexCount) *
                                100
                            )}%`
                          : '-'}
                      </td>
                    </tr>
                    <tr className="border-t border-gray-200">
                      <td className="py-1 px-2">Polygons</td>
                      <td className="py-1 px-2 text-right">
                        {optimizationResults[fileIndex].originalPolyCount?.toLocaleString() || 'Unknown'}
                      </td>
                      <td className="py-1 px-2 text-right">
                        {optimizationResults[fileIndex].optimizedPolyCount?.toLocaleString() || 'Unknown'}
                      </td>
                      <td className="py-1 px-2 text-right text-[#EA580B]">
                        {optimizationResults[fileIndex].originalPolyCount && optimizationResults[fileIndex].optimizedPolyCount
                          ? `${Math.round(
                              (1 -
                                optimizationResults[fileIndex].optimizedPolyCount /
                                  optimizationResults[fileIndex].originalPolyCount) *
                                100
                            )}%`
                          : '-'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
        
      </div>
  );
}