const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

code = code.replace(
    /const printTitle = type === 'entry' \? settings\.entryPrintTitle : settings\.exitPrintTitle;/,
    "const printTitle = options?.customPrintTitle || (type === 'entry' ? settings.entryPrintTitle : settings.exitPrintTitle);"
);

code = code.replace(
    /const generalDescription = options\?\.generalDescription;/g, 
    "const generalDescription = options?.generalDescription;"
);

// We need to render the totals properly based on options.showPageTotals and options.showGrandTotal.
// Let's find the totals rendering section.
