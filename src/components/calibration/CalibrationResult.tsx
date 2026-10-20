import { EmptyState } from '../EmptyState';
import type { CalibrationPatch } from '../../types';
import {
    applyCalibration,
    luminance,
    type CalibrationModel,
    type ResidualSummary,
    type Rgb,
} from '../../utils/calibration';

interface CalibrationResultProps {
    model: CalibrationModel;
    fitSummary: ResidualSummary | null;
    validationSummary: ResidualSummary | null;
    validationPatchCount: number;
    comparePatch: CalibrationPatch | null;
}

const CHANNELS: Array<{ key: 'r' | 'g' | 'b'; label: string }> = [
    { key: 'r', label: 'Red' },
    { key: 'g', label: 'Green' },
    { key: 'b', label: 'Blue' },
];

const fmt = (value: number) => value.toFixed(2);

/** Calibration report: method, coefficients, fit vs validation error, compare. */
export function CalibrationResult({
    model,
    fitSummary,
    validationSummary,
    validationPatchCount,
    comparePatch,
}: CalibrationResultProps) {
    const measuredRgb: Rgb | null = comparePatch
        ? {
              r: comparePatch.measured.meanR,
              g: comparePatch.measured.meanG,
              b: comparePatch.measured.meanB,
          }
        : null;
    const compared = measuredRgb ? applyCalibration(model, measuredRgb) : null;
    const measuredLum = measuredRgb ? luminance(measuredRgb) : null;

    return (
        <div className="flex flex-col gap-5">
            {/* --- Method & coefficients ---------------------------------- */}
            <div className="rounded-lg border-l-4 border-cyan border-y border-r border-line bg-[rgba(10,24,48,0.85)] px-4 py-3">
                <p className="mb-1 text-[13.5px] font-bold text-white">
                    Calibration method (deterministic)
                </p>
                <p className="text-[12.5px] leading-relaxed text-txt-2">
                    {model.method} Fitted on{' '}
                    <span className="mono text-cyan">{model.fitPatchCount}</span> reference
                    patch{model.fitPatchCount === 1 ? '' : 'es'} using ordinary least
                    squares per channel. Held-out validation patches never enter the fit.
                </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[520px] text-left text-[12.5px]">
                    <thead>
                        <tr className="bg-[rgba(16,32,60,0.7)]">
                            {['Channel', 'Slope', 'Intercept', 'Points', 'Status'].map(
                                (column) => (
                                    <th
                                        key={column}
                                        className="mono border-b border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.5px] text-txt-2"
                                    >
                                        {column}
                                    </th>
                                ),
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {CHANNELS.map((channel) => {
                            const report = model[channel.key];
                            return (
                                <tr key={channel.key}>
                                    <td className="border-b border-[rgba(255,255,255,0.04)] px-4 py-2.5 font-medium text-txt">
                                        {channel.label}
                                    </td>
                                    <td className="mono border-b border-[rgba(255,255,255,0.04)] px-4 py-2.5 text-cyan">
                                        {report.fit ? fmt(report.fit.slope) : '—'}
                                    </td>
                                    <td className="mono border-b border-[rgba(255,255,255,0.04)] px-4 py-2.5 text-cyan">
                                        {report.fit ? fmt(report.fit.intercept) : '—'}
                                    </td>
                                    <td className="mono border-b border-[rgba(255,255,255,0.04)] px-4 py-2.5 text-txt-muted">
                                        {report.points}
                                    </td>
                                    <td className="border-b border-[rgba(255,255,255,0.04)] px-4 py-2.5">
                                        <span
                                            className={`badge ${
                                                report.status === 'ok'
                                                    ? 'badge-pass'
                                                    : 'badge-alert'
                                            }`}
                                        >
                                            {report.status === 'ok' ? 'fitted' : report.status}
                                        </span>
                                        {report.status !== 'ok' ? (
                                            <span className="mt-1 block text-[11.5px] text-[#fecaca]">
                                                {report.message}
                                            </span>
                                        ) : null}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* --- Fit error (training residuals) -------------------------- */}
            <div className="rounded-lg border border-line bg-[rgba(255,255,255,0.025)] px-4 py-3">
                <p className="mb-2 text-[13.5px] font-bold text-white">
                    Reference-patch fit error (training residuals)
                </p>
                {fitSummary ? (
                    <div className="mono flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-txt-2">
                        <span>
                            RMS <span className="text-cyan">R {fmt(fitSummary.rms.r)}</span>
                        </span>
                        <span className="text-cyan">G {fmt(fitSummary.rms.g)}</span>
                        <span className="text-cyan">B {fmt(fitSummary.rms.b)}</span>
                        <span>
                            max <span className="text-cyan">R {fmt(fitSummary.maxAbs.r)}</span>
                        </span>
                        <span className="text-cyan">G {fmt(fitSummary.maxAbs.g)}</span>
                        <span className="text-cyan">B {fmt(fitSummary.maxAbs.b)}</span>
                        <span>
                            mean |ΔY|{' '}
                            <span className="text-cyan">
                                {fmt(fitSummary.meanLuminanceError ?? 0)}
                            </span>
                        </span>
                        <span className="text-txt-muted">n = {fitSummary.count}</span>
                    </div>
                ) : (
                    <p className="text-[12.5px] text-txt-muted">No fit summary available.</p>
                )}
                <p className="mt-2 text-[12px] leading-relaxed text-[#fde68a]">
                    These residuals are computed on the same patches the model was fitted
                    to — they measure how well the line fits its training points, not how
                    well the calibration generalises.
                </p>
            </div>

            {/* --- Independent validation ---------------------------------- */}
            <div
                className={`rounded-lg border px-4 py-3 ${
                    validationSummary
                        ? 'border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.07)]'
                        : 'border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.07)]'
                }`}
            >
                <p
                    className={`mb-1 text-[13.5px] font-bold ${
                        validationSummary ? 'text-[#d1fae5]' : 'text-[#fde68a]'
                    }`}
                >
                    Independent (held-out) validation error
                </p>
                {validationSummary ? (
                    <>
                        <div className="mono flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-txt-2">
                            <span className="text-txt-muted">
                                {validationPatchCount} held-out patch{validationPatchCount === 1 ? '' : 'es'}
                            </span>
                            <span>
                                RMS{' '}
                                <span className="text-pass">R {fmt(validationSummary.rms.r)}</span>
                            </span>
                            <span className="text-pass">G {fmt(validationSummary.rms.g)}</span>
                            <span className="text-pass">B {fmt(validationSummary.rms.b)}</span>
                            <span>
                                mean |ΔY|{' '}
                                <span className="text-pass">
                                    {fmt(validationSummary.meanLuminanceError ?? 0)}
                                </span>
                            </span>
                            <span className="text-txt-muted">n = {validationSummary.count}</span>
                        </div>
                        <p className="mt-2 text-[12px] leading-relaxed text-[#cbd5e1]">
                            Held-out patches (not used in fitting) measured in the same
                            image under the same lighting. This is genuine independent
                            error for THIS image only — it does not establish accuracy on
                            other images, panels, devices or lighting conditions.
                        </p>
                    </>
                ) : (
                    <p className="text-[12.5px] leading-relaxed text-[#cbd5e1]">
                        No complete held-out validation patches. Without independent
                        validation, only training fit error is available and{' '}
                        <strong>no claim of accuracy improvement can be made</strong>. Set
                        a patch's role to “Held-out validation” and enter its known
                        reference values to measure independent error.
                    </p>
                )}
            </div>

            {/* --- Raw vs corrected --------------------------------------- */}
            <div className="rounded-lg border border-line bg-[rgba(255,255,255,0.025)] px-4 py-3">
                <p className="mb-2 text-[13.5px] font-bold text-white">
                    Raw vs corrected measurement
                </p>
                {compared && measuredRgb && measuredLum !== null && comparePatch ? (
                    <div className="flex flex-col gap-2">
                        <p className="mono text-[11.5px] text-txt-muted">
                            {comparePatch.id} ·{' '}
                            {comparePatch.standard.trim() || 'unnamed standard'}
                        </p>
                        <div className="flex flex-wrap items-baseline gap-2">
                            <span className="mono w-[86px] shrink-0 text-[11px] uppercase tracking-[0.5px] text-txt-muted">
                                Raw
                            </span>
                            <span className="mono text-[15px] font-semibold text-txt">
                                R {fmt(measuredRgb.r)} · G {fmt(measuredRgb.g)} · B{' '}
                                {fmt(measuredRgb.b)} · Y {fmt(measuredLum)}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-baseline gap-2">
                            <span className="mono w-[86px] shrink-0 text-[11px] uppercase tracking-[0.5px] text-txt-muted">
                                Corrected
                            </span>
                            <span className="mono text-[15px] font-semibold text-cyan">
                                R {fmt(compared.corrected.r)} · G {fmt(compared.corrected.g)} · B{' '}
                                {fmt(compared.corrected.b)} · Y {fmt(luminance(compared.corrected))}
                            </span>
                        </div>
                        {compared.clipped ? (
                            <p className="mono text-[11.5px] text-[#fecaca]">
                                Clipped to the 8-bit range on channel(s):{' '}
                                {compared.clippedChannels.map((c) => c.toUpperCase()).join(', ')}{' '}
                                — the linear model predicted values outside [0, 255].
                            </p>
                        ) : null}
                    </div>
                ) : (
                    <EmptyState
                        title="Select a patch to compare"
                        description="Use the “Compare” button on any patch row to see its raw (image-derived) measurement next to the calibrated result."
                    />
                )}
            </div>

            {/* --- Assumptions & limitations ------------------------------- */}
            <div className="rounded-lg border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.07)] px-4 py-3">
                <p className="mb-1 text-[13px] font-bold text-[#fde68a]">
                    Assumptions & limitations
                </p>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-[12.5px] leading-relaxed text-[#cbd5e1]">
                    <li>
                        Ambient illumination, glare and reflections, automatic white
                        balance, tone mapping, in-camera sharpening/denoising, JPEG/WebP
                        compression, sensor noise and focus all change measured values; the
                        affine model absorbs only a linear per-channel gain/offset.
                    </li>
                    <li>
                        Values are assumed to be sRGB; wide-gamut or differently encoded
                        images will bias the fit.
                    </li>
                    <li>
                        A physical reference standard with published values is required —
                        arbitrary image regions are not valid calibration targets.
                    </li>
                    <li>
                        Fitting and evaluating on the same patches is not independent
                        validation; cross-device or cross-session accuracy is untested.
                    </li>
                    <li>
                        Experimental research prototype for image-derived optical
                        measurements only — not a diagnostic tool. Nothing here identifies
                        bacteria, determines antimicrobial susceptibility or resistance, or
                        predicts a clinical endpoint.
                    </li>
                </ul>
            </div>
        </div>
    );
}