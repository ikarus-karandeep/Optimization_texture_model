import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toCreasedNormals, preserveMaterialGroups, restoreMaterialGroups, checkForLostFeatures, analyzeFeatureSizes } from './ThreeJsUtils.jsx';
const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/v1/decoders/';

/*
 * @param {THREE.BufferGeometry} geometry - The geometry to simplify
 * @param {Object} optimizationConfig - Configuration options for optimization
 * @returns {boolean} - Whether the geometry was modified
 */
async function simplifyMesh(geometry, optimizationConfig) {
    if (!geometry || !geometry.attributes || !geometry.attributes.position || !optimizationConfig) {
        return false;
    }

    let modified = false;

    // Clone the original geometry to preserve it for comparison and fallback
    const originalGeometry = geometry.clone();

    // Record original counts for comparison
    const originalVertexCount = originalGeometry.attributes.position.count;
    const originalFaceCount = originalGeometry.index
        ? originalGeometry.index.count / 3
        : originalGeometry.attributes.position.count / 3;

    // Track the best geometry we've found so far
    let currentBestGeometry = geometry;
    let currentBestVertexCount = currentBestGeometry.attributes.position.count;

    // Step 1: Remove duplicate vertices if configured
    if (optimizationConfig.removeDuplicates) {
        try {
            const merged = THREE.BufferGeometryUtils.mergeVertices(geometry.clone(), 0.0001);

            if (merged.attributes.position.count <= currentBestVertexCount) {
                const newPosArray = new Float32Array(merged.attributes.position.array);
                const newPosition = new THREE.BufferAttribute(newPosArray, 3);
                geometry.setAttribute('position', newPosition);

                if (merged.index) {
                    const newIndexArray = new Uint32Array(merged.index.array);
                    geometry.setIndex(new THREE.BufferAttribute(newIndexArray, 1));
                }

                if (merged.attributes.normal) {
                    const newNormalArray = new Float32Array(merged.attributes.normal.array);
                    geometry.setAttribute('normal', new THREE.BufferAttribute(newNormalArray, 3));
                }

                if (merged.attributes.uv) {
                    const newUvArray = new Float32Array(merged.attributes.uv.array);
                    geometry.setAttribute('uv', new THREE.BufferAttribute(newUvArray, 2));
                }

                currentBestGeometry = geometry;
                currentBestVertexCount = geometry.attributes.position.count;
                modified = true;

                console.log(`Removed duplicate vertices: ${originalVertexCount} → ${currentBestVertexCount}`);
            } else {
                console.warn('Skipped mergeVertices as it would increase vertex count');
            }
        } catch (err) {
            console.warn('Error during mergeVertices:', err);
        }
    }

    // Step 2: Perform geometry simplification if configured
    if (!optimizationConfig.simplifyGeometry) {
        return modified;
    }

    try {
        const originalMaterialGroups = preserveMaterialGroups(originalGeometry);

        // Only compute normals if preserveNormals is false or no normals exist
        if (!optimizationConfig.preserveNormals || !geometry.attributes.normal) {
            geometry.computeVertexNormals();
            console.log('Computed new normals as preserveNormals is false or no normals provided');
        }

        const modifier = new SimplifyModifier();
        const meshAnalysis = analyzeFeatureSizes(geometry);

        let simplificationFactor;
        if (meshAnalysis.geometryComplexity > 0.7) {
    simplificationFactor = 0.85 * optimizationConfig.simplificationRatio;
    console.log('Very complex geometry detected - using moderate simplification');
} else if (meshAnalysis.geometryComplexity > 0.4) {
    simplificationFactor = 0.95 * optimizationConfig.simplificationRatio;
    console.log('Complex geometry detected - using aggressive simplification');
} else {
    simplificationFactor = 0.98 * optimizationConfig.simplificationRatio;
    console.log('Simple geometry detected - using very aggressive simplification');
}

        let targetRatio = Math.max(1 - simplificationFactor, 0.1);
        let currentTargetRatio = targetRatio;
        let simplificationSuccessful = false;
        let attempts = 0;
        const MAX_ATTEMPTS = 5;

        while (!simplificationSuccessful && attempts < MAX_ATTEMPTS) {
            attempts++;
            const targetCount = Math.min(
                Math.floor(originalVertexCount * currentTargetRatio),
                currentBestVertexCount - 1
            );

            if (targetCount >= currentBestVertexCount) {
                console.log('Cannot reduce vertex count further, stopping simplification');
                break;
            }

            console.log(
                `Simplification attempt #${attempts}: keeping ${Math.round(currentTargetRatio * 100)}% of vertices, removing ${Math.round(
                    (1 - currentTargetRatio) * 100
                )}%`
            );
            console.log(`Geometry complexity analysis: ${Math.round(meshAnalysis.geometryComplexity * 100)}% complex`);

            const clonedGeometry = originalGeometry.clone();

            try {
                const simplified = modifier.modify(clonedGeometry, targetCount);

                if (simplified.attributes.position.count >= originalVertexCount) {
                    console.warn('Simplification increased vertex count, rejecting result');
                    simplified.dispose();
                    currentTargetRatio = Math.min(currentTargetRatio + 0.02, 0.98); // was 0.05, smaller steps
                    continue;
                }

                if (originalMaterialGroups) {
                    restoreMaterialGroups(simplified, originalMaterialGroups);
                }

                // Only compute creased normals if preserveNormals is false or no normals exist
                if (!optimizationConfig.preserveNormals || !simplified.attributes.normal) {
                    simplified.computeVertexNormals();
                    const creaseAngle = meshAnalysis.geometryComplexity > 0.5 ? 2.5 : 3;
                    const creased = toCreasedNormals(simplified, creaseAngle);
                    simplified.dispose();
                    simplified = creased;
                }

                const originalBox = new THREE.Box3().setFromObject(new THREE.Mesh(originalGeometry));
                const newBox = new THREE.Box3().setFromObject(new THREE.Mesh(simplified));
                const originalSize = new THREE.Vector3();
                const newSize = new THREE.Vector3();
                originalBox.getSize(originalSize);
                newBox.getSize(newSize);

                const distortionThreshold = meshAnalysis.isHighDetail ? 0.1 : 0.15; // was 0.05 : 0.08
                const distortion =
                    Math.abs(newSize.x / originalSize.x - 1) > distortionThreshold ||
                    Math.abs(newSize.y / originalSize.y - 1) > distortionThreshold ||
                    Math.abs(newSize.z / originalSize.z - 1) > distortionThreshold;

                const featureAnalysis = checkForLostFeatures(originalGeometry, simplified);
                const featureLossThreshold = meshAnalysis.isHighDetail ? 0.5 : 0.6; // was 0.3 : 0.4
                const hasLostFeatures = featureAnalysis.lossRatio > featureLossThreshold;

                if (distortion || hasLostFeatures) {
                    console.warn(
                        `Simplification attempt #${attempts} rejected: Distortion=${distortion}, Features lost=${hasLostFeatures}. Feature loss ratio: ${featureAnalysis.lossRatio.toFixed(2)}`
                    );
                    currentTargetRatio = Math.min(currentTargetRatio + 0.05, 0.98);
                    simplified.dispose();
                    continue;
                }

                if (simplified.attributes.position.count < currentBestVertexCount) {
                    const newPosArray = new Float32Array(simplified.attributes.position.array);
                    geometry.setAttribute('position', new THREE.BufferAttribute(newPosArray, 3));

                    if (simplified.index) {
                        const newIndexArray = new Uint32Array(simplified.index.array);
                        geometry.setIndex(new THREE.BufferAttribute(newIndexArray, 1));
                        console.log('Index preserved during simplification');
                    } else {
                        console.warn('Index lost during simplification');
                    }

                    if (simplified.attributes.normal) {
                        const newNormalArray = new Float32Array(simplified.attributes.normal.array);
                        geometry.setAttribute('normal', new THREE.BufferAttribute(newNormalArray, 3));
                        console.log('Normals preserved during simplification');
                    } else {
                        console.warn('Normals lost during simplification');
                    }

                    if (simplified.attributes.uv) {
                        const newUvArray = new Float32Array(simplified.attributes.uv.array);
                        geometry.setAttribute('uv', new THREE.BufferAttribute(newUvArray, 2));
                        console.log('UVs preserved during simplification');
                    } else {
                        console.warn('UVs lost during simplification');
                    }

                    if (simplified.groups && simplified.groups.length > 0) {
                        geometry.groups = JSON.parse(JSON.stringify(simplified.groups));
                    }

                    currentBestGeometry = geometry;
                    currentBestVertexCount = geometry.attributes.position.count;
                    modified = true;
                    simplificationSuccessful = true;

                    const newFaceCount = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
                    const actualReductionPercent = Math.round((1 - newFaceCount / originalFaceCount) * 100);

                    console.log(
                        `Simplification complete: Initially requested ${Math.round((1 - targetRatio) * 100)}% reduction, settled on ${Math.round(
                            (1 - currentTargetRatio) * 100
                        )}% target, achieved ${actualReductionPercent}% actual reduction. Vertex count reduced from ${originalVertexCount} to ${currentBestVertexCount}.`
                    );
                } else {
                    console.warn('Simplification did not reduce vertex count, rejecting result');
                    simplified.dispose();
                    currentTargetRatio = Math.min(currentTargetRatio + 0.02, 0.98); // was 0.05, smaller steps
                }
            } catch (err) {
                console.warn(`Error during simplification attempt #${attempts}:`, err);
                currentTargetRatio = Math.min(currentTargetRatio + 0.1, 0.98);
            }
        }

        if (!simplificationSuccessful && attempts >= MAX_ATTEMPTS) {
            console.warn(`Failed to simplify mesh after ${MAX_ATTEMPTS} attempts.`);
        }

    } catch (error) {
        console.error('Error during simplification:', error);
        return false;
    }

    return modified;
}

