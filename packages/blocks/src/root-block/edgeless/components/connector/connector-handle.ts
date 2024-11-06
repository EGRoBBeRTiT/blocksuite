import type { GfxModel } from '@blocksuite/block-std/gfx';

import {
  ConnectorPathGenerator,
  rBound,
} from '@blocksuite/affine-block-surface';
import {
  type ConnectorElementModel,
  ConnectorMode,
} from '@blocksuite/affine-model';
import {
  Bound,
  debounce,
  DisposableGroup,
  getBoundsWithRotation,
  Vec,
  WithDisposable,
} from '@blocksuite/global/utils';
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

  private _disposeEvents = debounce(() => {
    if (!this._isMoving) {
      this._disposables.dispose();
      this._disposables = new DisposableGroup();
      this._bindEvent();
    }
  }, 200);

  private _isMoving = false;

  private _lastZoom = 1;

  private _bindEvent() {
    const { edgeless, connector } = this;

    this._disposables.add(
      edgeless.service.surface.elementUpdated.on(({ id }) => {
        if (id === connector.id) {
          this.requestUpdate();
          this._disposeEvents();
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
  }

  private _capPointerDown(e: PointerEvent, connection: 'target' | 'source') {
    const { edgeless, connector, _disposables } = this;
    const { service } = edgeless;
    this._isMoving = true;

    connector.stashRapidlyFields();

    e.stopPropagation();
    _disposables.addFromEvent(document, 'pointermove', e => {
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
    });

    _disposables.addFromEvent(document, 'pointerup', () => {
      this._isMoving = false;
      service.doc.transact(() => {
        connector.popRapidlyFields();
      });
      this._disposePointerup();
    });
  }

  private _closedAnchorPointerDown(e: PointerEvent, target: Element) {
    const { edgeless, connector, _disposables } = this;
    const { service } = edgeless;
    e.stopPropagation();
    this._isMoving = true;

    connector.stash('xywh');
    connector.stash('labelXYWH');
    connector.stash('serializedPath');

    let movingAnchor: Element | null | undefined = target?.classList.contains(
      'available'
    )
      ? target
      : undefined;
    let movingAnchorSelector: string | undefined = undefined;
    let movingIndex = Number.NaN;

    const elementGetter = (id: string) =>
      edgeless.surfaceBlockModel.getElementById(id) ??
      (edgeless.surfaceBlockModel.doc.getBlockById(id) as GfxModel);

    _disposables.addFromEvent(document, 'pointermove', e => {
      const point = service.viewport.toModelCoordFromClientCoord([e.x, e.y]);

      if (movingAnchor) {
        const anchorElement = movingAnchor;

        const index = Number(anchorElement?.getAttribute('data-point-id'));

        service.doc.transact(() => {
          movingIndex = ConnectorPathGenerator.movePoint(
            connector,
            elementGetter,
            index,
            point
          );
        });

        return;
      }

      if (movingAnchorSelector && !movingAnchor) {
        movingAnchor = this.renderRoot.querySelector(movingAnchorSelector);

        return;
      }

      if (
        movingAnchor === undefined &&
        (target?.classList.contains('unavailable') ||
          target?.classList.contains('freezed'))
      ) {
        const index = Number(target?.getAttribute('data-point-id'));

        if (connector.mode === ConnectorMode.Orthogonal) {
          const index = isNaN(movingIndex)
            ? Number(target?.getAttribute('data-point-id'))
            : movingIndex;

          service.doc.transact(() => {
            movingIndex = ConnectorPathGenerator.movePoint(
              connector,
              elementGetter,
              index,
              point
            );
          });
        } else {
          ConnectorPathGenerator.addPointIntoPath(
            connector,
            index + 1,
            elementGetter
          );

          movingAnchorSelector = `.line-anchor.available[data-point-id="${index + 1}"]`;

          movingAnchor = this.renderRoot.querySelector(movingAnchorSelector);
        }
      }
    });

    _disposables.addFromEvent(document, 'pointerup', () => {
      movingAnchor = undefined;
      movingAnchorSelector = undefined;
      movingIndex = Number.NaN;
      this._isMoving = false;
      service.doc.transact(() => {
        ConnectorPathGenerator.removeExtraPoints(connector);
        connector.pop('xywh');
        connector.pop('labelXYWH');
        connector.pop('serializedPath');
      });
      this._disposePointerup();
    });
  }

  private _disposePointerup() {
    const { edgeless, _disposables } = this;

    edgeless.service.overlays.connector.clear();
    edgeless.doc.captureSync();
    _disposables.dispose();
    this._disposables = new DisposableGroup();
    this._bindEvent();
    edgeless.slots.elementResizeEnd.emit();
  }

  private _getClosedAnchorPointStyles() {
    const { path, mode } = this.connector;
    const { service } = this.edgeless;
    const { zoom } = service.viewport;

    return path.reduce<StyleInfo[]>((acc, point, index) => {
      if (index === 0 || index === path.length - 1) {
        return acc;
      }

      const domPoint = Vec.subScalar(Vec.mul(point, zoom), HALF_SIZE);

      const styles: StyleInfo = {
        transform: `translate3d(${domPoint[0]}px,${domPoint[1]}px,0)`,
        display: '',
      };

      if (this._isMoving || mode === ConnectorMode.Orthogonal) {
        styles.display = 'none';
      }

      acc.push(styles);

      return acc;
    }, []);
  }

  private _getMiddlePointStyles() {
    const { path, mode, source, target, absolutePath } = this.connector;
    const { service } = this.edgeless;
    const { zoom } = service.viewport;

    const isOrthogonal = mode === ConnectorMode.Orthogonal;

    const start = source.id ? service.getElementById(source.id) : null;
    const end = target.id ? service.getElementById(target.id) : null;

    const startBound = start
      ? Bound.from(getBoundsWithRotation(rBound(start)))
      : null;
    const endBound = end
      ? Bound.from(getBoundsWithRotation(rBound(end)))
      : null;

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

        if (this._isMoving) {
          styles.display = 'none';
        } else if (isOrthogonal) {
          const isEdge = index === 1 || index === path.length - 1;
          if (isEdge) {
            const pointIndex = index === 1 ? index : index - 1;
            const bound = index === 1 ? startBound : endBound;
            const startEndPoint =
              index === 1
                ? absolutePath[0]
                : absolutePath[absolutePath.length - 1];
            const absolutePoint = absolutePath[pointIndex];

            const {
              minX = startEndPoint[0],
              minY = startEndPoint[1],
              maxX = startEndPoint[0],
              maxY = startEndPoint[1],
            } = bound ?? {};

            const distToLeft = Math.abs(startEndPoint[0] - minX);
            const distToRight = Math.abs(startEndPoint[0] - maxX);
            const distToTop = Math.abs(startEndPoint[1] - minY);
            const distToBottom = Math.abs(startEndPoint[1] - maxY);
            const minDist =
              Math.min(distToLeft, distToRight, distToTop, distToBottom) +
              40.02;
            if (Vec.dist(absolutePoint, startEndPoint) <= minDist) {
              styles.display = 'none';
            }
          }
          if (Vec.dist(path[index], path[index - 1]) <= 20) {
            styles.display = 'none';
          }
        }

        acc.push(styles);
      }

      return acc;
    }, []);
  }

  override firstUpdated() {
    const { edgeless } = this;
    const { viewport } = edgeless.service;

    this._lastZoom = viewport.zoom;
    edgeless.service.viewport.viewportUpdated.on(() => {
      if (viewport.zoom !== this._lastZoom) {
        this._lastZoom = viewport.zoom;
        this.requestUpdate();
      }
    });

    this._bindEvent();
  }

  override render() {
    const { service } = this.edgeless;
    // path is relative to the element's xywh
    const { path } = this.connector;
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
      ${closedAnchorPointStyles.map(
        (style, index) =>
          html`<div
            style=${styleMap(style)}
            class="line-anchor available"
            data-point-id=${index + 1}
          ></div>`
      )}
      ${middlePointStyles.map((style, index) => {
        const [beforeFreezedX, beforeFreezedY] =
          this.connector.absolutePath[index].freezedAxises;
        const [afterFreezedX, afterFreezedY] =
          this.connector.absolutePath[index + 1].freezedAxises;

        const isLineFreezed =
          this.connector.mode === ConnectorMode.Orthogonal &&
          ((beforeFreezedX && afterFreezedX) ||
            (beforeFreezedY && afterFreezedY));

        if (style.display === 'none') {
          return nothing;
        }

        return html`<div
          style=${styleMap(style)}
          class="line-anchor ${isLineFreezed ? 'freezed' : 'unavailable'}"
          data-point-id=${index}
        ></div>`;
      })}
      <div class="line-controller line-end" style=${styleMap(endStyle)}></div>
    `;
  }

  @queryAll('.line-anchor')
  private accessor _anchorHandlers!: NodeList;

  @query('.line-end')
  private accessor _endHandler!: HTMLDivElement;

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
