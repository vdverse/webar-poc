import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { fitModelToAnchor } from './arSession';

describe('fitModelToAnchor', () => {
  it('scales the model to 0.6 target widths, centres it, and rests it on the page', () => {
    // Off-centre 2 x 4 x 2 box: largest dimension 4, centre at (5, 12, -3).
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2));
    mesh.position.set(5, 12, -3);
    const root = new THREE.Group();
    root.add(mesh);

    const wrapper = fitModelToAnchor(root);
    wrapper.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(wrapper);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Largest dimension becomes 0.6 (of the 1-unit-wide target). The model's
    // +Y (height) is rotated onto anchor +Z, standing out of the page.
    expect(size.z).toBeCloseTo(0.6, 5);
    expect(size.x).toBeCloseTo(0.3, 5);
    expect(size.y).toBeCloseTo(0.3, 5);

    // Centred on the target in the page plane, bottom resting on the page.
    expect(center.x).toBeCloseTo(0, 5);
    expect(center.y).toBeCloseTo(0, 5);
    expect(box.min.z).toBeCloseTo(0, 5);
  });

  it('handles a zero-size model without producing NaN transforms', () => {
    const wrapper = fitModelToAnchor(new THREE.Group());
    wrapper.updateMatrixWorld(true);
    expect(Number.isNaN(wrapper.matrixWorld.elements[0])).toBe(false);
  });
});