self.onmessage = async function (e) {
    const { meshData, optimizationConfig } = e.data;

    try {
        const geometry = new THREE.BufferGeometry();

        if (meshData.attributes.position) {
            geometry.setAttribute('position',
                new THREE.Float32BufferAttribute(meshData.attributes.position, 3));
        }

        if (meshData.attributes.normal) {
            geometry.setAttribute('normal',
                new THREE.Float32BufferAttribute(meshData.attributes.normal, 3));
        }

        if (meshData.attributes.uv) {
            geometry.setAttribute('uv',
                new THREE.Float32BufferAttribute(meshData.attributes.uv, 2));
        }

        if (meshData.index) {
            geometry.setIndex(
                new THREE.Uint32BufferAttribute(meshData.index, 1)
            );
        }

        if (meshData.groups && meshData.groups.length) {
            geometry.groups = JSON.parse(JSON.stringify(meshData.groups));
        }

        const modified = await simplifyMesh(geometry, optimizationConfig);

        const resultData = {
            modified,
            geometry: {
                attributes: {
                    position: geometry.attributes.position.array,
                    normal: geometry.attributes.normal ? geometry.attributes.normal.array : null,
                    uv: geometry.attributes.uv ? geometry.attributes.uv.array : null
                },
                index: geometry.index ? geometry.index.array : null,
                groups: geometry.groups
            }
        };

        const transferables = [];
        const seenBuffers = new Set();

        const addUniqueBuffer = (buffer) => {
            if (buffer && !seenBuffers.has(buffer)) {
                seenBuffers.add(buffer);
                transferables.push(buffer);
            }
        };

        if (geometry.attributes.position && geometry.attributes.position.array) {
            addUniqueBuffer(geometry.attributes.position.array.buffer);
        }

        if (geometry.attributes.normal && geometry.attributes.normal.array) {
            addUniqueBuffer(geometry.attributes.normal.array.buffer);
        }

        if (geometry.attributes.uv && geometry.attributes.uv.array) {
            addUniqueBuffer(geometry.attributes.uv.array.buffer);
        }

        if (geometry.index && geometry.index.array) {
            addUniqueBuffer(geometry.index.array.buffer);
        }

        self.postMessage(resultData, transferables);

    } catch (error) {
        self.postMessage({
            error: error.toString(),
            stack: error.stack
        });
    }
}