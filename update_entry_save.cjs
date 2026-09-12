const fs = require('fs');
let code = fs.readFileSync('pages/EntryPage.tsx', 'utf8');

code = code.replace(/    const handleSave = async \(e\?: React\.FormEvent\) => \{/g,
`    const handleSave = async (e?: React.FormEvent, keepSellerInfo: boolean = false) => {`);

code = code.replace(/                setFormData\(\{ \.\.\.initialFormState, productId: formData\.productId \}\);/g,
`                if (keepSellerInfo) {
                    setFormData({
                        ...formData,
                        productId: settings.products[0]?.id || '',
                        billWeight: 0,
                        scaleWeight: 0,
                        wastage: 0
                    });
                } else {
                    setFormData({ ...initialFormState, productId: formData.productId });
                }`);

const buttonRegex = /<div className="flex gap-2 pt-2 border-t mt-4">\n\s*<button type="submit" className="flex-grow px-4 py-2 bg-emerald-500 text-white rounded-lg font-bold">\{editMode\.active \? 'ذخیره تغییرات' : 'ثبت حواله'\}<\/button>/;
const newButtons = `<div className="flex gap-2 pt-2 border-t mt-4">
                            <button type="submit" className="flex-grow px-4 py-2 bg-emerald-500 text-white rounded-lg font-bold">{editMode.active ? 'ذخیره تغییرات' : 'ثبت حواله'}</button>
                            {!editMode.active && (
                                <button type="button" onClick={(e) => handleSave(e, true)} className="flex-grow px-4 py-2 bg-sky-500 text-white rounded-lg font-bold">ثبت و افزودن محصول دیگر (همین بارنامه)</button>
                            )}`;

code = code.replace(buttonRegex, newButtons);

fs.writeFileSync('pages/EntryPage.tsx', code);
