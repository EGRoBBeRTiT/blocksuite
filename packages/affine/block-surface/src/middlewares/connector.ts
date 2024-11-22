import type { ConnectorElementModel } from '@blocksuite/affine-model';
import type { GfxModel } from '@blocksuite/block-std/gfx';

import type { SurfaceBlockModel, SurfaceMiddleware } from '../surface-model.js';

import { ConnectorPathGenerator } from '../managers/connector-manager.js';

export const connectorMiddleware: SurfaceMiddleware = (
  surface: SurfaceBlockModel
) => {
  const hasElementById = (id: string) =>
    surface.hasElementById(id) || surface.doc.hasBlockById(id);
  const elementGetter = (id: string) =>
    surface.getElementById(id) ?? (surface.doc.getBlockById(id) as GfxModel);

  const shouldUpdateConnectorPath = (connector: ConnectorElementModel) =>
    ((connector.source?.id && hasElementById(connector.source.id)) ||
      (!connector.source?.id && connector.source?.position)) &&
    ((connector.target?.id && hasElementById(connector.target.id)) ||
      (!connector.target?.id && connector.target?.position));

  const updateConnectorPathEnds = (connector: ConnectorElementModel) => {
    if (shouldUpdateConnectorPath(connector)) {
      ConnectorPathGenerator.updatePathEnds(connector, elementGetter);
    }
  };

  const pendingList = new Set<ConnectorElementModel>();
  let pendingFlag = false;
  const addToUpdateList = (connector: ConnectorElementModel) => {
    pendingList.add(connector);

    if (!pendingFlag) {
      pendingFlag = true;
      queueMicrotask(() => {
        pendingList.forEach(updateConnectorPathEnds);
        pendingList.clear();
        pendingFlag = false;
      });
    }
  };

  const disposables = [
    surface.elementAdded.on(({ id }) => {
      const element = elementGetter(id);

      if (!element) return;

      if ('type' in element && element.type === 'connector') {
        const connector = element as ConnectorElementModel;
        if (connector.localUpdating) {
          addToUpdateList(connector);
        }
      } else {
        surface.getConnectors(id).forEach(addToUpdateList);
      }
    }),
    surface.elementUpdated.on(({ id, props }) => {
      const element = elementGetter(id);

      const isConnector = 'type' in element && element.type === 'connector';

      if (!isConnector) {
        if (props['rotate']) {
          surface.getConnectors(id).forEach(addToUpdateList);
        }
        if (props['xywh']) {
          surface.getConnectors(id).forEach(el => {
            if (!el.moving) {
              addToUpdateList(el);
            }
          });
        }
      }

      if (isConnector) {
        const connector = element as ConnectorElementModel;

        if (props['source'] || props['target'] || props['mode'] !== undefined) {
          if (connector.localUpdating) {
            addToUpdateList(connector);
            connector.localUpdating = false;
          }
        }
      }
    }),
    surface.doc.slots.blockUpdated.on(payload => {
      if (
        payload.type === 'add' ||
        (payload.type === 'update' && payload.props.key === 'xywh')
      ) {
        surface.getConnectors(payload.id).forEach(addToUpdateList);
      }
    }),
  ];

  surface
    .getElementsByType('connector')
    .forEach(connector =>
      updateConnectorPathEnds(connector as ConnectorElementModel)
    );

  return () => {
    disposables.forEach(d => d.dispose());
  };
};
