import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const API_URL = 'https://fastcareacademy.com/api.php';

export default function CertificateManager() {
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  
  const [activeTask, setActiveTask] = useState({ active: false, type: '', current: 0, total: 0 });
  const [statusMessage, setStatusMessage] = useState(null);
  const [activeQrUrl, setActiveQrUrl] = useState('');
  
  // New state for Drag and Drop highlight
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_URL}?action=list`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setFiles(data.files);
    } catch (err) {
      showStatus('error', 'Failed to load existing certificates.');
    }
  };

  const showStatus = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleDragOver = (e) => {
    e.preventDefault();
    if (!activeTask.active) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (activeTask.active) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleBulkUpload(Array.from(e.dataTransfer.files));
    }
  };

  // --- UPLOAD LOGIC ---
  const handleBulkUpload = async (filesList) => {
    if (!filesList.length) return;
    
    // Filter for PDFs only
    const pdfFiles = filesList.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      showStatus('error', 'Only PDF files are allowed.');
      return;
    }
    
    setActiveTask({ active: true, type: 'Uploading', current: 0, total: pdfFiles.length });
    let successCount = 0;

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      const formData = new FormData();
      formData.append('certificate', file);
      formData.append('overwrite', 'true'); 

      try {
        const res = await fetch(`${API_URL}?action=upload`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        const data = await res.json();
        if (data.success) successCount++;
      } catch (err) {
        console.error(`Failed to upload ${file.name}`);
      }
      setActiveTask(prev => ({ ...prev, current: i + 1 }));
    }

    setActiveTask({ active: false, type: '', current: 0, total: 0 });
    showStatus('success', `Successfully uploaded ${successCount} of ${pdfFiles.length} files.`);
    fetchFiles();
  };

  // --- BULK DOWNLOAD LOGIC ---
  const handleBulkDownload = async () => {
    if (selectedFiles.size === 0) return;

    setActiveTask({ active: true, type: 'Generating ZIP', current: 0, total: selectedFiles.size });
    const zip = new JSZip();
    const folder = zip.folder("Fastcare_QRs");
    const filesToProcess = files.filter(f => selectedFiles.has(f.name));

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      try {
        const qrDataUrl = await QRCode.toDataURL(file.url, { width: 1024, margin: 2, errorCorrectionLevel: 'H' });
        const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "");
        folder.file(`QR-${file.name.replace('.pdf', '')}.png`, base64Data, { base64: true });
      } catch (err) {
        console.error(`Failed to generate QR for ${file.name}`);
      }
      setActiveTask(prev => ({ ...prev, current: i + 1 }));
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "Fastcare_Certificates_QRs.zip");
    
    setActiveTask({ active: false, type: '', current: 0, total: 0 });
    setSelectedFiles(new Set());
    showStatus('success', 'ZIP file downloaded successfully!');
  };

  // --- BULK DELETE LOGIC ---
  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedFiles.size} certificates?`)) return;

    setActiveTask({ active: true, type: 'Deleting', current: 0, total: selectedFiles.size });
    const filesToDelete = Array.from(selectedFiles);
    let successCount = 0;

    for (let i = 0; i < filesToDelete.length; i++) {
      const fileName = filesToDelete[i];
      try {
        const res = await fetch(`${API_URL}?action=delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ fileName }),
        });
        const data = await res.json();
        if (data.success) {
          successCount++;
          if (activeQrUrl.includes(fileName)) setActiveQrUrl('');
        }
      } catch (err) {
        console.error(`Failed to delete ${fileName}`);
      }
      setActiveTask(prev => ({ ...prev, current: i + 1 }));
    }

    setActiveTask({ active: false, type: '', current: 0, total: 0 });
    setSelectedFiles(new Set());
    showStatus('success', `Successfully deleted ${successCount} files.`);
    fetchFiles();
  };

  // --- SINGLE DELETE LOGIC ---
  const handleDelete = async (fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"?`)) return;
    try {
      const res = await fetch(`${API_URL}?action=delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileName }),
      });
      const data = await res.json();
      if (data.success) {
        showStatus('success', 'File deleted successfully.');
        if (activeQrUrl.includes(fileName)) setActiveQrUrl('');
        if (selectedFiles.has(fileName)) {
          const newSelection = new Set(selectedFiles);
          newSelection.delete(fileName);
          setSelectedFiles(newSelection);
        }
        fetchFiles();
      } else {
        showStatus('error', data.error || 'Failed to delete file.');
      }
    } catch (err) {
      showStatus('error', 'Error deleting file.');
    }
  };

  const downloadQrCode = (fileName) => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngFile;
      downloadLink.download = `QR-${fileName.replace('.pdf', '')}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const toggleSelection = (fileName) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileName)) newSelection.delete(fileName);
    else newSelection.add(fileName);
    setSelectedFiles(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) setSelectedFiles(new Set());
    else setSelectedFiles(new Set(files.map(f => f.name)));
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 font-sans">
      <header className="border-b pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Fastcare Academy - Certificate Manager</h1>
          <p className="text-sm text-gray-500">Upload PDFs, generate QRs, and batch manage files.</p>
        </div>
      </header>

      {statusMessage && (
        <div className={`p-4 rounded-md text-sm font-medium ${statusMessage.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
          {statusMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* DRAG AND DROP UPLOAD ZONE */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              activeTask.active ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed' 
              : isDragging ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-blue-500 bg-gray-50 cursor-pointer'
            }`}
          >
            <input
              type="file"
              accept=".pdf"
              id="pdf-upload"
              multiple
              className="hidden"
              disabled={activeTask.active}
              onChange={(e) => {
                if (e.target.files.length > 0) handleBulkUpload(Array.from(e.target.files));
              }}
            />
            <label htmlFor="pdf-upload" className={`block w-full h-full ${activeTask.active ? '' : 'cursor-pointer'}`}>
              <svg className={`w-10 h-10 mx-auto mb-2 transition-colors ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className={`font-medium block transition-colors ${isDragging ? 'text-blue-600' : 'text-gray-600'}`}>
                {isDragging ? 'Drop PDFs here to upload...' : 'Click or drag PDFs here to upload'}
              </span>
            </label>
          </div>

          {/* UNIFIED PROGRESS BAR */}
          {activeTask.active && (
            <div className="space-y-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="flex justify-between text-sm font-semibold text-blue-800">
                <span>{activeTask.type} {activeTask.current} of {activeTask.total}...</span>
                <span>{Math.round((activeTask.current / activeTask.total) * 100)}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2.5">
                <div 
                  className={`h-2.5 rounded-full transition-all duration-200 ${activeTask.type === 'Deleting' ? 'bg-red-500' : 'bg-blue-600'}`} 
                  style={{ width: `${(activeTask.current / activeTask.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* FILE LIST */}
          <div className="bg-white border rounded-lg shadow-sm">
            <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div className="flex items-center space-x-3">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  checked={files.length > 0 && selectedFiles.size === files.length}
                  onChange={toggleSelectAll}
                />
                <h2 className="font-semibold text-gray-700">Certificates ({files.length})</h2>
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Batch Action Buttons */}
                {selectedFiles.size > 0 && (
                  <div className="flex space-x-2">
                    <button 
                      onClick={handleBulkDownload}
                      disabled={activeTask.active}
                      className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 disabled:opacity-50 transition shadow-sm"
                    >
                      Download QRs
                    </button>
                    <button 
                      onClick={handleBulkDelete}
                      disabled={activeTask.active}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 disabled:opacity-50 transition shadow-sm"
                    >
                      Delete
                    </button>
                  </div>
                )}
                {/* Restored Refresh Button */}
                <button 
                  onClick={fetchFiles} 
                  disabled={activeTask.active}
                  className="text-xs text-blue-600 hover:underline disabled:opacity-50 shrink-0 font-medium ml-2"
                >
                  Refresh List
                </button>
              </div>
            </div>
            
            <ul className="divide-y max-h-96 overflow-y-auto">
              {files.map((f) => (
                <li key={f.name} className={`p-3 flex items-center justify-between transition ${selectedFiles.has(f.name) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 shrink-0"
                      checked={selectedFiles.has(f.name)}
                      onChange={() => toggleSelection(f.name)}
                    />
                    <div className="truncate">
                      <p className="text-sm font-medium text-gray-800 truncate">{f.name}</p>
                      <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(1)} KB • {new Date(f.updated_at * 1000).toLocaleDateString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 shrink-0 ml-4">
                    <button 
                      onClick={() => setActiveQrUrl(f.url)} 
                      className="px-2.5 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium transition"
                    >
                      QR
                    </button>
                    <a 
                      href={f.url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 font-medium transition"
                    >
                      PDF
                    </a>
                    <button 
                      onClick={() => handleDelete(f.name)} 
                      className="px-2.5 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 font-medium transition"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
              {files.length === 0 && !activeTask.active && (
                <li className="p-6 text-center text-sm text-gray-400">No certificates found. Upload some PDFs to get started.</li>
              )}
            </ul>
          </div>
        </div>

        {/* RIGHT COLUMN: PREVIEW */}
        <div className="bg-white border rounded-lg p-6 flex flex-col items-center justify-center text-center shadow-sm h-fit sticky top-6">
          {activeQrUrl ? (
            <div className="space-y-4 w-full">
              <h3 className="text-sm font-semibold text-gray-700">Preview Permanent QR</h3>
              <div className="p-4 bg-white border rounded-lg inline-block shadow-inner">
                <QRCodeSVG id="qr-code-svg" value={activeQrUrl} size={180} level="H" includeMargin={true} />
              </div>
              <div className="text-xs text-gray-500 break-all bg-gray-50 p-2 rounded border">
                {activeQrUrl}
              </div>
              <button
                onClick={() => downloadQrCode(activeQrUrl.split('/').pop())}
                className="w-full py-2 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition"
              >
                Download Single PNG
              </button>
            </div>
          ) : (
            <div className="text-gray-400 space-y-2 py-8">
              <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4" />
              </svg>
              <p className="text-xs">Click 'QR' on a file to view and download its code.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}