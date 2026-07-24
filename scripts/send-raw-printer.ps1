<#
  Invia dati RAW (ZPL) a una stampante Windows installata, per NOME,
  indipendentemente dal tipo di porta (USB, rete/TCP, WSD, ecc.).
  Usa le API Win32 OpenPrinter/StartDocPrinter/WritePrinter (metodo standard
  per stampa RAW su Windows), quindi bypassa completamente il driver.

  Uso:
    powershell -ExecutionPolicy Bypass -File send-raw-printer.ps1 -PrinterName "Zebra" -FilePath "C:\temp\label.zpl"
#>
param(
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
        IntPtr hPrinter;
        error = "";
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Etichetta ZPL";
        di.pDataType = "RAW";
        bool success = false;

        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            error = "OpenPrinter fallito (nome stampante errato?). Codice: " + Marshal.GetLastWin32Error();
            return false;
        }
        try {
            if (!StartDocPrinter(hPrinter, 1, di)) {
                error = "StartDocPrinter fallito. Codice: " + Marshal.GetLastWin32Error();
                return false;
            }
            try {
                if (!StartPagePrinter(hPrinter)) {
                    error = "StartPagePrinter fallito. Codice: " + Marshal.GetLastWin32Error();
                    return false;
                }
                IntPtr pUnmanagedBytes = Marshal.AllocHGlobal(bytes.Length);
                try {
                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                    int written;
                    success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out written);
                    if (!success) error = "WritePrinter fallito. Codice: " + Marshal.GetLastWin32Error();
                } finally {
                    Marshal.FreeHGlobal(pUnmanagedBytes);
                }
                EndPagePrinter(hPrinter);
            } finally {
                EndDocPrinter(hPrinter);
            }
        } finally {
            ClosePrinter(hPrinter);
        }
        return success;
    }
}
"@

Add-Type -TypeDefinition $code -Language CSharp

$bytes = [System.IO.File]::ReadAllBytes($FilePath)
$err = ""
$ok = [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $bytes, [ref]$err)

if (-not $ok) {
    Write-Error "Invio fallito a stampante '$PrinterName': $err"
    exit 1
}
Write-Output "OK: inviati $($bytes.Length) byte a '$PrinterName'."
