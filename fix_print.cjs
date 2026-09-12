const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

code = code.replace(/    const printTitle = type === 'entry' \? settings.entryPrintTitle : settings.exitPrintTitle;/g,
`    const pageSetting = options?.pageSettings?.[pageNumber ? pageNumber - 1 : 0];
    const printTitle = pageSetting?.title || options?.customPrintTitle || (type === 'entry' ? settings.entryPrintTitle : settings.exitPrintTitle);
    const generalDescription = pageSetting?.description || options?.generalDescription;`);

fs.writeFileSync('utils/print.tsx', code);
