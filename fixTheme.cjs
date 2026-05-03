const fs = require('fs');
const files = [
  'components/ChatRoom.tsx',
  'components/Chat/ChatInput.tsx',
  'components/SavedItemsView.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Backgrounds
  content = content.replace(/bg-gray-900\/80/g, 'bg-surface-main/80');
  content = content.replace(/bg-gray-900\/20/g, 'bg-surface-main/20');
  content = content.replace(/bg-gray-900/g, 'bg-surface-main');
  
  content = content.replace(/bg-gray-800\/80/g, 'bg-surface-card/80');
  content = content.replace(/bg-gray-800\/60/g, 'bg-surface-card/60');
  content = content.replace(/bg-gray-800\/50/g, 'bg-surface-card/50');
  content = content.replace(/bg-gray-800/g, 'bg-surface-card');

  content = content.replace(/bg-gray-700\/80/g, 'bg-surface-hover/80');
  content = content.replace(/bg-gray-700\/50/g, 'bg-surface-hover/50');
  content = content.replace(/bg-gray-700/g, 'bg-surface-hover');
  
  // Borders
  content = content.replace(/border-gray-800\/80/g, 'border-theme-border/80');
  content = content.replace(/border-gray-800/g, 'border-theme-border');
  content = content.replace(/border-gray-700\/80/g, 'border-theme-border/80');
  content = content.replace(/border-gray-700\/50/g, 'border-theme-border/50');
  content = content.replace(/border-gray-700/g, 'border-theme-border');

  // Text
  content = content.replace(/text-gray-100/g, 'text-theme-text');
  content = content.replace(/text-gray-200/g, 'text-theme-text');
  content = content.replace(/text-gray-300/g, 'text-theme-text');
  content = content.replace(/text-gray-400/g, 'text-theme-muted');
  content = content.replace(/text-gray-500/g, 'text-theme-muted');
  content = content.replace(/text-gray-600/g, 'text-theme-muted');
  
  // Ring/Focus
  content = content.replace(/ring-gray-700/g, 'ring-theme-border');
  content = content.replace(/placeholder-gray-500/g, 'placeholder-theme-muted');

  fs.writeFileSync(file, content);
});

console.log('Done!');
