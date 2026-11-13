// ============================================================================
// Anki Studio — Frontend Unit Suite (entry point)
//
// Bundled by tests/frontend/run.mjs with the esbuild copy from
// frontend/node_modules, then executed on Node. Each spec registers its own
// `section` / `test` blocks at import time; `report()` prints the verdict and
// sets a non-zero exit code when anything fails.
//
// Scope: pure logic modules + leaf component render smoke tests. Interactive
// component behaviour still needs a real browser (tests/scenarios + manual runs
// against the built bundle); see tests/frontend/README.md.
// ============================================================================

import './specs/themeTokens.spec';
import './specs/deckPalette.spec';
import './specs/mediaUrl.spec';
import './specs/translations.spec';
import './specs/render.spec';
import './specs/mathRenderer.spec';
import './specs/ioRects.spec';
import './specs/nativeOcclusion.spec';
import './specs/occlusionPreview.spec';
import './specs/imageOcclusionPolicy.spec';
import './specs/editorTable.spec';
import './specs/domTarget.spec';

import { report } from './harness';

report('Anki Studio Frontend Unit Suite');
