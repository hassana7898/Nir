const fs = require('fs');
let code = fs.readFileSync('pages/EntryPage.tsx', 'utf8');

const stateDecls = `    const [isImageImportModalOpen, setIsImageImportModalOpen] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [printDescription, setPrintDescription] = useState('');
    const [customPrintTitle, setCustomPrintTitle] = useState('');
    const [showPageTotals, setShowPageTotals] = useState(false);
    const [showGrandTotal, setShowGrandTotal] = useState(true);`;

code = code.replace(/    const \[isImageImportModalOpen, setIsImageImportModalOpen\] = useState\(false\);/, stateDecls);

const buttonReplace = `<button onClick={() => setIsPrintModalOpen(true)} className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm">چاپ</button>`;
code = code.replace(/<button onClick=\{\(\) => handlePrint\('entry', filteredEntries, \{ printDate: currentDate \}\)\} className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm">چاپ<\/button>/, buttonReplace);

const modalHTML = `
            {isPrintModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">تنظیمات چاپ</h2>
                        <div className="mb-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                            <div>
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
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="showPageTotals" 
                                    checked={showPageTotals} 
                                    onChange={e => setShowPageTotals(e.target.checked)} 
                                    className="w-4 h-4 text-emerald-500 rounded border-gray-300 focus:ring-emerald-500"
                                />
                                <label htmlFor="showPageTotals" className="text-sm font-bold text-slate-700">نمایش جمع هر صفحه</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="showGrandTotal" 
                                    checked={showGrandTotal} 
                                    onChange={e => setShowGrandTotal(e.target.checked)} 
                                    className="w-4 h-4 text-emerald-500 rounded border-gray-300 focus:ring-emerald-500"
                                />
                                <label htmlFor="showGrandTotal" className="text-sm font-bold text-slate-700">نمایش جمع کل در انتهای صفحات</label>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <button onClick={() => setIsPrintModalOpen(false)} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold">انصراف</button>
                            <button onClick={() => {
                                setIsPrintModalOpen(false);
                                handlePrint('entry', filteredEntries, { printDate: currentDate, generalDescription: printDescription, customPrintTitle, showPageTotals, showGrandTotal });
                            }} className="px-4 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg font-bold">تایید و چاپ</button>
                        </div>
                    </div>
                </div>
            )}
`;

code = code.replace(/\{isFormVisible && \(/, modalHTML + '\n            {isFormVisible && (');

fs.writeFileSync('pages/EntryPage.tsx', code);
