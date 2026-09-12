const fs = require('fs');
let code = fs.readFileSync('pages/ExitPage.tsx', 'utf8');

code = code.replace(
    /const \[printDescription, setPrintDescription\] = useState\(''\);/,
    `const [printDescription, setPrintDescription] = useState('');
    const [customPrintTitle, setCustomPrintTitle] = useState('');
    const [showPageTotals, setShowPageTotals] = useState(false);
    const [showGrandTotal, setShowGrandTotal] = useState(true);`
);

const oldModal = `<div className="mb-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">توضیحات کلی (اختیاری)</label>
                            <textarea
                                value={printDescription}
                                onChange={e => setPrintDescription(e.target.value)}
                                className="w-full p-3 border rounded-lg resize-y min-h-[100px]"
                                placeholder="توضیحات کلی که در انتهای برگه چاپ می‌شود را اینجا وارد کنید..."
                            ></textarea>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsPrintModalOpen(false)} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold">انصراف</button>
                            <button onClick={() => {
                                setIsPrintModalOpen(false);
                                handlePrint('exit', filteredExits, { printDate: currentDate, generalDescription: printDescription });
                            }} className="px-4 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg font-bold">تایید و چاپ</button>
                        </div>`;

const newModal = `<div className="mb-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
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
                                handlePrint('exit', filteredExits, { printDate: currentDate, generalDescription: printDescription, customPrintTitle, showPageTotals, showGrandTotal });
                            }} className="px-4 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg font-bold">تایید و چاپ</button>
                        </div>`;

code = code.replace(oldModal, newModal);
fs.writeFileSync('pages/ExitPage.tsx', code);
