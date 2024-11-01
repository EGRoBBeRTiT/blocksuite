import { GfxLocalElementModel } from '@blocksuite/block-std/gfx';
import {
  PointLocation,
  type SerializedXYWH,
  type XYTangentInOut,
} from '@blocksuite/global/utils';

import type { Connection } from './connector.js';

import {
  type Color,
  ConnectorMode,
  DEFAULT_ROUGHNESS,
  type PointStyle,
  StrokeStyle,
} from '../../consts/index.js';

export class LocalConnectorElementModel extends GfxLocalElementModel {
  private _path: PointLocation[] = [];

  absolutePath: PointLocation[] = [];

  connection: { source: Connection; target: Connection } = {
    source: {},
    target: {},
  };

  frontEndpointStyle!: PointStyle;

  id: string = '';

  localUpdating = false;

  mode: ConnectorMode = ConnectorMode.Orthogonal;

  modeUpdating = false;

  points: XYTangentInOut[] = [];

  rearEndpointStyle!: PointStyle;

  rotate: number = 0;

  rough?: boolean;

  roughness: number = DEFAULT_ROUGHNESS;

  seed: number = Math.random();

  source: Connection = {
    position: [0, 0],
  };

  stroke: Color = '#000000';

  strokeStyle: StrokeStyle = StrokeStyle.Solid;

  strokeWidth: number = 4;

  target: Connection = {
    position: [0, 0],
  };

  xywh: SerializedXYWH = '[0,0,0,0]';

  get path(): PointLocation[] {
    if (!this._path || !this._path.length) {
      this.path = this.points.map(p => new PointLocation(...p));
    }
    return this._path;
  }

  set path(value: PointLocation[]) {
    const { x, y } = this;

    this._path = value;
    this.absolutePath = value.map(p => p.clone().setVec([p[0] + x, p[1] + y]));
  }

  get type() {
    return 'connector';
  }
}

declare global {
  namespace BlockSuite {
    interface SurfaceLocalModelMap {
      connector: LocalConnectorElementModel;
    }
  }
}
