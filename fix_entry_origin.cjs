const fs = require('fs');
let code = fs.readFileSync('pages/EntryPage.tsx', 'utf8');

// add state for originNames
code = code.replace(/    const \[driverNames, setDriverNames\] = useState<string\[\]>\(\[\]\);/,
`    const [driverNames, setDriverNames] = useState<string[]>([]);
    const [originNames, setOriginNames] = useState<string[]>([]);`);

// fetch originNames
code = code.replace(/        setDriverNames\(dataService\.getDrivers\(\)\);/,
`        setDriverNames(dataService.getDrivers());
        setOriginNames(dataService.getOrigins ? dataService.getOrigins() : []);`);

// add list="origin-list" and datalist
code = code.replace(/<input onKeyDown=\{handleKeyDown\} placeholder="مبدا بارگیری" value=\{formData\.origin\} onChange=\{e => setFormData\(\{...formData, origin: e\.target\.value\}\)\} className="w-full p-2 border rounded-lg" \/>/g,
`<input list="origin-list" onKeyDown={handleKeyDown} placeholder="مبدا بارگیری" value={formData.origin} onChange={e => setFormData({...formData, origin: e.target.value})} className="w-full p-2 border rounded-lg" />`);

code = code.replace(/<datalist id="driver-list">\{driverNames\.map\(n => <option key=\{n\} value=\{n\} \/>\)\}<\/datalist>/,
`<datalist id="driver-list">{driverNames.map(n => <option key={n} value={n} />)}</datalist>
            <datalist id="origin-list">{originNames.map(n => <option key={n} value={n} />)}</datalist>`);

fs.writeFileSync('pages/EntryPage.tsx', code);
