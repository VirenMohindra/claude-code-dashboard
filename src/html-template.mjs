// Re-export from assembler — this file is kept for backward compatibility.
// The actual template logic now lives in:
//   - template/dashboard.html  (HTML skeleton with placeholders)
//   - template/dashboard.css   (all styles)
//   - template/dashboard.js    (all client-side behavior)
//   - src/sections.mjs         (section-level renderers)
//   - src/assembler.mjs        (reads templates, builds final HTML)
export { generateDashboardHtml } from "./assembler.mjs";
