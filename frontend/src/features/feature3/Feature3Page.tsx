/**
 * Feature 3 — Placeholder Page
 *
 * This is a self-contained feature module. A developer assigned to Feature 3
 * should build their UI components, hooks, and services within this directory:
 *   frontend/src/features/feature3/
 *
 * Backend routes (if needed) go in:
 *   backend/routes/feature3.py
 *
 * This component is mounted by App.tsx when the user selects "Feature 3" in the sidebar.
 */

export function Feature3Page() {
  return (
    <div className="feature-page">
      <div className="feature-placeholder">
        <h2>Feature 3</h2>
        <p className="feature-status">Not yet implemented</p>
        <div className="feature-info">
          <p>This feature is ready for development.</p>
          <ul>
            <li>Frontend: <code>frontend/src/features/feature3/</code></li>
            <li>Backend: <code>backend/routes/feature3.py</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
