const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

code = code.replace(/type PrintOptions = \{/,
`type PrintOptions = { pageSettings?: { title?: string, description?: string }[];`);

fs.writeFileSync('utils/print.tsx', code);
