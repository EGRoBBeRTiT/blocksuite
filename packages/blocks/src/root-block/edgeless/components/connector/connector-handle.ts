import type { GfxModel } from '@blocksuite/block-std/gfx';

import { ConnectorPathGenerator } from '@blocksuite/affine-block-surface';
import {
  type ConnectorElementModel,
  ConnectorMode,
} from '@blocksuite/affine-model';
import { DisposableGroup, Vec, WithDisposable } from '@blocksuite/global/utils';
import { css, html, LitElement, nothing } from 'lit';
import { property, query, queryAll } from 'lit/decorators.js';
import { type StyleInfo, styleMap } from 'lit/directives/style-map.js';

import type { EdgelessRootBlockComponent } from '../../edgeless-root-block.js';

const SIZE = 12;
const HALF_SIZE = SIZE / 2;

export class EdgelessConnectorHandle extends WithDisposable(LitElement) {
  static override styles = css`
    .line-controller,
    .line-anchor {
      position: absolute;
      width: ${SIZE}px;
      height: ${SIZE}px;
      box-sizing: border-box;
      border-radius: 50%;
      border: 2px solid var(--affine-text-emphasis-color);
      background-color: var(--affine-background-primary-color);
      cursor: pointer;
      z-index: 10;
      pointer-events: all;
      /**
       * Fix: pointerEvent stops firing after a short time.
       * When a gesture is started, the browser intersects the touch-action values of the touched element and its ancestors,
       * up to the one that implements the gesture (in other words, the first containing scrolling element)
       * https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
       */
      touch-action: none;
    }
    .line-controller-hidden {
      display: none;
    }

    .line-anchor.unavailable {
      background-color: var(--affine-text-emphasis-color);
      border: 2px solid var(--affine-background-primary-color);
    }
  `;

  private _isMoving = false;

  private _lastZoom = 1;

  private _anchorDbClick(e: MouseEvent, target: HTMLDivElement) {
    e.stopPropagation();
    const index = Number(target.dataset.pointId);
    this.edgeless.service.doc.transact(() => {
      ConnectorPathGenerator.removePoint(this.connector, index, id =>
        this._getElementById(id)
      );
    });
  }

  private _bindEvent() {
    const { edgeless } = this;

    this._disposables.add(
      edgeless.service.surface.elementUpdated.on(({ id }) => {
        if (!this._isMoving && id === this.connector.id) {
          this.requestUpdate();
          void this.updateComplete.then(() => {
            this._disposables.dispose();
            this._disposables = new DisposableGroup();
            this._bindEvent();
          });
        }
      })
    );
    this._anchorHandlers.forEach(middleElement => {
      this._disposables.addFromEvent(
        middleElement as HTMLDivElement,
        'pointerdown',
        e => {
          edgeless.slots.elementResizeStart.emit();
          this._closedAnchorPointerDown(e, middleElement as HTMLDivElement);
        }
      );
    });
    this._disposables.addFromEvent(this._startHandler, 'pointerdown', e => {
      edgeless.slots.elementResizeStart.emit();
      this._capPointerDown(e, 'source');
    });
    this._disposables.addFromEvent(this._endHandler, 'pointerdown', e => {
      edgeless.slots.elementResizeStart.emit();
      this._capPointerDown(e, 'target');
    });
    this._disposables.add(() => {
      edgeless.service.connectorOverlay.clear();
    });
    const addDblclickListener = (element: Node) => {
      this._disposables.addFromEvent(element as HTMLElement, 'dblclick', e => {
        this._anchorDbClick(e, element as HTMLDivElement);
      });
    };
    this._availableAnchors.forEach(addDblclickListener);
    this._lockedAnchors.forEach(addDblclickListener);
  }

  private _capPointerDown(e: PointerEvent, connection: 'target' | 'source') {
    const { edgeless, connector, _disposables } = this;
    const service = edgeless.service;

    e.stopPropagation();
    _disposables.addFromEvent(document, 'pointermove', e => {
      if (!this._isMoving) {
        this._isMoving = true;
        connector.stashRapidlyFields();
      }
      const point = service.viewport.toModelCoordFromClientCoord([e.x, e.y]);
      const isStartPointer = connection === 'source';
      const otherSideId = connector[isStartPointer ? 'target' : 'source'].id;

      service.doc.transact(() => {
        connector[connection] =
          edgeless.service.connectorOverlay.renderConnector(
            point,
            otherSideId ? [otherSideId] : []
          );
      });
      this.requestUpdate();
    });

    _disposables.addFromEvent(document, 'pointerup', () => {
      if (this._isMoving) {
        this._isMoving = false;
        service.doc.transact(() => {
          connector.popRapidlyFields();
        });
      }
      this._disposePointerup();
    });
  }

