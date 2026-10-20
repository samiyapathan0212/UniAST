import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { DisclaimerBanner } from '../components/DisclaimerBanner';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import type { PageId } from '../types';

interface AppShellProps {
    page: PageId;
    onNavigate: (page: PageId) => void;
    children: ReactNode;
}

/**
 * Application chrome: disclaimer banner + sticky header + responsive sidebar
 * + scrollable main region. Page content is passed in as children.
 */
export function AppShell({ page, onNavigate, children }: AppShellProps) {
    const [menuOpen, setMenuOpen] = useState(false);

    // Close the mobile drawer whenever navigation happens.
    useEffect(() => {
        setMenuOpen(false);
    }, [page]);

    return (
        <div className="relative z-10 min-h-screen">
            <DisclaimerBanner />
            <Header
                menuOpen={menuOpen}
                onToggleMenu={() => setMenuOpen((open) => !open)}
            />

            <div className="flex min-h-[calc(100vh-72px)] flex-col lg:flex-row">
                <Sidebar page={page} onNavigate={onNavigate} open={menuOpen} />
                <main className="mx-auto min-w-0 w-full max-w-[1440px] flex-1 px-6 py-9 max-md:px-5 max-md:py-6">
                    {children}
                </main>
            </div>

            <footer className="relative z-10 border-t border-line bg-[rgba(4,8,18,0.9)] px-9 py-6 text-center text-[12.5px] text-txt-muted max-md:px-5">
                UniAST research prototype. Dashboard figures and simulated previews
                use demo data; uploaded-image and CSV outputs are research measurements,
                not clinically validated results.
            </footer>
        </div>
    );
}
