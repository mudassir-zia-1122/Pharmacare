import { useState, useRef } from 'react';
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle,
  AlertCircle, X, ChevronRight, FileText
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { importMedicines } from '../../api/medicines';

const SAMPLE_CSV_CONTENT = `generic_name,brand_name,category,dosage_form,strength,strength_unit,manufacturer,barcode,sku,requires_prescription,pack_size,pack_unit,storage_instructions,warnings,reorder_level
Azithromycin,Zithromax,Antibiotics,Capsule,500,mg,Pfizer,8901234567890,SKU-AZI-500,1,6,Capsules,Store below 30°C,Take 1 hour before or 2 hours after meals,30
Cetirizine,Zyrtec,Allergy & Antihistamines,Tablet,10,mg,GSK Pakistan,8901234567891,SKU-CET-10,0,10,Tablets,Store in a cool dry place,May cause mild drowsiness,50
Omeprazole,Losec,Gastrointestinal,Capsule,20,mg,AstraZeneca,8901234567892,SKU-OME-20,0,14,Capsules,Protect from moisture,Take before breakfast,40
Metformin,Glucophage,Diabetes Care,Tablet,850,mg,Merck,8901234567893,SKU-MET-850,1,30,Tablets,Store below 25°C,Take with meals,60
Salbutamol,Ventolin,Inhalers & Sprays,Inhaler,100,mcg,GSK Pakistan,8901234567894,SKU-VENT-100,1,200,Doses,Store away from direct sunlight,Shake well before use,25`;

export function MedicineImportModal({ isOpen, onClose, onSuccess }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const resetState = () => {
    setFile(null);
    setParsedRows([]);
    setParseError('');
    setIsSubmitting(false);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'pharmacare_medicine_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text) => {
    const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('CSV file must contain a header row and at least one data row.');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const required = ['generic_name', 'brand_name', 'category', 'dosage_form', 'strength'];
    const missing = required.filter(r => !headers.includes(r));
    if (missing.length > 0) {
      throw new Error(`Missing required CSV columns: ${missing.join(', ')}`);
    }

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      // Support basic comma split
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length !== headers.length) continue;

      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] || '';
      });
      rows.push(obj);
    }
    return rows;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setParseError('Please select a valid CSV file (.csv).');
      return;
    }

    setFile(selectedFile);
    setParseError('');
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const rows = parseCSV(text);
        if (rows.length === 0) {
          setParseError('No valid data rows found in the CSV file.');
        } else {
          setParsedRows(rows);
        }
      } catch (err) {
        setParseError(err.message || 'Failed to parse CSV file.');
      }
    };
    reader.onerror = () => {
      setParseError('Error reading file.');
    };
    reader.readAsText(selectedFile);
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    setIsSubmitting(true);
    setParseError('');
    try {
      const res = await importMedicines(parsedRows);
      setImportResult(res.data);
      if (onSuccess) {
        onSuccess(res.data);
      }
    } catch (err) {
      setParseError(err.message || 'Import operation failed. Check connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Medicines from CSV"
      size="xl"
    >
      <div className="space-y-5">
        {/* Step Instructions & Template Download */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-green-600" /> Bulk Catalogue Importer
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Import pharmaceutical records in batch. Duplicate SKUs, barcodes, and name combinations are automatically detected and safely skipped.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Download size={14} />}
            onClick={handleDownloadTemplate}
          >
            Download Template
          </Button>
        </div>

        {parseError && (
          <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {/* Import Results Screen */}
        {importResult ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-center">
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/60 text-green-600 mx-auto flex items-center justify-center mb-1">
                  <CheckCircle2 size={18} />
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{importResult.importedCount}</p>
                <p className="text-xs text-green-600 font-medium">Successfully Imported</p>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center">
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-600 mx-auto flex items-center justify-center mb-1">
                  <AlertTriangle size={18} />
                </div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{importResult.skippedCount}</p>
                <p className="text-xs text-amber-600 font-medium">Duplicates Skipped</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 mx-auto flex items-center justify-center mb-1">
                  <FileText size={18} />
                </div>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{importResult.total}</p>
                <p className="text-xs text-slate-500 font-medium">Total Rows Processed</p>
              </div>
            </div>

            {/* Skipped duplicates breakdown */}
            {importResult.skippedDuplicates && importResult.skippedDuplicates.length > 0 && (
              <div className="border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden">
                <div className="bg-amber-50 dark:bg-amber-950/40 px-4 py-2 border-b border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Skipped Duplicate Details ({importResult.skippedDuplicates.length})
                </div>
                <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs p-2">
                  {importResult.skippedDuplicates.map((dup, i) => (
                    <div key={i} className="py-1.5 px-2 flex items-center justify-between">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        Row {dup.row}: {dup.genericName} ({dup.brandName})
                      </span>
                      <span className="text-amber-600 dark:text-amber-400">{dup.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3">
              <Button variant="secondary" onClick={resetState}>Import Another File</Button>
              <Button variant="primary" onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : (
          /* File Upload & Preview Step */
          <div className="space-y-4">
            {/* File Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-green-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-white dark:bg-slate-900"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-950/40 text-green-600 mx-auto flex items-center justify-center mb-3">
                <Upload size={24} />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {file ? file.name : 'Click to select or drag & drop a CSV file'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports standard comma-separated .csv files up to 5MB
              </p>
            </div>

            {/* Live Data Preview */}
            {parsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Preview: Showing first {Math.min(5, parsedRows.length)} of {parsedRows.length} rows detected
                  </span>
                  <span className="text-green-600 font-medium">Ready to import</span>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-x-auto max-h-56">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500">
                      <tr>
                        <th className="p-2.5">Generic Name</th>
                        <th className="p-2.5">Brand</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5">Form</th>
                        <th className="p-2.5">Strength</th>
                        <th className="p-2.5">Manufacturer</th>
                        <th className="p-2.5">Barcode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">{row.generic_name}</td>
                          <td className="p-2.5">{row.brand_name}</td>
                          <td className="p-2.5">{row.category}</td>
                          <td className="p-2.5">{row.dosage_form}</td>
                          <td className="p-2.5">{row.strength} {row.strength_unit}</td>
                          <td className="p-2.5 text-slate-500">{row.manufacturer || '—'}</td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-400">{row.barcode || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                leftIcon={<Upload size={14} />}
                onClick={handleExecuteImport}
                disabled={parsedRows.length === 0 || isSubmitting}
                isLoading={isSubmitting}
              >
                {isSubmitting ? 'Importing Rows…' : `Execute Import (${parsedRows.length} items)`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default MedicineImportModal;
