const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

const regex = /    const generalDescription = pageSetting\?\.description \|\| options\?\.generalDescription;/;
code = code.replace(regex,
`    const pageDescription = pageSetting?.description;
    const globalDescription = isLastPage ? options?.generalDescription : null;`);

const jsxRegex = /                            \{generalDescription && \([\s\S]*?                            \}\)/;
code = code.replace(jsxRegex, ``);

const footerRegex = /            <div className="print-footer">/;
const newFooter = `            {pageDescription && (
                <div className="mt-3 pt-2 page-break-inside-avoid">
                    <span className="text-xs font-semibold text-slate-800">توضیحات صفحه:</span>
                    <p className="text-[10px] font-normal leading-relaxed text-slate-800 mt-1 whitespace-pre-wrap">{pageDescription}</p>
                </div>
            )}
            {globalDescription && (
                <div className="mt-3 pt-2 page-break-inside-avoid">
                    <span className="text-xs font-semibold text-slate-800">توضیحات کلی گزارش:</span>
                    <p className="text-[10px] font-normal leading-relaxed text-slate-800 mt-1 whitespace-pre-wrap">{globalDescription}</p>
                </div>
            )}
            <div className="print-footer">`;
code = code.replace(footerRegex, newFooter);

fs.writeFileSync('utils/print.tsx', code);
