const fs = require('fs');
let code = fs.readFileSync('pages/EntryPage.tsx', 'utf8');

const oldButtonRegex = /                    <div className="flex justify-end gap-2 border-t pt-4">\n                        <button type="submit" className="bg-green-500 text-white px-8 py-2 rounded-lg font-bold">ذخیره \(Enter\)<\/button>\n                        <button type="button" onClick=\{.*?\} className="bg-gray-400 text-white px-8 py-2 rounded-lg">انصراف<\/button>\n                    <\/div>/;

const newButtons = `                    <div className="flex justify-end gap-2 border-t pt-4">
                        {!editMode.active && (
                            <button type="button" onClick={(e) => handleSave(e as any, true)} className="bg-sky-500 text-white px-4 py-2 rounded-lg font-bold">ثبت و افزودن محصول دیگر</button>
                        )}
                        <button type="submit" className="bg-green-500 text-white px-8 py-2 rounded-lg font-bold">ذخیره (Enter)</button>
                        <button type="button" onClick={() => setIsFormVisible(false)} className="bg-gray-400 text-white px-8 py-2 rounded-lg">انصراف</button>
                    </div>`;

if (code.match(oldButtonRegex)) {
    code = code.replace(oldButtonRegex, newButtons);
    console.log("Matched and replaced buttons!");
} else {
    console.log("Could not match the buttons regex.");
}

fs.writeFileSync('pages/EntryPage.tsx', code);
