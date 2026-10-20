/**
 * Kinetic Analysis workspace — image-sequence and CSV inputs, shared-ROI
 * processing, descriptive optical time-series review, and CSV export.
 */
import { useState } from 'react';
import { Button } from '../components/Button';
import { ImageCanvas } from '../components/image-workspace/ImageCanvas';
import type { RoiRect } from '../types';

/* @@K1@@ */
export function KineticPage() {
    const [roi] = useState<RoiRect | null>(null);
    return (
        <div>
            <p>Kinetic analysis workspace — under construction.</p>
            <p className="mono text-[11px] text-txt-muted">
                ROI: {roi ? `${roi.width}x${roi.height}` : 'none'}
            </p>
            <ImageCanvas
                objectUrl=""
                imageRef={{ current: null }}
                naturalWidth={0}
                naturalHeight={0}
                roi={roi}
                onRoiChange={() => undefined}
                onClearRoi={() => undefined}
                onResetRoi={() => undefined}
            />
            <Button variant="secondary" size="sm">
                Placeholder
            </Button>
        </div>
    );
}
/* @@KREST@@ */
