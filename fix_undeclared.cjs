const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

const jsxRegex = /                            \{generalDescription && \([\s\S]*?                            \}\)\n/g;
code = code.replace(jsxRegex, ``);

fs.writeFileSync('utils/print.tsx', code);
