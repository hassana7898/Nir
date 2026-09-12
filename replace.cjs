const fs = require('fs');
let code = fs.readFileSync('utils/print.tsx', 'utf8');

code = code.replace(/                            \{generalDescription && \(\n                                <div className="mt-3 pt-2">\n                                    <span className="text-xs font-semibold text-slate-800">توضیحات کلی:<\/span>\n                                    <p className="text-\[10px\] font-normal leading-relaxed text-slate-800 mt-1 whitespace-pre-wrap">\{generalDescription\}<\/p>\n                                <\/div>\n                            \)\}/g, '');

fs.writeFileSync('utils/print.tsx', code);
