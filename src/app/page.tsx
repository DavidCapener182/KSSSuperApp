export default function Home() {
  return (
    <main className="shell">
      <header className="shell-header" aria-label="KSS Enterprise Platform">
        <div className="identity">
          <span className="identity-mark" aria-hidden="true">K</span>
          <span className="identity-name">KSS <span>Enterprise Platform</span></span>
        </div>
        <span className="phase-label">Foundation · Phase 01</span>
      </header>

      <section className="welcome" aria-labelledby="welcome-title">
        <div className="eyebrow">A connected workspace for KSS</div>
        <h1 id="welcome-title">One place to build from.</h1>
        <p className="lead">The KSS Enterprise Platform foundation is running. This first step establishes a clean, responsive application shell for the work ahead.</p>
        <div className="notice" role="status">
          <span className="notice-dot" aria-hidden="true" />
          <div><strong>Development foundation only</strong><p>Operational and business data is not connected yet. Sign-in, permissions, records and integrations will be added in separately approved tasks.</p></div>
        </div>
      </section>

      <footer className="shell-footer"><span>KSS Enterprise Platform</span><span>Foundation workspace</span></footer>
    </main>
  );
}
