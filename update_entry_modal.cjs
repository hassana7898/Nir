const fs = require('fs');
let code = fs.readFileSync('pages/EntryPage.tsx', 'utf8');

// 1. Add import for calculatePrintPages
code = code.replace(/import \{ handlePrint \} from '\.\.\/utils\/print';/, `import { handlePrint, calculatePrintPages } from '../utils/print';`);

// 2. Add state for pageSettings
code = code.replace(/const \[showGrandTotal, setShowGrandTotal\] = useState\(true\);/, `const [showGrandTotal, setShowGrandTotal] = useState(true);
    const [pageSettings, setPageSettings] = useState<{title: string, description: string}[]>([]);`);

// 3. Update the print modal opening logic (we'll just use a useEffect or dynamic render). Actually, let's just render dynamically in the modal.
// Replace the old print settings with a per-page array mapped from calculatePrintPages.
const modalOld = `                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">تیتر دلخواه صفحه (اختیاری)</label>
                                <input
                                    type="text"
                                    value={customPrintTitle}
                                    onChange={e => setCustomPrintTitle(e.target.value)}
                                    className="w-full p-3 border rounded-lg"
                                    placeholder="تیتر دلخواه بالای صفحات چاپ..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">توضیحات کلی (اختیاری)</label>
                                <textarea
                                    value={printDescription}
                                    onChange={e => setPrintDescription(e.target.value)}
                                    className="w-full p-3 border rounded-lg resize-y min-h-[100px]"
                                    placeholder="توضیحات کلی که در انتهای برگه چاپ می‌شود را اینجا وارد کنید..."
                                ></textarea>
                            </div>`;

const modalNew = `                            {calculatePrintPages(filteredEntries).map((_, index) => (
                                <div key={index} className="border p-3 rounded-lg bg-slate-50 mb-3 space-y-3">
                                    <h3 className="font-bold text-slate-800 border-b pb-1">صفحه {index + 1}</h3>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">تیتر اختصاصی صفحه (اختیاری)</label>
                                        <input
                                            type="text"
                                            value={pageSettings[index]?.title || ''}
                                            onChange={e => {
                                                const newSettings = [...pageSettings];
                                                if (!newSettings[index]) newSettings[index] = { title: '', description: '' };
                                                newSettings[index].title = e.target.value;
                                                setPageSettings(newSettings);
                                            }}
                                            className="w-full p-2 border rounded-lg text-sm"
                                            placeholder="تیتر پیش‌فرض جایگزین می‌شود..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات اختصاصی صفحه (اختیاری)</label>
                                        <textarea
                                            value={pageSettings[index]?.description || ''}
                                            onChange={e => {
                                                const newSettings = [...pageSettings];
                                                if (!newSettings[index]) newSettings[index] = { title: '', description: '' };
                                                newSettings[index].description = e.target.value;
                                                setPageSettings(newSettings);
                                            }}
                                            className="w-full p-2 border rounded-lg resize-y min-h-[60px] text-sm"
                                            placeholder="توضیحاتی که در انتهای این صفحه چاپ می‌شود..."
                                        ></textarea>
                                    </div>
                                </div>
                            ))}
                            <div className="border-t pt-4 mt-2">
                                <h3 className="font-bold text-slate-800 mb-3">تنظیمات کلی:</h3>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات انتهای کل گزارش (اختیاری)</label>
                                    <textarea
                                        value={printDescription}
                                        onChange={e => setPrintDescription(e.target.value)}
                                        className="w-full p-2 border rounded-lg resize-y min-h-[60px] text-sm mb-3"
                                        placeholder="توضیحات کلی که در آخرین صفحه چاپ می‌شود..."
                                    ></textarea>
                                </div>
                            </div>`;

code = code.replace(modalOld, modalNew);

// 4. Update the handlePrint call
code = code.replace(/handlePrint\('entry', filteredEntries, \{ printDate: currentDate, generalDescription: printDescription, customPrintTitle, showPageTotals, showGrandTotal \}\);/,
`handlePrint('entry', filteredEntries, { printDate: currentDate, generalDescription: printDescription, customPrintTitle, pageSettings, showPageTotals, showGrandTotal });`);

fs.writeFileSync('pages/EntryPage.tsx', code);
