const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

const calcTotalsFn = `
export const calculateTotals = (data: Remittance[], type: 'entry' | 'exit'): EntryTotals | ExitTotals => {
    if (type === 'entry') {
        const entryTotals: EntryTotals = { byProduct: new Map(), grandTotal: { count: 0, billWeight: 0, scaleWeight: 0, wastage: 0, transportCost: 0 } };
        for (const item of data) {
            const entry = item as Entry;
            entryTotals.grandTotal.count++;
            entryTotals.grandTotal.billWeight += Number(entry.billWeight) || 0;
            entryTotals.grandTotal.scaleWeight += Number(entry.scaleWeight) || 0;
            entryTotals.grandTotal.transportCost += Number(entry.transportCost) || 0;
            if (!entryTotals.byProduct.has(entry.productId)) entryTotals.byProduct.set(entry.productId, { count: 0, billWeight: 0, scaleWeight: 0, transportCost: 0 });
            const pt = entryTotals.byProduct.get(entry.productId)!;
            pt.count++; pt.billWeight += Number(entry.billWeight) || 0; pt.scaleWeight += Number(entry.scaleWeight) || 0; pt.transportCost += Number(entry.transportCost) || 0;
        }
        entryTotals.grandTotal.wastage = entryTotals.grandTotal.scaleWeight - entryTotals.grandTotal.billWeight;
        return entryTotals;
    } else {
        const exitTotals: ExitTotals = { byProduct: new Map(), grandTotal: { count: 0, weight: 0 } };
        for (const item of data) {
            const exit = item as Exit;
            exitTotals.grandTotal.count++;
            exitTotals.grandTotal.weight += Number(exit.weight) || 0;
            if (!exitTotals.byProduct.has(exit.productId)) exitTotals.byProduct.set(exit.productId, { count: 0, weight: 0 });
            const pt = exitTotals.byProduct.get(exit.productId)!;
            pt.count++; pt.weight += Number(exit.weight) || 0;
        }
        return exitTotals;
    }
};
`;

code = calcTotalsFn + '\n' + code;

const fullTotalsRegex = /const fullTotals = useMemo\(\(\) => \{[\s\S]*?return exitTotals;\s*\}\s*\}, \[data, type\]\);/;
code = code.replace(fullTotalsRegex, 'const fullTotals = useMemo(() => calculateTotals(data, type), [data, type]);');

fs.writeFileSync('utils/print.tsx', code);
