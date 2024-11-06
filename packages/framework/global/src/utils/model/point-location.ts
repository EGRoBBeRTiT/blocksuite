import type { BooleanNumber } from '../types.js';

import { type IVec, Vec } from './vec.js';

export type SerializedPointLocation = {
  xy: IVec;
  tangent: IVec;
  inVec: IVec;
  outVec: IVec;
  lockedAxises: [BooleanNumber, BooleanNumber];
};

/**
 * PointLocation is an implementation of IVec with in/out vectors and tangent.
 * This is useful when dealing with path.
 */
export class PointLocation extends Array<number> implements IVec {
  _in: IVec = [0, 0];

  _out: IVec = [0, 0];

  // the tangent belongs to the point on the element outline
  _tangent: IVec = [0, 0];

  [0]: number;

  [1]: number;

  freezedAxises: [boolean, boolean] = [false, false];

  get absIn() {
    return Vec.add(this, this._in);
  }

  get absOut() {
    return Vec.add(this, this._out);
  }

  get in() {
    return this._in;
  }

  set in(value: IVec) {
    this._in = value;
  }

  override get length() {
    return super.length as 2;
  }

  get out() {
    return this._out;
  }

  set out(value: IVec) {
    this._out = value;
  }

  get tangent() {
    return this._tangent;
  }

  set tangent(value: IVec) {
    this._tangent = value;
  }

  constructor(
    point: IVec = [0, 0],
    tangent: IVec = [0, 0],
    inVec: IVec = [0, 0],
    outVec: IVec = [0, 0],
    freezedAxises?: [number | boolean, number | boolean]
  ) {
    super(2);
    this[0] = point[0];
    this[1] = point[1];
    this._tangent = tangent;
    this._in = inVec;
    this._out = outVec;
    this.freezedAxises = [!!freezedAxises?.[0], !!freezedAxises?.[1]];
  }

  static fromSerialized({
    xy,
    tangent,
    inVec,
    outVec,
    lockedAxises,
  }: SerializedPointLocation) {
    return new PointLocation(xy, tangent, inVec, outVec, lockedAxises);
  }

  static fromVec(vec: IVec) {
    const point = new PointLocation();
    point[0] = vec[0];
    point[1] = vec[1];
    return point;
  }

  clone() {
    return new PointLocation(
      this as unknown as IVec,
      this._tangent,
      this._in,
      this._out,
      this.freezedAxises
    );
  }

  serialize(): SerializedPointLocation {
    return {
      xy: this.toVec(),
      tangent: this._tangent,
      inVec: this._in,
      outVec: this._out,
      lockedAxises: [
        this.freezedAxises[0] ? 1 : 0,
        this.freezedAxises[1] ? 1 : 0,
      ],
    };
  }

  setVec(vec: IVec) {
    this[0] = vec[0];
    this[1] = vec[1];
    return this;
  }

  toVec(): IVec {
    return [this[0], this[1]];
  }
}
