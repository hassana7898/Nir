const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

code = code.replace(
    /export const PrintRemittanceLayout: React\.FC<\{[\s\S]*?generalDescription\?: string;\s*\}> = \(\{\s*type,\s*data,\s*printDate,\s*isMultiPage,\s*pageNumber,\s*totalPages,\s*isLastPage,\s*rowIndexOffset = 0,\s*totals,\s*generalDescription\s*\}\) => \{/,
    `export const PrintRemittanceLayout: React.FC<{
    type: 'entry' | 'exit';
    data: Remittance[];
    printDate: Date;
    isMultiPage?: boolean;
    pageNumber?: number;
    totalPages?: number;
    isLastPage: boolean;
    rowIndexOffset?: number;
    totals: EntryTotals | ExitTotals;
    pageTotals?: EntryTotals | ExitTotals;
    options?: PrintOptions;
}> = ({ type, data, printDate, isMultiPage, pageNumber, totalPages, isLastPage, rowIndexOffset = 0, totals, pageTotals, options }) => {`
);

fs.writeFileSync('utils/print.tsx', code);
