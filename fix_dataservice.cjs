const fs = require('fs');
let code = fs.readFileSync('services/dataService.ts', 'utf8');

code = code.replace(/    if \(type === 'exit' && newInvoice\.driverName\?\.trim\(\)\) \{\n        addDriver\(newInvoice\.driverName\);\n    \}/g,
`    if (newInvoice.driverName?.trim()) {
        addDriver(newInvoice.driverName);
    }
    if (type === 'entry' && newInvoice.origin?.trim()) {
        addOrigin(newInvoice.origin);
    }`);

code = code.replace(/        if \(type === 'exit' && updated\.driverName\?\.trim\(\)\) addDriver\(updated\.driverName\);/g,
`        if (updated.driverName?.trim()) addDriver(updated.driverName);
        if (type === 'entry' && updated.origin?.trim()) addOrigin(updated.origin);`);

fs.writeFileSync('services/dataService.ts', code);
