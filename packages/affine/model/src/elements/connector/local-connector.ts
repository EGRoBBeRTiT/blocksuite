import { GfxLocalElementModel } from '@blocksuite/block-std/gfx';
import {
  getBezierSvgPathFromPoints,
  PointLocation,
  type SerializedPointLocation,
  type SerializedXYWH,
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
  #curveCommands = '';

  #path: PointLocation[] = [];

  absolutePath: PointLocation[] = [];

  frontEndpointStyle!: PointStyle;

  id: string = '';

  localUpdating = false;

  mode: ConnectorMode = ConnectorMode.Orthogonal;

  modeUpdating = false;

  rearEndpointStyle!: PointStyle;

  rotate: number = 0;

  rough?: boolean;

  roughness: number = DEFAULT_ROUGHNESS;

  seed: number = Math.random();

  serializedPath: SerializedPointLocation[] = [];

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

  /**
   * The SVG path commands for the curve connector.
   */
  get curveCommands() {
    if (!this.#curveCommands) {
      this.#curveCommands = getBezierSvgPathFromPoints(this.path);
    }
    return this.#curveCommands;
  }

  get path(): PointLocation[] {
    if (!this.#path || !this.#path.length) {
      this.path = this.serializedPath.map(PointLocation.fromSerialized);
    }
    return this.#path;
  }

  set path(value: PointLocation[]) {
    const { x, y } = this;
    this.#curveCommands = '';
    this.#path = value;
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
