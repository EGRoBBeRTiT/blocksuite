import type { ExtensionType } from '@blocksuite/block-std';

import { EdgelessSurfaceBlockSpec } from '@blocksuite/affine-block-surface';

import { EdgelessTextBlockSpec } from '../../edgeless-text-block/edgeless-text-spec.js';
import { FrameBlockSpec } from '../../frame-block/frame-spec.js';
import {
  EdgelessRootBlockSpec,
  PreviewEdgelessRootBlockSpec,
} from '../../root-block/edgeless/edgeless-root-spec.js';
import { EdgelessSurfaceRefBlockSpec } from '../../surface-ref-block/surface-ref-spec.js';
import { EdgelessFirstPartyBlockSpecs } from '../common.js';

export const EdgelessEditorBlockSpecs: ExtensionType[] = [
  EdgelessRootBlockSpec,
  ...EdgelessFirstPartyBlockSpecs,
  EdgelessSurfaceBlockSpec,
  EdgelessSurfaceRefBlockSpec,
  FrameBlockSpec,
  EdgelessTextBlockSpec,
].flat();

export const PreviewEdgelessEditorBlockSpecs: ExtensionType[] = [
  PreviewEdgelessRootBlockSpec,
  ...EdgelessFirstPartyBlockSpecs,
  EdgelessSurfaceBlockSpec,
  EdgelessSurfaceRefBlockSpec,
  FrameBlockSpec,
  EdgelessTextBlockSpec,
].flat();