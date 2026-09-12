const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

// 1. Calculate totals for Quota table
const sumCode = `                    <tbody>
                        {columns.map(product => {
                            const quota = (quotaMap.get(product.id) || 0) * brood.chickCount / 1000;
                            const sent = data.sentData.get(product.id) || 0;
                            const remaining = quota - sent;
                            const percent = quota > 0 ? (sent / quota) * 100 : 0;
                            return (
                                <tr key={product.id}>
                                    <td className="border border-black p-1 font-bold">{product.name}</td>
                                    <td className="border border-black p-1">{toPersianNumerals(Math.round(quota).toLocaleString())}</td>
                                    <td className="border border-black p-1 font-bold">{toPersianNumerals(Math.round(sent).toLocaleString())}</td>
                                    <td className={\`border border-black p-1 \${remaining < 0 ? 'text-red-700 font-bold' : ''}\`}>
                                        {toPersianNumerals(Math.abs(Math.round(remaining)).toLocaleString())} {remaining < 0 ? '(اضافه)' : ''}
                                    </td>
                                    <td className="border border-black p-1">{toPersianNumerals(Math.round(percent))}%</td>
                                </tr>
                            );
                        })}
                        <tr className="bg-gray-300 font-bold">
                            <td className="border border-black p-1">جمع کل</td>
                            <td className="border border-black p-1">
                                {toPersianNumerals(Math.round(columns.reduce((acc, p) => acc + ((quotaMap.get(p.id) || 0) * brood.chickCount / 1000), 0)).toLocaleString())}
                            </td>
                            <td className="border border-black p-1">
                                {toPersianNumerals(Math.round(columns.reduce((acc, p) => acc + (data.sentData.get(p.id) || 0), 0)).toLocaleString())}
                            </td>
                            <td className="border border-black p-1" dir="rtl">
                                {(() => {
                                    const totalQ = columns.reduce((acc, p) => acc + ((quotaMap.get(p.id) || 0) * brood.chickCount / 1000), 0);
                                    const totalS = columns.reduce((acc, p) => acc + (data.sentData.get(p.id) || 0), 0);
                                    const rem = totalQ - totalS;
                                    return rem < 0 
                                        ? \`\$\{toPersianNumerals(Math.abs(Math.round(rem)).toLocaleString())\} (اضافه)\`
                                        : toPersianNumerals(Math.round(rem).toLocaleString());
                                })()}
                            </td>
                            <td className="border border-black p-1">
                                {(() => {
                                    const totalQ = columns.reduce((acc, p) => acc + ((quotaMap.get(p.id) || 0) * brood.chickCount / 1000), 0);
                                    const totalS = columns.reduce((acc, p) => acc + (data.sentData.get(p.id) || 0), 0);
                                    return toPersianNumerals(totalQ > 0 ? Math.round((totalS / totalQ) * 100) : 0) + '%';
                                })()}
                            </td>
                        </tr>
                    </tbody>`;

code = code.replace(/                    <tbody>\n                        \{columns\.map\(product => \{\n                            const quota = \(quotaMap\.get\(product\.id\) \|\| 0\) \* brood\.chickCount \/ 1000;\n                            const sent = data\.sentData\.get\(product\.id\) \|\| 0;\n                            const remaining = quota - sent;\n                            const percent = quota > 0 \? \(sent \/ quota\) \* 100 : 0;\n                            return \(\n                                <tr key=\{product\.id\}>\n                                    <td className="border border-black p-1 font-bold">\{product\.name\}<\/td>\n                                    <td className="border border-black p-1">\{toPersianNumerals\(Math\.round\(quota\)\.toLocaleString\(\)\)\}<\/td>\n                                    <td className="border border-black p-1 font-bold">\{toPersianNumerals\(Math\.round\(sent\)\.toLocaleString\(\)\)\}<\/td>\n                                    <td className=\{\`border border-black p-1 \$\{remaining < 0 \? 'text-red-700 font-bold' : ''\}\`\}>\n                                        \{toPersianNumerals\(Math\.abs\(Math\.round\(remaining\)\)\.toLocaleString\(\)\)\} \{remaining < 0 \? '\(اضافه\)' : ''\}\n                                    <\/td>\n                                    <td className="border border-black p-1">\{toPersianNumerals\(Math\.round\(percent\)\)\}%<\/td>\n                                <\/tr>\n                            \);\n                        \}\)\}\n                    <\/tbody>/, sumCode);

fs.writeFileSync('utils/print.tsx', code);
