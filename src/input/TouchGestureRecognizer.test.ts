import { describe, expect, it } from 'vitest';
import { TOUCH_DRAG_THRESHOLD, TouchGestureRecognizer } from './TouchGestureRecognizer';

describe('TouchGestureRecognizer', () => {
  it('keeps a short one-finger interaction as a tap', () => {
    const gestures = new TouchGestureRecognizer();

    gestures.pointerDown(1, { x: 10, y: 20 });
    expect(gestures.pointerMove(1, { x: 10 + TOUCH_DRAG_THRESHOLD - 1, y: 20 })).toEqual({ type: 'none' });
    expect(gestures.pointerUp(1, { x: 10 + TOUCH_DRAG_THRESHOLD - 1, y: 20 })).toEqual({
      type: 'tap', point: { x: 10 + TOUCH_DRAG_THRESHOLD - 1, y: 20 },
    });
    expect(gestures.isActive).toBe(false);
  });

  it('reports one-finger drag deltas after crossing the threshold', () => {
    const gestures = new TouchGestureRecognizer();

    gestures.pointerDown(1, { x: 5, y: 5 });
    expect(gestures.pointerMove(1, { x: 5 + TOUCH_DRAG_THRESHOLD, y: 5 })).toEqual({
      type: 'drag',
      point: { x: 5 + TOUCH_DRAG_THRESHOLD, y: 5 },
      delta: { x: TOUCH_DRAG_THRESHOLD, y: 0 },
      started: true,
    });
    expect(gestures.pointerMove(1, { x: 20, y: 15 })).toEqual({
      type: 'drag', point: { x: 20, y: 15 }, delta: { x: 20 - (5 + TOUCH_DRAG_THRESHOLD), y: 10 }, started: false,
    });
  });

  it('cancels tap and drag for pinch with incremental midpoint deltas and scale', () => {
    const gestures = new TouchGestureRecognizer();

    gestures.pointerDown(1, { x: 0, y: 0 });
    gestures.pointerDown(2, { x: 10, y: 0 });
    expect(gestures.pointerMove(2, { x: 20, y: 0 })).toEqual({
      type: 'pinch', midpoint: { x: 10, y: 0 }, delta: { x: 5, y: 0 }, scale: 2,
    });
    expect(gestures.pointerMove(1, { x: 5, y: 0 })).toEqual({
      type: 'pinch', midpoint: { x: 12.5, y: 0 }, delta: { x: 2.5, y: 0 }, scale: 0.75,
    });
    expect(gestures.pointerUp(2, { x: 20, y: 0 })).toEqual({ type: 'none' });
    expect(gestures.isActive).toBe(false);
    expect(gestures.pointerUp(1, { x: 5, y: 0 })).toEqual({ type: 'none' });
    expect(gestures.isActive).toBe(false);
  });

  it('reports scale one for a two-finger midpoint pan', () => {
    const gestures = new TouchGestureRecognizer();

    gestures.pointerDown(1, { x: 0, y: 0 });
    gestures.pointerDown(2, { x: 10, y: 0 });
    expect(gestures.pointerMove(1, { x: 20, y: 0 })).toEqual({
      type: 'pinch', midpoint: { x: 15, y: 0 }, delta: { x: 10, y: 0 }, scale: 1,
    });
  });

  it('clears active gestures for cancellation and outside release', () => {
    const gestures = new TouchGestureRecognizer();

    gestures.pointerDown(1, { x: 0, y: 0 });
    gestures.pointerMove(1, { x: TOUCH_DRAG_THRESHOLD, y: 0 });
    gestures.cancel();
    expect(gestures.isActive).toBe(false);
    expect(gestures.pointerMove(1, { x: 20, y: 0 })).toEqual({ type: 'none' });

    gestures.pointerDown(2, { x: 1, y: 1 });
    gestures.cancel();
    expect(gestures.pointerUp(2, { x: 1, y: 1 })).toEqual({ type: 'none' });
    expect(gestures.isActive).toBe(false);
  });
});
