import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Quaternion, Vector3 } from 'three';
import { markingRollForJoint, UPPER_COIL, LOWER_COIL } from '../rayquazaPoseReference.ts';

test('opposite neck/tail axes produce the same skin rotation at their shared seam', () => {
  for (const coil of [0, 0.25, 0.5, 0.75, 1]) {
    const neck = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), markingRollForJoint('Spine1') * coil);
    for (const name of ['Hips', 'Tail1', 'Tail8', 'Tail15']) {
      const tail = new Quaternion().setFromAxisAngle(new Vector3(0, -1, 0), markingRollForJoint(name) * coil);
      // Equal weights used to average opposing 90-degree turns to zero radius.
      for (const vertex of [new Vector3(1, 0, 0), new Vector3(0, 0, 1)]) {
        const blended = vertex.clone().applyQuaternion(neck).lerp(vertex.clone().applyQuaternion(tail), 0.5);
        assert.ok(Math.abs(blended.length() - 1) < 1e-10, `${name}, coil ${coil}`);
      }
    }
  }
});

test('reference curve segments join without gaps, including the waist junction', () => {
  const segments = [...UPPER_COIL, ...LOWER_COIL];
  for (let i = 1; i < segments.length; i++) assert.deepEqual(segments[i - 1][3], segments[i][0]);
  const upper = UPPER_COIL.at(-1)!;
  const lower = LOWER_COIL[0];
  const incoming = new Vector3(upper[3][0] - upper[2][0], upper[3][1] - upper[2][1], 0).normalize();
  const outgoing = new Vector3(lower[1][0] - lower[0][0], lower[1][1] - lower[0][1], 0).normalize();
  assert.ok(incoming.dot(outgoing) > 0.98, 'waist tangent remains smooth');
});
