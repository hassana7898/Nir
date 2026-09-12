const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

code = code.replace(/<div key=\{productName\}><strong>\{productName\}:<\/strong> \{toPersianNumerals\(summary\.totalWeight\.toLocaleString\(\)\)\} کیلوگرم \(\{toPersianNumerals\(summary\.count\)\} سرویس\)<\/div>\)\)\}/g,
`<div key={productName}><strong>{productName}:</strong> {toPersianNumerals(summary.totalWeight.toLocaleString())} کیلوگرم ({toPersianNumerals(summary.count)} سرویس)</div>)}`);

fs.writeFileSync('utils/print.tsx', code);
