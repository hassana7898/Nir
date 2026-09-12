const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

// 1. Update TransactionItem type
code = code.replace(/type TransactionItem = \{ date: string; shortDate: string; weight: number; ref\?: string; timestamp: number; \};/,
`type TransactionItem = { date: string; shortDate: string; weight: number; ref?: string; timestamp: number; variant?: string; };`);

// 2. Update mapping of invoices to TransactionItem
code = code.replace(/const invoices = data\.relevantInvoices\n            \.filter\(inv => inv\.productId === col\.id\)\n            \.map\(inv => \(\{\n                date: inv\.date,\n                shortDate: getShortDate\(inv\.date\),\n                weight: safeParseFloat\(inv\.weight\),\n                ref: inv\.invoiceNumber,\n                timestamp: inv\.createdAt \|\| new Date\(inv\.date\)\.getTime\(\)\n            \}\)\);/g,
`const invoices = data.relevantInvoices
            .filter(inv => inv.productId === col.id)
            .map(inv => {
                let variant = '';
                if (inv.productVariant) variant += inv.productVariant;
                if (inv.isCrumble) variant += (variant ? ' ' : '') + '(کرامبل)';
                return {
                    date: inv.date,
                    shortDate: getShortDate(inv.date),
                    weight: safeParseFloat(inv.weight),
                    ref: inv.invoiceNumber,
                    timestamp: inv.createdAt || new Date(inv.date).getTime(),
                    variant: variant
                };
            });`);

// 3. Update table rendering colGroups
code = code.replace(/<React\.Fragment key=\{col\.id\}>\n                                <col style=\{\{ width: \`\$\{100 \/ columns\.length \* 0\.35\}%\` \}\} \/>\n                                <col style=\{\{ width: \`\$\{100 \/ columns\.length \* 0\.65\}%\` \}\} \/>\n                            <\/React\.Fragment>/g,
`<React.Fragment key={col.id}>
                                <col style={{ width: \`\$\{100 / columns.length * 0.25\}%\` }} />
                                <col style={{ width: \`\$\{100 / columns.length * 0.25\}%\` }} />
                                <col style={{ width: \`\$\{100 / columns.length * 0.5\}%\` }} />
                            </React.Fragment>`);

// 4. Update the th for the table
code = code.replace(/<tr className="bg-gray-300 text-black">\n                             \{columns\.map\(col => <th key=\{col\.id\} colSpan=\{2\} className="border border-black p-1 font-bold">\{col\.name\}<\/th>\)\}\n                        <\/tr>\n                        <tr className="bg-gray-100 text-black">\n                             \{columns\.map\(col => <React\.Fragment key=\{\`\$\{col\.id\}-sub\`\}><th className="border border-black p-1">تاریخ<\/th><th className="border border-black p-1">وزن<\/th><\/React\.Fragment>\)\}\n                        <\/tr>/,
`<tr className="bg-gray-300 text-black">
                             {columns.map(col => <th key={col.id} colSpan={3} className="border border-black p-1 font-bold">{col.name}</th>)}
                        </tr>
                        <tr className="bg-gray-100 text-black">
                             {columns.map(col => <React.Fragment key={\`\$\{col.id\}-sub\`}>
                                <th className="border border-black p-1 text-[10px]">تاریخ</th>
                                <th className="border border-black p-1 text-[10px]">حواله/نوع</th>
                                <th className="border border-black p-1 text-[10px]">وزن(kg)</th>
                             </React.Fragment>)}
                        </tr>`);

// 5. Update td for the table
code = code.replace(/<React\.Fragment key=\{\`\$\{col\.id\}-\$\{rowIndex\}\`\}>\n                                                <td className="border-l border-r border-gray-400 p-1 text-center bg-white" style=\{\{ direction: 'ltr' \}\}>\{item \? toPersianNumerals\(item\.shortDate\) : ''\}<\/td>\n                                                <td className="border-l border-r border-black p-1 font-bold text-black bg-white">\{item \? toPersianNumerals\(item\.weight\.toLocaleString\(\)\) : ''\}<\/td>\n                                            <\/React\.Fragment>/g,
`<React.Fragment key={\`\$\{col.id\}-\$\{rowIndex\}\`}>
                                                <td className="border-l border-r border-gray-400 p-1 text-center bg-white" style={{ direction: 'ltr' }}>{item ? toPersianNumerals(item.shortDate) : ''}</td>
                                                <td className="border-l border-r border-gray-400 p-1 text-center bg-white text-[9px] whitespace-nowrap overflow-hidden text-ellipsis">
                                                    {item ? (
                                                        <div className="flex flex-col items-center">
                                                            <span>{toPersianNumerals(item.ref || '-')}</span>
                                                            {item.variant && <span className="text-[8px] text-gray-500">{item.variant}</span>}
                                                        </div>
                                                    ) : ''}
                                                </td>
                                                <td className="border-l border-r border-black p-1 font-bold text-black bg-white">{item ? toPersianNumerals(item.weight.toLocaleString()) : ''}</td>
                                            </React.Fragment>`);

// 6. Update the "Not found" colspan
code = code.replace(/<td colSpan=\{columns\.length \* 2\}/, `<td colSpan={columns.length * 3}`);

// 7. Update total row colspan
code = code.replace(/<React\.Fragment key=\{\`\$\{col\.id\}-total\`\}><td className="border border-white p-1 text-xs">جمع<\/td><td className="border border-white p-1">\{toPersianNumerals\(columnTotals\[col\.id\]\.toLocaleString\(\)\)\}<\/td><\/React\.Fragment>/g,
`<React.Fragment key={\`\$\{col.id\}-total\`}>
                                <td colSpan={2} className="border border-white p-1 text-xs">جمع</td>
                                <td className="border border-white p-1">{toPersianNumerals(columnTotals[col.id].toLocaleString())}</td>
                             </React.Fragment>`);

fs.writeFileSync('utils/print.tsx', code);
