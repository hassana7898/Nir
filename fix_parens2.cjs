const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

code = code.replace(/<div className="text-base border-t border-slate-400 mt-2 pt-1 w-full flex justify-end"><span className="font-bold">\{\`جمع کل این صفحه: \$\{toPersianNumerals\(\(pageTotals as ExitTotals\)\.grandTotal\.weight\.toLocaleString\('fa-IR'\)\)\} کیلوگرم\`\}<\/span><\/div>\n                                \)\)\}/g,
`<div className="text-base border-t border-slate-400 mt-2 pt-1 w-full flex justify-end"><span className="font-bold">{\`جمع کل این صفحه: \${toPersianNumerals((pageTotals as ExitTotals).grandTotal.weight.toLocaleString('fa-IR'))} کیلوگرم\`}</span></div>
                            )}`);
                            
code = code.replace(/<div className="text-base border-t border-slate-400 mt-2 pt-1 w-full flex justify-end"><span className="font-bold">\{\`جمع کل: \$\{toPersianNumerals\(\(totals as ExitTotals\)\.grandTotal\.weight\.toLocaleString\('fa-IR'\)\)\} کیلوگرم\`\}<\/span><\/div>\n                                \)\)\}/g,
`<div className="text-base border-t border-slate-400 mt-2 pt-1 w-full flex justify-end"><span className="font-bold">{\`جمع کل: \${toPersianNumerals((totals as ExitTotals).grandTotal.weight.toLocaleString('fa-IR'))} کیلوگرم\`}</span></div>
                            )}`);
                            
fs.writeFileSync('utils/print.tsx', code);