  private _closedAnchorPointerDown(e: PointerEvent, target: HTMLDivElement) {
    e.stopPropagation();
    const { edgeless, connector, _disposables } = this;
    const service = edgeless.service;
    const isAvailable = target.classList.contains('available');
    const isUnAvailable = target.classList.contains('unavailable');
    const isLocked = target.classList.contains('locked');
    const fieldsForStash = ['xywh', 'labelXYWH', 'serializedPath'];
    const pointId = Number(target.dataset.pointId);
    let movingIndex = isAvailable ? pointId : Number.NaN;

    _disposables.addFromEvent(document, 'pointermove', e => {
      if (!this._isMoving) {
        this._isMoving = true;
        fieldsForStash.forEach(connector.stash.bind(connector));
      }

      const point = service.viewport.toModelCoordFromClientCoord([e.x, e.y]);

      if (!isNaN(movingIndex)) {
        service.doc.transact(() => {
          movingIndex = ConnectorPathGenerator.movePoint(
            connector,
            id => this._getElementById(id),
            movingIndex,
            point
          );
        });
      }

      if (isNaN(movingIndex) && (isUnAvailable || isLocked)) {
        if (connector.mode === ConnectorMode.Orthogonal) {
          service.doc.transact(() => {
            movingIndex = ConnectorPathGenerator.movePoint(
              connector,
              id => this._getElementById(id),
              pointId,
              point
            );
          });
        } else {
          service.doc.transact(() => {
            ConnectorPathGenerator.addPointIntoPath(connector, pointId + 1);
          });
          movingIndex = pointId + 1;
        }
      }
      this.requestUpdate();
    });

    _disposables.addFromEvent(document, 'pointerup', () => {
      movingIndex = Number.NaN;
      if (this._isMoving) {
        this._isMoving = false;
        service.doc.transact(() => {
          ConnectorPathGenerator.removeExtraPoints(
            connector,
            this._getElementById.bind(this)
          );
          fieldsForStash.forEach(connector.pop.bind(connector));
        });
      }
      this._disposePointerup();
    });
  }

  private _disposePointerup() {
    const edgeless = this.edgeless;
    const _disposables = this._disposables;
    edgeless.service.overlays.connector.clear();
    edgeless.doc.captureSync();
    _disposables.dispose();
    this._disposables = new DisposableGroup();
    this._bindEvent();
    edgeless.slots.elementResizeEnd.emit();
  }

  private _getClosedAnchorPointStyles() {
    if (this._isMoving) {
      return [];
    }
    const { path, mode } = this.connector;
    const service = this.edgeless.service;
    const zoom = service.viewport.zoom;

    return path.reduce<StyleInfo[]>((acc, point, index) => {
      if (index === 0 || index === path.length - 1) {
        return acc;
      }
      const styles: StyleInfo = {};
      if (mode === ConnectorMode.Orthogonal) {
        styles.display = 'none';
      } else {
        const domPoint = Vec.subScalar(Vec.mul(point, zoom), HALF_SIZE);
        styles.transform = `translate3d(${domPoint[0]}px,${domPoint[1]}px,0)`;
      }
      acc.push(styles);
      return acc;
    }, []);
  }

  private _getElementById(id: string) {
    return (
      this.edgeless.surfaceBlockModel.getElementById(id) ??
      (this.edgeless.surfaceBlockModel.doc.getBlockById(id) as GfxModel)
    );
  }

