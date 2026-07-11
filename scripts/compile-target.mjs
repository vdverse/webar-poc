/**
 * Compile public/ar-demo/target.jpg into public/ar-demo/target.mind.
 *
 * This replicates mind-ar's OfflineCompiler (node_modules/mind-ar/src/
 * image-target/{compiler-base.js,offline-compiler.js}) but feeds grayscale
 * pixels directly, so the native `canvas` package (which fails to build on
 * some machines) is not required.
 *
 * Input: scripts/target.gray + scripts/target.size produced by
 *        scripts/generate-target.py (raw 8-bit grayscale dump).
 * Output: public/ar-demo/target.mind (msgpack, format v2 — identical layout
 *         to the official web compiler at
 *         https://hiukim.github.io/mind-ar-js-doc/tools/compile).
 */
import { readFileSync, writeFileSync } from 'node:fs';

import * as msgpack from '@msgpack/msgpack';
import * as tf from '@tensorflow/tfjs';
// Registers mind-ar's custom CPU kernels used by the Detector.
import 'mind-ar/src/image-target/detector/kernels/cpu/index.js';
import { Detector } from 'mind-ar/src/image-target/detector/detector.js';
import {
  buildImageList,
  buildTrackingImageList,
} from 'mind-ar/src/image-target/image-list.js';
import { build as buildCluster } from 'mind-ar/src/image-target/matching/hierarchical-clustering.js';
import { extractTrackingFeatures } from 'mind-ar/src/image-target/tracker/extract-utils.js';

const CURRENT_VERSION = 2; // must match CompilerBase.CURRENT_VERSION

const { width, height } = JSON.parse(
  readFileSync('scripts/target.size', 'utf8'),
);
const gray = new Uint8Array(readFileSync('scripts/target.gray'));
if (gray.length !== width * height) {
  throw new Error(`grayscale size mismatch: ${gray.length} != ${width * height}`);
}

await tf.setBackend('cpu');
await tf.ready();
console.log('tf backend:', tf.getBackend());

const targetImage = { data: gray, width, height };

// --- matching data (same as CompilerBase._extractMatchingFeatures) ---
const imageList = buildImageList(targetImage);
console.log(`matching: ${imageList.length} scales`);
const matchingData = [];
for (let i = 0; i < imageList.length; i++) {
  const image = imageList[i];
  const detector = new Detector(image.width, image.height);
  await tf.nextFrame();
  tf.tidy(() => {
    const inputT = tf
      .tensor(image.data, [image.data.length], 'float32')
      .reshape([image.height, image.width]);
    const { featurePoints: ps } = detector.detect(inputT);
    const maximaPoints = ps.filter((p) => p.maxima);
    const minimaPoints = ps.filter((p) => !p.maxima);
    matchingData.push({
      maximaPoints,
      minimaPoints,
      maximaPointsCluster: buildCluster({ points: maximaPoints }),
      minimaPointsCluster: buildCluster({ points: minimaPoints }),
      width: image.width,
      height: image.height,
      scale: image.scale,
    });
  });
  console.log(
    `  scale ${i + 1}/${imageList.length}: ${image.width}x${image.height}`,
  );
}

// --- tracking data (same as OfflineCompiler.compileTrack) ---
const trackingImageList = buildTrackingImageList(targetImage);
console.log(`tracking: ${trackingImageList.length} scales`);
const trackingData = extractTrackingFeatures(trackingImageList, (i) => {
  console.log(`  tracking scale ${i + 1}/${trackingImageList.length} done`);
});

// --- export (same as CompilerBase.exportData) ---
const buffer = msgpack.encode({
  v: CURRENT_VERSION,
  dataList: [
    {
      targetImage: { width, height },
      trackingData,
      matchingData,
    },
  ],
});
writeFileSync('public/ar-demo/target.mind', buffer);
console.log(`wrote public/ar-demo/target.mind (${buffer.length} bytes)`);

// --- sanity check: decode and validate structure ---
const decoded = msgpack.decode(readFileSync('public/ar-demo/target.mind'));
const entry = decoded.dataList[0];
const kf = entry.matchingData[0];
console.log('verify:', {
  v: decoded.v,
  targets: decoded.dataList.length,
  dims: entry.targetImage,
  matchingScales: entry.matchingData.length,
  trackingScales: entry.trackingData.length,
  firstScaleMaxima: kf.maximaPoints.length,
  firstScaleMinima: kf.minimaPoints.length,
});
if (decoded.v !== 2 || kf.maximaPoints.length + kf.minimaPoints.length < 100) {
  throw new Error('compiled target looks invalid or feature-poor');
}
console.log('OK');
