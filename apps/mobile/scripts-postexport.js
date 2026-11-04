// Runs after `expo export -p web`: force the brand favicon (Expo's generated
// favicon.ico can be stale/cached) by linking the PNG with a cache-busting query.
const fs = require('fs');
const f = 'dist/index.html';
let h = fs.readFileSync(f, 'utf8');
const v = Date.now();
h = h.replace(/<link rel="icon"[^>]*>/, '');
h = h.replace('</head>', `<link rel="icon" type="image/png" href="/favicon.png?v=${v}"/><link rel="apple-touch-icon" href="/favicon.png?v=${v}"/></head>`);
fs.writeFileSync(f, h);
