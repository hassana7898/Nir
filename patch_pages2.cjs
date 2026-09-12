const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

const regex = /return \(\s*<>\s*\{pagesWithOffsets\.map\(\(page, index\) => \(\s*<PrintRemittanceLayout[^>]*\/>\s*\)\)\}\s*<\/>\s*\);/;
code = code.replace(regex, `
    return (
        <>{pagesWithOffsets.map((page, index) => {
            const pageTotals = calculateTotals(page.data, type);
            return (
                <PrintRemittanceLayout 
                    key={index} 
                    type={type} 
                    data={page.data} 
                    printDate={printDate} 
                    isMultiPage={pagesWithOffsets.length > 1} 
                    pageNumber={index + 1} 
                    totalPages={pagesWithOffsets.length} 
                    isLastPage={index === pagesWithOffsets.length - 1} 
                    rowIndexOffset={page.offset} 
                    totals={fullTotals} 
                    pageTotals={pageTotals}
                    options={options}
                />
            );
        })}</>
    );
`);

fs.writeFileSync('utils/print.tsx', code);
