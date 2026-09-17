export interface TouchPoint {
  readonly x: number;
  readonly y: number;
}

export const TOUCH_DRAG_THRESHOLD = 8;

export type TouchGestureUpdate =
  | { readonly type: 'none' }
  | { readonly type: 'tap'; readonly point: TouchPoint }
  | {
    readonly type: 'drag';
    readonly point: TouchPoint;
    readonly delta: TouchPoint;
    readonly started: boolean;
  }
  | {
    readonly type: 'pinch';
    readonly midpoint: TouchPoint;
    readonly delta: TouchPoint;
    readonly scale: number;
  };

type GestureKind = 'tap' | 'drag' | 'pinch';

export class TouchGestureRecognizer {
  private readonly pointers = new Map<number, TouchPoint>();
  private kind: GestureKind | undefined;
  private startPoint: TouchPoint | undefined;
  private primaryPointerId: number | undefined;

  get isActive(): boolean {
    return this.pointers.size > 0;
  }

  get isPinching(): boolean {
    return this.kind === 'pinch';
  }

  pointerDown(pointerId: number, point: TouchPoint): void {
    this.pointers.set(pointerId, { x: point.x, y: point.y });
    if (this.pointers.size === 1) {
      this.kind = 'tap';
      this.primaryPointerId = pointerId;
      this.startPoint = { x: point.x, y: point.y };
      return;
    }

    this.kind = 'pinch';
    this.primaryPointerId = undefined;
    this.startPoint = undefined;
  }

  pointerMove(pointerId: number, point: TouchPoint): TouchGestureUpdate {
    const previousPoint = this.pointers.get(pointerId);
    if (previousPoint === undefined) return { type: 'none' };

    const previousPinch = this.getPinchPoints();
    const currentPoint = { x: point.x, y: point.y };
    this.pointers.set(pointerId, currentPoint);
    const currentPinch = this.getPinchPoints();
    if (previousPinch !== undefined && currentPinch !== undefined) {
      this.kind = 'pinch';
      const currentMidpoint = midpoint(currentPinch.first, currentPinch.second);
      return {
        type: 'pinch',
        midpoint: currentMidpoint,
        delta: {
          x: currentMidpoint.x - (previousPinch.first.x + previousPinch.second.x) / 2,
          y: currentMidpoint.y - (previousPinch.first.y + previousPinch.second.y) / 2,
        },
        scale: distance(currentPinch.first, currentPinch.second) / distanceOrOne(previousPinch.first, previousPinch.second),
      };
    }

    if (this.kind === 'pinch' || pointerId !== this.primaryPointerId || this.startPoint === undefined) {
      return { type: 'none' };
    }

    const started = this.kind === 'tap' && distance(currentPoint, this.startPoint) >= TOUCH_DRAG_THRESHOLD;
    if (started) this.kind = 'drag';
    if (this.kind !== 'drag') return { type: 'none' };
    return {
      type: 'drag',
      point: currentPoint,
      delta: { x: currentPoint.x - previousPoint.x, y: currentPoint.y - previousPoint.y },
      started,
    };
  }

  pointerUp(pointerId: number, point: TouchPoint): TouchGestureUpdate {
    if (!this.pointers.has(pointerId)) return { type: 'none' };
    const update = this.pointerMove(pointerId, point);
    if (this.kind === 'pinch') {
      this.cancel();
      return { type: 'none' };
    }

    const wasTap = update.type === 'none' && this.kind === 'tap' && pointerId === this.primaryPointerId;
    this.cancel();
    return wasTap ? { type: 'tap', point } : { type: 'none' };
  }

  cancel(): void {
    this.pointers.clear();
    this.kind = undefined;
    this.primaryPointerId = undefined;
    this.startPoint = undefined;
  }

  private getPinchPoints(): { readonly first: TouchPoint; readonly second: TouchPoint } | undefined {
    const iterator = this.pointers.values();
    const first = iterator.next().value;
    const second = iterator.next().value;
    return first === undefined || second === undefined ? undefined : { first, second };
  }
}

function distance(first: TouchPoint, second: TouchPoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function distanceOrOne(first: TouchPoint, second: TouchPoint): number {
  return distance(first, second) || 1;
}

function midpoint(first: TouchPoint, second: TouchPoint): TouchPoint {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}
