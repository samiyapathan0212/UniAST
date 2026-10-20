import { Badge } from '../Badge';
import { EmptyState } from '../EmptyState';
import { LoadingState } from '../LoadingState';
import type { RoiRect, RoiStatistics } from '../../types';
import { MAX_SAMPLE_PIXELS } from '../../utils/roiStatistics';

interface RoiStatisticsProps {
    roi: RoiRect | null;
    stats: RoiStatistics | null;
    busy: boolean;
}

function format(value: number, digits = 1): string {
    return value.toFixed(digits);
}

/** ROI metric readout + calculation notes and measurement caveats. */
export function RoiStatistics({ roi, stats, busy }: RoiStatisticsProps) {
    if (!roi) {
        return (
            <EmptyState
                title="No region selected"
                description="Drag on the preview to select a rectangular region of interest, use the coordinate fields for exact pixels, or press “Full image” to measure the entire frame."
            />
        );
    }

    if (busy) {
        return (
            <LoadingState variant="list" count={2} label="Computing ROI statistics…" />
        );
    }

    if (!stats) {
        return (
            <EmptyState
                title="Region could not be measured"
                description="The selected region was outside the image bounds or the canvas could not be read. Redraw the selection to try again."
            />
        );
    }

    const metrics: Array<{ label: string; value: string; unit?: string }> = [
        { label: 'Mean R', value: format(stats.meanR), unit: '0–255' },
        { label: 'Mean G', value: format(stats.meanG), unit: '0–255' },
        { label: 'Mean B', value: format(stats.meanB), unit: '0–255' },
        { label: 'Mean luminance Y', value: format(stats.meanLuminance), unit: '0–255' },
        {
            label: 'Luminance σ (n−1)',
            value: format(stats.luminanceStdDev, 2),
            unit: '0–255',
        },
        {
            label: 'Luminance min → max',
            value: `${format(stats.minLuminance, 0)} → ${format(stats.maxLuminance, 0)}`,
        },
    ];

    return (
        <div className="@container flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <Badge tone="cyan">IMAGE-DERIVED</Badge>
                <span className="mono text-[11.5px] text-txt-muted">
                    ROI {roi.width}×{roi.height} px at ({roi.x}, {roi.y}) ·{' '}
                    {stats.samples.toLocaleString()} samples
                    {stats.resampled ? ' · resampled' : ''}
                </span>
            </div>

            <dl className="grid grid-cols-2 gap-3 @md:grid-cols-3">
                {metrics.map((metric) => (
                    <div
                        key={metric.label}
                        className="min-w-0 rounded-lg border border-line bg-[rgba(255,255,255,0.025)] px-4 py-3"
                    >
                        <dt className="mono break-words text-[10.5px] uppercase leading-snug tracking-[0.55px] text-txt-muted">
                            {metric.label}
                        </dt>
                        <dd className="mono mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-[24px] font-bold leading-tight text-cyan">
                            <span className="whitespace-nowrap">{metric.value}</span>
                            {metric.unit ? (
                                <span className="whitespace-nowrap text-[11px] font-normal text-txt-muted">
                                    {metric.unit}
                                </span>
                            ) : null}
                        </dd>
                    </div>
                ))}
            </dl>

            <div className="rounded-lg border-l-4 border-cyan border-y border-r border-line bg-[rgba(10,24,48,0.85)] px-4 py-3">
                <p className="mb-1.5 text-[13.5px] font-bold text-white">
                    How these numbers are calculated
                </p>
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[12.5px] leading-relaxed text-txt-2">
                    <li>
                        <span className="mono text-cyan">Mean RGB</span> — arithmetic mean
                        of the 8-bit R, G and B channel values of every sampled pixel
                        strictly inside the selected rectangle.
                    </li>
                    <li>
                        <span className="mono text-cyan">Luminance Y</span> — per pixel{' '}
                        <span className="mono">Y = 0.2126·R + 0.7152·G + 0.0722·B</span>{' '}
                        (ITU-R BT.709 weights on 8-bit sRGB values, 0–255); the panel shows
                        the mean of those values.
                    </li>
                    <li>
                        <span className="mono text-cyan">Dispersion σ</span> — sample
                        standard deviation of the per-pixel luminance values (divisor
                        n−1); a larger σ means a more uneven region.
                    </li>
                    <li>
                        <span className="mono text-cyan">Sampling</span> — exact 1:1 pixel
                        reads for regions up to {MAX_SAMPLE_PIXELS.toLocaleString()} px²;
                        larger regions are resampled (canvas downscale) to the same budget
                        so the interface stays responsive. Sample counts are reported
                        above.
                    </li>
                </ul>
            </div>

            <div className="rounded-lg border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.07)] px-4 py-3">
                <p className="mb-1 text-[13px] font-bold text-[#fde68a]">
                    Measurement caveats
                </p>
                <p className="text-[12.5px] leading-relaxed text-[#cbd5e1]">
                    These are <strong>image-derived optical measurements only</strong>.
                    Ambient illumination, white-balance and tone mapping, sensor noise,
                    JPEG/WebP compression, glare, focus and framing all change the result.
                    Nothing here identifies bacteria, determines antimicrobial
                    susceptibility or resistance, or predicts any clinical endpoint.
                </p>
            </div>
        </div>
    );
}