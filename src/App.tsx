import { lazy, Suspense, useCallback, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AppShell } from './layout/AppShell';
import { LandingPage } from './pages/LandingPage';
import { LoadingState } from './components/LoadingState';
import type { PageId } from './types';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const CalibrationPage = lazy(() => import('./pages/CalibrationPage').then((module) => ({ default: module.CalibrationPage })));
const CalibrationBenchmarkPage = lazy(() => import('./pages/CalibrationBenchmarkPage').then((module) => ({ default: module.CalibrationBenchmarkPage })));
const ImageWorkspacePage = lazy(() => import('./pages/ImageWorkspacePage').then((module) => ({ default: module.ImageWorkspacePage })));
const KineticsPage = lazy(() => import('./pages/KineticsPage').then((module) => ({ default: module.KineticsPage })));
const WorkflowPage = lazy(() => import('./pages/WorkflowPage').then((module) => ({ default: module.WorkflowPage })));
const SessionsPage = lazy(() => import('./pages/SessionsPage').then((module) => ({ default: module.SessionsPage })));

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Root component: owns the current page (state-based navigation, no router
 * dependency needed for Milestone 1) and animates page transitions.
 */
export default function App() {
    const reduceMotion = useReducedMotion();
    const [page, setPage] = useState<PageId>('landing');

    const navigate = useCallback((next: PageId) => {
        setPage(next);
        window.scrollTo({ top: 0, behavior: 'auto' });
    }, []);

    return (
        <AppShell page={page} onNavigate={navigate}>
            <AnimatePresence mode="wait">
                <motion.div
                    key={page}
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.35, ease: EASE }}
                >
                    <Suspense fallback={<LoadingState variant="chart" label={`Loading ${page === 'kinetics' ? 'kinetic analysis' : page === 'workspace' ? 'image workspace' : page === 'sessions' ? 'saved sessions' : page}…`} />}>
                        {page === 'landing' ? <LandingPage onNavigate={navigate} /> : null}
                        {page === 'dashboard' ? <DashboardPage onNavigate={navigate} /> : null}
                        {page === 'workspace' ? <ImageWorkspacePage /> : null}
                        {page === 'calibration' ? <CalibrationPage /> : null}
                        {page === 'calibration-benchmark' ? <CalibrationBenchmarkPage /> : null}
                        {page === 'kinetics' ? <KineticsPage /> : null}
                        {page === 'workflow' ? <WorkflowPage /> : null}
                        {page === 'sessions' ? <SessionsPage /> : null}
                    </Suspense>
                </motion.div>
            </AnimatePresence>
        </AppShell>
    );
}
