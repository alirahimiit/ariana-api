using System.Runtime.InteropServices;
using System.Text;


namespace ArianaAPI.Infrastructure.Services; 

/// <summary>
/// پورت مستقیم از Delphi (Main.pas / Utility_impl.pas)
/// myStrtoSerial + myGetCheckSum
/// </summary>
public static class SerialGenerator
{
    public const string MySysInternalCode = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    public const string WebProgramName = "ARIANA_WEB";
    public const string WebAccessCode = "1";

    /// <summary>
    /// معادل myGetCheckSum در دلفی — int64 با ۱۲ رقم hex
    /// </summary>
    private static string MyGetCheckSum(string input)
    {
        unchecked
        {
            long s = 0;
            int i = 0;

            foreach (char c in input)
            {
                // معادل: s := s + Int64(Ord(c)) shl i
                s += (long)c << i;
                i = (i < 64) ? i + 1 : 0;
            }

            // معادل IntToHex(s, 12)
            var hex = s.ToString("X");
            if (hex.Length < 12) hex = hex.PadLeft(12, '0');
            return hex;
        }
    }

    /// <summary>
    /// معادل myStrtoSerial در دلفی
    /// </summary>
    public static string MyStrToSerial(string input)
    {
        var hex = MyGetCheckSum(input);

        // ۱۲ رقم اول → 3 گروه 4 تایی
        var first12 = hex.Substring(0, 12);
        var result = $"{first12.Substring(0, 4)}-{first12.Substring(4, 4)}-{first12.Substring(8, 4)}";

        // A→1, B→2, C→3, D→4, E→5, F→6
        return result
            .Replace("A", "1").Replace("B", "2")
            .Replace("C", "3").Replace("D", "4")
            .Replace("E", "5").Replace("F", "6");
    }

 

    // ⭐ خواندن HDD Serial از C:\ (همون که دلفی می‌خوند)
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern bool GetVolumeInformation(
        string lpRootPathName,
        StringBuilder lpVolumeNameBuffer,
        int nVolumeNameSize,
        out uint lpVolumeSerialNumber,
        out uint lpMaximumComponentLength,
        out uint lpFileSystemFlags,
        StringBuilder lpFileSystemNameBuffer,
        int nFileSystemNameSize);

    public static uint GetVolumeSerial(string drive = "C:\\")
    {
        var volName = new StringBuilder(261);
        var fsName = new StringBuilder(261);
        uint serialNum, maxComp, fsFlags;
        if (!GetVolumeInformation(drive, volName, volName.Capacity,
                out serialNum, out maxComp, out fsFlags, fsName, fsName.Capacity))
            return 0;
        return serialNum;
    }

    // ⭐ محاسبه WebSystemId — دقیقاً مثل دلفی
    public static string ComputeSystemId(string syntacticCode)
    {
        var hdd = GetVolumeSerial("C:\\");
        return MyStrToSerial(hdd.ToString() + syntacticCode);
    }
    /// <summary>
    /// تولید سریال برای وب (ARIANA_WEB)
    /// </summary>
    public static string ComputeWebSerial(string systemId, string accessCode = "1")
    {
        var input = MySysInternalCode + WebProgramName + accessCode + systemId;
        return MyStrToSerial(input);
    }

}