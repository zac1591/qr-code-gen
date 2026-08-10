import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const API_URL = 'https://fastcareacademy.com/api.php';

export default function CertificateManager() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState(null);
  const [activeQrUrl, setActiveQrUrl] = useState('');
  const [overwriteConfirm, setOverwriteConfirm] = useState(null);

  // Load existing files on mount
  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_URL}?action=list`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setFiles(data.files);
      }
    } catch (err) {
      showStatus('error', 'Failed to load existing certificates.');
    }
  };

  const showStatus = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleUpload = async (fileToUpload, overwrite = false) => {
    if (!fileToUpload) return;

    setIsUploading(true);
    setUploadProgress(30);

    const formData = new FormData();
    formData.append('certificate', fileToUpload);
    if (overwrite) formData.append('overwrite', 'true');

    try {
      setUploadProgress(60);
      const res = await fetch(`${API_URL}?action=upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await res.json();
      setUploadProgress(100);

      if (data.exists) {
        setOverwriteConfirm({ file: fileToUpload, fileName: data.fileName });
        setIsUploading(false);
        return;
      }

      if (data.success) {
        showStatus('success', data.message);
        setActiveQrUrl(data.url);
        setSelectedFile(null);
        setOverwriteConfirm(null);
        fetchFiles();
      } else {
        showStatus('error', data.error || 'Upload failed.');
      }
    } catch (err) {
      showStatus('error', 'Network error while uploading.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"?`)) return;

    try {
      const res = await fetch(`${API_URL}?action=delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
        credentials: 'include',
      });

      const data = await res.json();
      if (data.success) {
        showStatus('success', 'File deleted successfully.');
        if (activeQrUrl.includes(fileName)) setActiveQrUrl('');
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

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 font-sans">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-800">Fastcare Academy - Certificate Manager</h1>
        <p className="text-sm text-gray-500">Upload PDF certificates, generate permanent QR codes, and manage files.</p>
      </header>

      {/* Feedback Alert */}
      {statusMessage && (
        <div className={`p-4 rounded-md text-sm ${statusMessage.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {statusMessage.text}
        </div>
      )}

      {/* Overwrite Confirmation Dialog */}
      {overwriteConfirm && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-md text-amber-800 space-y-3">
          <p className="font-medium">
            The file <strong>{overwriteConfirm.fileName}</strong> already exists in /graduados/. Do you want to update/overwrite it?
          </p>
          <div className="flex space-x-3">
            <button
              onClick={() => handleUpload(overwriteConfirm.file, true)}
              className="px-4 py-2 bg-amber-600 text-white rounded-md text-xs font-semibold hover:bg-amber-700"
            >
              Yes, Overwrite
            </button>
            <button
              onClick={() => setOverwriteConfirm(null)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Upload Box */}
        <div className="md:col-span-2 space-y-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors bg-gray-50">
            <input
              type="file"
              accept=".pdf"
              id="pdf-upload"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  setSelectedFile(file);
                  handleUpload(file, false);
                }
              }}
            />
            <label htmlFor="pdf-upload" className="cursor-pointer space-y-2 block">
              <svg className="w-10 h-10 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-gray-600 font-medium block">Click or drag PDF certificate to upload</span>
              <span className="text-xs text-gray-400 block">Maximum file size: 10MB</span>
            </label>
          </div>

          {/* Uploading Progress */}
          {isUploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Uploading to /graduados/...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            </div>
          )}

          {/* Existing Certificates List */}
          <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h2 className="font-semibold text-gray-700">Uploaded Certificates ({files.length})</h2>
              <button onClick={fetchFiles} className="text-xs text-blue-600 hover:underline">Refresh</button>
            </div>
            <ul className="divide-y max-h-80 overflow-y-auto">
              {files.length === 0 ? (
                <li className="p-4 text-center text-sm text-gray-400">No certificates found in /graduados/</li>
              ) : (
                files.map((f) => (
                  <li key={f.name} className="p-3 flex items-center justify-between hover:bg-gray-50 transition">
                    <div className="truncate pr-4">
                      <p className="text-sm font-medium text-gray-800 truncate">{f.name}</p>
                      <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(1)} KB • {new Date(f.updated_at * 1000).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => setActiveQrUrl(f.url)}
                        className="px-2.5 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-medium"
                      >
                        View QR
                      </button>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                      >
                        PDF
                      </a>
                      <button
                        onClick={() => handleDelete(f.name)}
                        className="px-2 py-1 text-xs text-red-500 hover:text-red-700 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        {/* Right Column: QR Preview */}
        <div className="bg-white border rounded-lg p-6 flex flex-col items-center justify-center text-center shadow-sm">
          {activeQrUrl ? (
            <div className="space-y-4 w-full">
              <h3 className="text-sm font-semibold text-gray-700">Permanent QR Code</h3>
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
                Download PNG Image
              </button>
            </div>
          ) : (
            <div className="text-gray-400 space-y-2">
              <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4" />
              </svg>
              <p className="text-xs">Upload or select a certificate from the list to view and download its permanent QR code.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}