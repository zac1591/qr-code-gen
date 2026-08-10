<?php

// Start the session BEFORE any headers are sent
session_start();

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$targetDir = __DIR__ . '/graduados/';
$baseUrl = 'https://fastcareacademy.com/graduados/';
$maxFileSize = 10 * 1024 * 1024; // 10MB

$action = $_GET['action'] ?? '';
$TEAM_PASSWORD = "AcadeMia2026!"; // Change this to whatever you want


// --- NEW AUTHENTICATION ENDPOINTS ---

if ($action === 'check_auth' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $isAuthed = isset($_SESSION['authenticated']) && $_SESSION['authenticated'] === true;
    echo json_encode(['authenticated' => $isAuthed]);
    exit;
}

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (isset($input['password']) && $input['password'] === $TEAM_PASSWORD) {
        $_SESSION['authenticated'] = true;
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Invalid password.']);
    }
    exit;
}

if ($action === 'logout' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    session_destroy();
    echo json_encode(['success' => true]);
    exit;
}

// --- THE AUTH GUARD ---
// If the user isn't trying to login/check auth, verify they are logged in
if (!isset($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized access.']);
    exit;
}

// -------------------------------------------------------------
// 1. LIST ALL CERTIFICATES (GET)
// -------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list') {
    $files = [];
    if (is_dir($targetDir)) {
        $dirContents = scandir($targetDir);
        foreach ($dirContents as $file) {
            if ($file !== '.' && $file !== '..' && strtolower(pathinfo($file, PATHINFO_EXTENSION)) === 'pdf') {
                $filePath = $targetDir . $file;
                $files[] = [
                    'name' => $file,
                    'url' => $baseUrl . $file,
                    'size' => filesize($filePath),
                    'updated_at' => filemtime($filePath)
                ];
            }
        }
    }
    // Sort newest first
    usort($files, fn($a, $b) => $b['updated_at'] - $a['updated_at']);
    echo json_encode(['success' => true, 'files' => $files]);
    exit;
}

// -------------------------------------------------------------
// 2. UPLOAD / OVERWRITE CERTIFICATE (POST)
// -------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'upload') {
    if (!isset($_FILES['certificate']) || $_FILES['certificate']['error'] !== UPLOAD_ERR_OK) {
        echo json_encode(['success' => false, 'error' => 'No file uploaded or upload error.']);
        exit;
    }

    $file = $_FILES['certificate'];
    $overwrite = isset($_POST['overwrite']) && $_POST['overwrite'] === 'true';

    if ($file['size'] > $maxFileSize) {
        echo json_encode(['success' => false, 'error' => 'File size exceeds 10MB limit.']);
        exit;
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if ($mimeType !== 'application/pdf') {
        echo json_encode(['success' => false, 'error' => 'Invalid file type. Only PDFs are allowed.']);
        exit;
    }

    // Clean filename
    $originalName = pathinfo($file['name'], PATHINFO_FILENAME);
    $cleanName = preg_replace('/[^a-zA-Z0-9_-]/', '', str_replace(' ', '-', $originalName));
    $finalFileName = strtolower($cleanName) . '.pdf';
    $targetFilePath = $targetDir . $finalFileName;

    // Check if file exists when overwrite flag is false
    if (file_exists($targetFilePath) && !$overwrite) {
        echo json_encode([
            'success' => false,
            'exists' => true,
            'fileName' => $finalFileName,
            'message' => 'A file with this name already exists. Do you want to overwrite it?'
        ]);
        exit;
    }

    if (move_uploaded_file($file['tmp_name'], $targetFilePath)) {
        echo json_encode([
            'success' => true,
            'url' => $baseUrl . $finalFileName,
            'fileName' => $finalFileName,
            'message' => $overwrite ? 'Certificate updated successfully.' : 'Certificate uploaded successfully.'
        ]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to save file on GoDaddy server. Check folder permissions (755).']);
    }
    exit;
}

// -------------------------------------------------------------
// 3. DELETE CERTIFICATE (POST/DELETE)
// -------------------------------------------------------------
if (($action === 'delete') && ($_SERVER['REQUEST_METHOD'] === 'POST' || $_SERVER['REQUEST_METHOD'] === 'DELETE')) {
    $input = json_decode(file_get_contents('php://input'), true);
    $fileName = $input['fileName'] ?? $_POST['fileName'] ?? '';

    // Basic sanitization against directory traversal (e.g., ../)
    $fileName = basename($fileName);

    if (!$fileName) {
        echo json_encode(['success' => false, 'error' => 'Filename is required.']);
        exit;
    }

    $filePath = $targetDir . $fileName;

    if (file_exists($filePath)) {
        if (unlink($filePath)) {
            echo json_encode(['success' => true, 'message' => 'File deleted successfully.']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Could not delete the file.']);
        }
    } else {
        echo json_encode(['success' => false, 'error' => 'File not found.']);
    }
    exit;
}

echo json_encode(['success' => false, 'error' => 'Invalid action.']);