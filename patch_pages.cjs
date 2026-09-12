const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

const exportFunc = `export const calculatePrintPages = (data: Remittance[]) => {
    const pages: { data: Remittance[]; offset: number }[] = [];
    let currentPage: Remittance[] = [];
    let offset = 0;
    if (data.length === 0) return [{ data: [], offset: 0 }];
    for (const item of data) {
        if (item.isPageBreak && currentPage.length > 0) {
            pages.push({ data: currentPage, offset });
            offset += currentPage.length;
            currentPage = [];
        }
        currentPage.push(item);
    }
    if (currentPage.length > 0) pages.push({ data: currentPage, offset });
    return pages.length > 0 ? pages : [{ data: [], offset: 0 }];
};

const PrintPages`;

code = code.replace(/const PrintPages/, exportFunc);
code = code.replace(/    const pagesWithOffsets = useMemo\(\(\) => \{[\s\S]*?    \}, \[data\]\);/, `    const pagesWithOffsets = useMemo(() => calculatePrintPages(data), [data]);`);

fs.writeFileSync('utils/print.tsx', code);
