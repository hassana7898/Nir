const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

// Also ensure that the total row for the detailed table handles empty columns perfectly, just in case that was the issue:
code = code.replace(/<React\.Fragment key=\{\`\$\{col\.id\}-total\`\}>\n                                <td colSpan=\{2\} className="border border-white p-1 text-xs">جمع<\/td>\n                                <td className="border border-white p-1">\{toPersianNumerals\(columnTotals\[col\.id\]\.toLocaleString\(\)\)\}<\/td>\n                             <\/React\.Fragment>/g,
`<React.Fragment key={\`\$\{col.id\}-total\`}>
                                <td colSpan={2} className="border border-white p-1 text-xs">جمع</td>
                                <td className="border border-white p-1">{toPersianNumerals((columnTotals[col.id] || 0).toLocaleString())}</td>
                             </React.Fragment>`);

fs.writeFileSync('utils/print.tsx', code);
