const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

code = code.replace(/                            \)\n                        \)\)}/, `                            )
                        )}`);

fs.writeFileSync('utils/print.tsx', code);
