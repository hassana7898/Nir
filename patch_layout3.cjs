const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

const replacement = `
            {options?.showPageTotals && pageTotals && data.length > 0 && (
                <div className="mt-4 pt-2 font-bold" style={{ fontSize: '10pt', borderTop: '2px solid black', paddingBottom: '0.5rem', pageBreakInside: 'avoid', fontFamily: "'Sahel', sans-serif" }}>
                    {type === 'entry' ? (
                        <div>
                            <span className="text-base">جمع این صفحه (بر اساس بارنامه):</span>
                            <div className="flex flex-row flex-wrap justify-start gap-x-6 gap-y-1 text-sm font-normal mt-1">
                                {Array.from((pageTotals as EntryTotals).byProduct.entries()).map(([productId, productTotals]) =>
                                    <span key={productId} className="whitespace-nowrap"><span className="font-semibold">{productMap.get(productId) || productId}:</span> {toPersianNumerals(productTotals.billWeight.toLocaleString('fa-IR'))} کیلوگرم</span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <span className="text-base">جمع این صفحه:</span>
                            <div className="flex flex-row flex-wrap justify-start gap-x-6 gap-y-1 text-sm font-normal mt-1">
                                {Array.from((pageTotals as ExitTotals).byProduct.entries()).map(([productId, productTotals]) =>
                                    <span key={productId} className="whitespace-nowrap"><span className="font-semibold">{productMap.get(productId) || productId}:</span> {toPersianNumerals(productTotals.weight.toLocaleString('fa-IR'))} کیلوگرم</span>
                                )}
                            </div>
                            {Array.from((pageTotals as ExitTotals).byProduct.keys()).length > 1 && (
                                <div className="text-base border-t border-slate-400 mt-2 pt-1 w-full flex justify-end"><span className="font-bold">{\`جمع کل این صفحه: \${toPersianNumerals((pageTotals as ExitTotals).grandTotal.weight.toLocaleString('fa-IR'))} کیلوگرم\`}</span></div>
                            )}
                        </div>
                    )}
                </div>
            )}
            {isLastPage && (options?.showGrandTotal !== false) && data.length > 0 && (
                <div className="mt-4 pt-2 font-bold" style={{ fontSize: '10pt', borderTop: '2px solid black', paddingBottom: '2rem', pageBreakInside: 'avoid', fontFamily: "'Sahel', sans-serif" }}>
                    {type === 'entry' ? (
                        <div>
                            <span className="text-base">جمع کل صفحات (بر اساس بارنامه):</span>
                            <div className="flex flex-row flex-wrap justify-start gap-x-6 gap-y-1 text-sm font-normal mt-1">
                                {Array.from((totals as EntryTotals).byProduct.entries()).map(([productId, productTotals]) =>
                                    <span key={productId} className="whitespace-nowrap"><span className="font-semibold">{productMap.get(productId) || productId}:</span> {toPersianNumerals(productTotals.billWeight.toLocaleString('fa-IR'))} کیلوگرم</span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <span className="text-base">جمع کل صفحات:</span>
                            <div className="flex flex-row flex-wrap justify-start gap-x-6 gap-y-1 text-sm font-normal mt-1">
                                {Array.from((totals as ExitTotals).byProduct.entries()).map(([productId, productTotals]) =>
                                    <span key={productId} className="whitespace-nowrap"><span className="font-semibold">{productMap.get(productId) || productId}:</span> {toPersianNumerals(productTotals.weight.toLocaleString('fa-IR'))} کیلوگرم</span>
                                )}
                            </div>
                            {generalDescription && (
                                <div className="mt-3 pt-2">
                                    <span className="text-xs font-semibold text-slate-800">توضیحات کلی:</span>
                                    <p className="text-[10px] font-normal leading-relaxed text-slate-800 mt-1 whitespace-pre-wrap">{generalDescription}</p>
                                </div>
                            )}
                            {Array.from((totals as ExitTotals).byProduct.keys()).length > 1 && (
                                <div className="text-base border-t border-slate-400 mt-2 pt-1 w-full flex justify-end"><span className="font-bold">{\`جمع کل: \${toPersianNumerals((totals as ExitTotals).grandTotal.weight.toLocaleString('fa-IR'))} کیلوگرم\`}</span></div>
                            )}
                        </div>
                    )}
                </div>
            )}
`;

const startIdx = code.indexOf('{isLastPage && data.length > 0 && (');
const endString = '<div className="print-footer">';
const endIdx = code.indexOf(endString, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + replacement + '            ' + code.substring(endIdx);
    fs.writeFileSync('utils/print.tsx', code);
    console.log("Successfully patched totals.");
} else {
    console.log("Could not find replacement block.", startIdx, endIdx);
}
