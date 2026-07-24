'use strict';

const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

/**
 * Invia un buffer ZPL alla stampante via rete (porta raw, di default 9100).
 */
function sendNetwork(host, port, buffer, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (err) => {
      if (done) return;
      done = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };

    socket.setTimeout(timeoutMs);
    socket.once('timeout', () => finish(new Error(`Timeout connessione a ${host}:${port}`)));
    socket.once('error', (err) => finish(err));

    socket.connect(port, host, () => {
      socket.write(buffer, (err) => {
        if (err) return finish(err);
        socket.end();
        finish();
      });
    });
  });
}

/**
 * Invia un buffer ZPL a una stampante USB su Windows.
 * Metodo: scrive un file temporaneo e usa `copy /b` verso la porta/nome stampante
 * (tecnica standard per inviare dati RAW bypassando la conversione del driver).
 *
 * @param {string} target - nome porta (es. "USB001") oppure nome stampante condivisa
 *                           (es. "\\\\NOMEPC\\ZDesigner ZD410") oppure nome stampante locale.
 */
function sendUSBWindows(target, buffer) {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      return reject(new Error('sendUSBWindows è supportato solo su Windows. Su Linux/Mac scrivere direttamente sul device (es. /dev/usb/lp0).'));
    }
    const tmpFile = path.join(os.tmpdir(), `zlabel_${Date.now()}.zpl`);
    fs.writeFile(tmpFile, buffer, (err) => {
      if (err) return reject(err);
      execFile('cmd.exe', ['/c', 'copy', '/b', tmpFile, target], (err2, stdout, stderr) => {
        fs.unlink(tmpFile, () => {});
        if (err2) return reject(new Error(`Errore invio USB a "${target}": ${stderr || err2.message}`));
        resolve();
      });
    });
  });
}

/**
 * Invio diretto su device USB stile Linux (es. /dev/usb/lp0).
 */
function sendUSBUnix(devicePath, buffer) {
  return new Promise((resolve, reject) => {
    fs.writeFile(devicePath, buffer, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * Invia RAW data a una stampante Windows per NOME (es. "Zebra"), indipendentemente
 * dal tipo di porta (USB001, porta di rete/TCP-IP, WSD, porta "virtuale" creata da
 * Zebra Setup Utilities, ecc.). Usa le API Win32 OpenPrinter/WritePrinter tramite
 * uno script PowerShell incluso in scripts/send-raw-printer.ps1.
 *
 * Questo è il metodo più affidabile su Windows: non richiede di conoscere la porta
 * esatta, basta il nome della stampante come appare in "Get-Printer" / Pannello di controllo.
 */
// Percorso dello script PowerShell.
// - In sviluppo/CLI: usa il file in scripts/.
// - Se quel file non è raggiungibile (es. dentro l'archivio asar dell'app impacchettata),
//   scrive una copia incorporata in una cartella temporanea a runtime.
function resolvePowershellScript() {
  const bundled = path.join(__dirname, '..', 'scripts', 'send-raw-printer.ps1');
  try {
    if (fs.existsSync(bundled)) return { path: bundled, temp: false };
  } catch (_) { /* asar: existsSync può fallire */ }
  const tmp = path.join(os.tmpdir(), 'zebra-send-raw-printer.ps1');
  fs.writeFileSync(tmp, EMBEDDED_PS1, 'utf8');
  return { path: tmp, temp: true };
}

function sendWindowsPrinterByName(printerName, buffer) {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      return reject(new Error('sendWindowsPrinterByName è supportato solo su Windows.'));
    }
    const tmpFile = path.join(os.tmpdir(), `zlabel_${Date.now()}.zpl`);
    let script;
    try {
      script = resolvePowershellScript();
    } catch (e) {
      return reject(e);
    }
    fs.writeFile(tmpFile, buffer, (err) => {
      if (err) return reject(err);
      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script.path, '-PrinterName', printerName, '-FilePath', tmpFile],
        (err2, stdout, stderr) => {
          fs.unlink(tmpFile, () => {});
          if (err2) return reject(new Error(`Errore invio a stampante "${printerName}": ${stderr || stdout || err2.message}`));
          resolve(stdout);
        }
      );
    });
  });
}

// Copia incorporata dello script (identica a scripts/send-raw-printer.ps1),
// usata quando il file su disco non è raggiungibile (app impacchettata in .exe).
const EMBEDDED_PS1 = `param(
  [Parameter(Mandatory=$true)][string]$PrinterName,
  [Parameter(Mandatory=$true)][string]$FilePath
)
$ErrorActionPreference = "Stop"
$code = @"
using System;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);
    public static bool SendBytesToPrinter(string printerName, byte[] bytes, out string error) {
        IntPtr hPrinter; error = "";
        DOCINFOA di = new DOCINFOA(); di.pDocName = "Etichetta ZPL"; di.pDataType = "RAW";
        bool success = false;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) { error = "OpenPrinter fallito. Codice: " + Marshal.GetLastWin32Error(); return false; }
        try {
            if (!StartDocPrinter(hPrinter, 1, di)) { error = "StartDocPrinter fallito. Codice: " + Marshal.GetLastWin32Error(); return false; }
            try {
                if (!StartPagePrinter(hPrinter)) { error = "StartPagePrinter fallito. Codice: " + Marshal.GetLastWin32Error(); return false; }
                IntPtr p = Marshal.AllocHGlobal(bytes.Length);
                try { Marshal.Copy(bytes, 0, p, bytes.Length); int w; success = WritePrinter(hPrinter, p, bytes.Length, out w); if (!success) error = "WritePrinter fallito. Codice: " + Marshal.GetLastWin32Error(); }
                finally { Marshal.FreeHGlobal(p); }
                EndPagePrinter(hPrinter);
            } finally { EndDocPrinter(hPrinter); }
        } finally { ClosePrinter(hPrinter); }
        return success;
    }
}
"@
Add-Type -TypeDefinition $code -Language CSharp
$bytes = [System.IO.File]::ReadAllBytes($FilePath)
$err = ""
$ok = [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $bytes, [ref]$err)
if (-not $ok) { Write-Error "Invio fallito a stampante '$PrinterName': $err"; exit 1 }
Write-Output "OK: inviati $($bytes.Length) byte a '$PrinterName'."
`;

module.exports = { sendNetwork, sendUSBWindows, sendUSBUnix, sendWindowsPrinterByName };
