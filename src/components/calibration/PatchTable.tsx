import { EmptyState } from '../EmptyState';
import type { CalibrationPatch } from '../../types';

interface PatchTableProps {
    patches: CalibrationPatch[];
    compareId: string | null;
    onCompare: (id: string) => void;
    onUpdate: (
        id: string,
        update: Partial<Pick<CalibrationPatch, 'reference' | 'standard' | 'role'>>,
    ) => void;
    onRemove: (id: string) => void;
}

const numberCellClass =
    'field-input mono w-[62px] px-2 py-1.5 text-[12.5px]';

/** Reference/standard entry table for calibration patches. */
export function PatchTable({
    patches,
    compareId,
    onCompare,
    onUpdate,
    onRemove,
}: PatchTableProps) {
    if (patches.length === 0) {
        return (
            <EmptyState
                title="No reference patches yet"
                description="Drag rectangles onto the image above to add patches that sit on a physical reference standard (for example a printed colour chart). Each patch needs its known reference RGB and a description of the standard it represents."
            />
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[860px] text-left text-[13px]">
                <thead>
                    <tr className="bg-[rgba(16,32,60,0.7)]">
                        {['Patch', 'Measured RGB', 'Reference RGB', 'Standard', 'Role', 'Actions'].map(
                            (column) => (
                                <th
                                    key={column}
                                    className="mono border-b border-line px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.5px] text-txt-2"
                                >
                                    {column}
                                </th>
                            ),
                        )}
                    </tr>
                </thead>
                <tbody>
                    {patches.map((patch, index) => (
                        <PatchRow
                            key={patch.id}
                            patch={patch}
                            index={index}
                            compareId={compareId}
                            onCompare={onCompare}
                            onUpdate={onUpdate}
                            onRemove={onRemove}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const CELL = 'border-b border-[rgba(255,255,255,0.04)] px-4 py-3';

interface PatchRowProps {
    patch: CalibrationPatch;
    index: number;
    compareId: string | null;
    onCompare: (id: string) => void;
    onUpdate: (
        id: string,
        update: Partial<Pick<CalibrationPatch, 'reference' | 'standard' | 'role'>>,
    ) => void;
    onRemove: (id: string) => void;
}

/** One editable patch row: measured values, reference entry, role, actions. */
function PatchRow({
    patch,
    index,
    compareId,
    onCompare,
    onUpdate,
    onRemove,
}: PatchRowProps) {
    const refMissing =
        patch.reference.r === null ||
        patch.reference.g === null ||
        patch.reference.b === null;
    const standardMissing = patch.standard.trim().length === 0;
    const ready = !refMissing && !standardMissing;

    const setChannel = (channel: 'r' | 'g' | 'b', raw: string) => {
        const parsed = Number.parseFloat(raw);
        const value = Number.isNaN(parsed) ? null : parsed;
        onUpdate(patch.id, { reference: { ...patch.reference, [channel]: value } });
    };

    return (
        <tr className="align-top transition-colors hover:bg-[rgba(0,242,254,0.03)]">
            <td className={CELL}>
                <span
                    className={`mono text-[12.5px] font-bold ${
                        patch.role === 'validation' ? 'text-violet' : 'text-cyan'
                    }`}
                >
                    P{index + 1}
                </span>
                <span className="mono mt-0.5 block text-[11px] text-txt-muted">
                    {patch.rect.width}×{patch.rect.height} @ ({patch.rect.x}, {patch.rect.y})
                </span>
                <span className={`badge mt-1.5 ${ready ? 'badge-pass' : 'badge-pending'}`}>
                    {ready ? 'ready' : refMissing ? 'needs reference' : 'needs standard'}
                </span>
            </td>

            <td className={`mono text-[12.5px] text-txt-muted ${CELL}`}>
                <span className="block text-txt">R {patch.measured.meanR.toFixed(1)}</span>
                <span className="block text-txt">G {patch.measured.meanG.toFixed(1)}</span>
                <span className="block text-txt">B {patch.measured.meanB.toFixed(1)}</span>
            </td>

            <td className={CELL}>
                <div className="flex items-center gap-1.5">
                    {(['r', 'g', 'b'] as const).map((channel) => (
                        <label key={channel} className="flex flex-col gap-1">
                            <span className="mono text-[9.5px] uppercase text-txt-muted">
                                {channel}
                            </span>
                            <input
                                type="number"
                                min={0}
                                max={255}
                                step="0.1"
                                className={numberCellClass}
                                aria-label={`Patch ${index + 1} reference ${channel.toUpperCase()} (0–255)`}
                                value={patch.reference[channel] ?? ''}
                                onChange={(event) => setChannel(channel, event.target.value)}
                            />
                        </label>
                    ))}
                </div>
            </td>

            <td className={CELL}>
                <input
                    type="text"
                    className="field-input mono min-w-[190px] px-2.5 py-1.5 text-[12px]"
                    aria-label={`Patch ${index + 1} standard description`}
                    placeholder="e.g. colour chart patch — white"
                    value={patch.standard}
                    onChange={(event) => onUpdate(patch.id, { standard: event.target.value })}
                />
            </td>

            <td className={CELL}>
                <select
                    className="field-input mono min-w-[150px] px-2 py-1.5 text-[12px]"
                    aria-label={`Patch ${index + 1} role`}
                    value={patch.role}
                    onChange={(event) =>
                        onUpdate(patch.id, {
                            role: event.target.value as CalibrationPatch['role'],
                        })
                    }
                >
                    <option value="fit">Calibration fit</option>
                    <option value="validation">Held-out validation</option>
                </select>
            </td>

            <td className={CELL}>
                <div className="flex gap-2">
                    <button
                        type="button"
                        aria-pressed={compareId === patch.id}
                        onClick={() => onCompare(patch.id)}
                        className={`mono rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                            compareId === patch.id
                                ? 'border-[rgba(0,242,254,0.5)] bg-[rgba(0,242,254,0.12)] text-cyan'
                                : 'border-line text-txt-muted hover:text-txt-2'
                        }`}
                    >
                        Compare
                    </button>
                    <button
                        type="button"
                        aria-label={`Remove patch ${index + 1}`}
                        onClick={() => onRemove(patch.id)}
                        className="mono rounded-lg border border-[rgba(239,68,68,0.35)] px-2.5 py-1.5 text-[11px] font-semibold text-[#fca5a5] transition-colors hover:bg-[rgba(239,68,68,0.15)]"
                    >
                        Remove
                    </button>
                </div>
            </td>
        </tr>
    );
}
