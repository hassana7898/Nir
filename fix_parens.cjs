const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

// Fix 1: The mapping inside pageTotals for EntryTotals
code = code.replace(/<span key=\{productId\} className="whitespace-nowrap"><span className="font-semibold">\{productMap\.get\(productId\) \|\| productId\}:<\/span> \{toPersianNumerals\(productTotals\.billWeight\.toLocaleString\('fa-IR'\)\)\} کیلوگرم<\/span>\n                                \)\)\}/g,
`<span key={productId} className="whitespace-nowrap"><span className="font-semibold">{productMap.get(productId) || productId}:</span> {toPersianNumerals(productTotals.billWeight.toLocaleString('fa-IR'))} کیلوگرم</span>
                                )}`);

// Fix 2: The mapping inside pageTotals for ExitTotals
code = code.replace(/<span key=\{productId\} className="whitespace-nowrap"><span className="font-semibold">\{productMap\.get\(productId\) \|\| productId\}:<\/span> \{toPersianNumerals\(productTotals\.weight\.toLocaleString\('fa-IR'\)\)\} کیلوگرم<\/span>\n                                \)\)\}/g,
`<span key={productId} className="whitespace-nowrap"><span className="font-semibold">{productMap.get(productId) || productId}:</span> {toPersianNumerals(productTotals.weight.toLocaleString('fa-IR'))} کیلوگرم</span>
                                )}`);

fs.writeFileSync('utils/print.tsx', code);