  private _getMiddlePointStyles() {
    if (this._isMoving) {
      return [];
    }
    const { path, mode, absolutePath } = this.connector;
    const service = this.edgeless.service;
    const zoom = service.viewport.zoom;
    const isOrthogonal = mode === ConnectorMode.Orthogonal;

    const { startBound, endBound } = new ConnectorPathGenerator({
      getElementById: id => this._getElementById(id),
    }).getStartEndBounds(this.connector);

    return path.reduce<StyleInfo[]>((acc, point, index) => {
      if (index > 0) {
        const start = path[index - 1];
        const end = point;

        const centerPoint =
          this.connector.mode === ConnectorMode.Curve
            ? Vec.lrpCubic(start, start.absOut, end.absIn, end, 0.5)
            : Vec.lrp(start, end, 0.5);

        const domPoint = Vec.subScalar(Vec.mul(centerPoint, zoom), HALF_SIZE);

        const styles: StyleInfo = {
          transform: `translate3d(${domPoint[0]}px,${domPoint[1]}px,0)`,
          display: '',
        };

        if (isOrthogonal) {
          const isEdge = index === 1 || index === path.length - 1;
          if (isEdge) {
            const pointIndex = index === 1 ? index : index - 1;
            const bound = index === 1 ? startBound : endBound;
            const startEndPoint =
              index === 1
                ? absolutePath[0]
                : absolutePath[absolutePath.length - 1];
            const absolutePoint = absolutePath[pointIndex];

            if (bound) {
              const { minX, minY, maxX, maxY } = bound;
              const distToLeft = Math.abs(startEndPoint[0] - minX);
              const distToRight = Math.abs(startEndPoint[0] - maxX);
              const distToTop = Math.abs(startEndPoint[1] - minY);
              const distToBottom = Math.abs(startEndPoint[1] - maxY);
              const minDist =
                Math.min(distToLeft, distToRight, distToTop, distToBottom) + 40;
              if (Vec.dist(absolutePoint, startEndPoint) <= minDist + 0.02) {
                styles.display = 'none';
              }
            }
          }
          if (Vec.dist(path[index], path[index - 1]) <= 20.02) {
            styles.display = 'none';
          }
        }

        acc.push(styles);
      }

      return acc;
    }, []);
  }

  override firstUpdated() {
    const edgeless = this.edgeless;
    const viewport = edgeless.service.viewport;

    this._lastZoom = viewport.zoom;
    edgeless.service.viewport.viewportUpdated.on(() => {
      if (viewport.zoom !== this._lastZoom) {
        this._lastZoom = viewport.zoom;
        this.requestUpdate();
      }
    });
    void this.updateComplete.then(() => {
      this._bindEvent();
    });
  }

  override render() {
    const service = this.edgeless.service;
    // path is relative to the element's xywh
    const path = this.connector.path;
    const zoom = service.viewport.zoom;
    const startPoint = Vec.subScalar(Vec.mul(path[0], zoom), HALF_SIZE);
    const endPoint = Vec.subScalar(
      Vec.mul(path[path.length - 1], zoom),
      HALF_SIZE
    );
    const startStyle = {
      transform: `translate3d(${startPoint[0]}px,${startPoint[1]}px,0)`,
    };
    const endStyle = {
      transform: `translate3d(${endPoint[0]}px,${endPoint[1]}px,0)`,
    };

    const closedAnchorPointStyles = this._getClosedAnchorPointStyles();
    const middlePointStyles = this._getMiddlePointStyles();

    return html`
      <div
        class="line-controller line-start"
        style=${styleMap(startStyle)}
      ></div>
      ${middlePointStyles.map((style, index) => {
        const [beforeLockedX, beforeLockedY] =
          this.connector.absolutePath[index].lockedAxises;
        const [afterLockedX, afterLockedY] =
          this.connector.absolutePath[index + 1].lockedAxises;
        const isLineLocked =
          this.connector.mode === ConnectorMode.Orthogonal &&
          ((beforeLockedX && afterLockedX) || (beforeLockedY && afterLockedY));
        if (style.display === 'none') {
          return nothing;
        }
        return html`<div
          style=${styleMap(style)}
          class="line-anchor ${isLineLocked ? 'locked' : 'unavailable'}"
          data-point-id=${index}
        ></div>`;
      })}
      ${closedAnchorPointStyles.map(
        (style, index) =>
          html`<div
            style=${styleMap(style)}
            class="line-anchor available"
            data-point-id=${index + 1}
          ></div>`
      )}
      <div class="line-controller line-end" style=${styleMap(endStyle)}></div>
    `;
  }

  @queryAll('.line-anchor')
  private accessor _anchorHandlers!: NodeList;

  @queryAll('.line-anchor.available')
  private accessor _availableAnchors!: NodeList;

  @query('.line-end')
  private accessor _endHandler!: HTMLDivElement;

  @queryAll('.line-anchor.locked')
  private accessor _lockedAnchors!: NodeList;

  @query('.line-start')
  private accessor _startHandler!: HTMLDivElement;

  @property({ attribute: false })
  accessor connector!: ConnectorElementModel;

  @property({ attribute: false })
  accessor edgeless!: EdgelessRootBlockComponent;
}

declare global {
  interface HTMLElementTagNameMap {
    'edgeless-connector-handle': EdgelessConnectorHandle;
  }
}
