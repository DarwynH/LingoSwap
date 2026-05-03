const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

// Replace dark mode classes in App.tsx
content = content.replace(/bg-gray-900/g, 'bg-surface-main');
content = content.replace(/border-gray-700\/50/g, 'border-theme-border/50');
content = content.replace(/border-gray-700/g, 'border-theme-border');
content = content.replace(/border-gray-900/g, 'border-surface-main');
content = content.replace(/text-gray-100/g, 'text-theme-text');
content = content.replace(/bg-\[#0f172a\]/g, 'bg-surface-main');
content = content.replace(/border-slate-800\/50/g, 'border-theme-border/50');
content = content.replace(/bg-\[#0b1121\]/g, 'bg-surface-main');
content = content.replace(/bg-\[#1e293b\]/g, 'bg-surface-card');
content = content.replace(/border-slate-700\/50/g, 'border-theme-border/50');
content = content.replace(/text-slate-200/g, 'text-theme-text');
content = content.replace(/text-slate-100/g, 'text-theme-text');
content = content.replace(/text-slate-400/g, 'text-theme-muted');
content = content.replace(/text-slate-500/g, 'text-theme-muted');

fs.writeFileSync('App.tsx', content);
console.log('App.tsx theme updated!');
