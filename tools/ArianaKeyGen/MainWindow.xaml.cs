using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Windows;
using System.Windows.Media;
using Microsoft.Win32;

namespace ArianaKeyGen;

public partial class MainWindow : Window
{
    private static readonly string KeysDir = Path.Combine(AppContext.BaseDirectory, "keys");
    private static readonly string PrivateKeyPath = Path.Combine(KeysDir, "private.key");
    private static readonly string PublicKeyPath = Path.Combine(KeysDir, "public.key");

    public MainWindow()
    {
        InitializeComponent();
        Directory.CreateDirectory(KeysDir);
        UpdateKeyStatus();

        // پیش‌فرض مسیر خروجی روی Desktop
        TxtOutputPath.Text = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.Desktop),
            "ariana.lic");

        SetStatus("ℹ️", "آماده. اگه کلید نداری، اول از تب «کلیدها» بساز.",
            Color.FromRgb(107, 114, 128));
    }

    // ═══════════════════════════════════════════
    //  به‌روزرسانی وضعیت کلیدها
    // ═══════════════════════════════════════════
    private void UpdateKeyStatus()
    {
        var hasPriv = File.Exists(PrivateKeyPath);
        var hasPub = File.Exists(PublicKeyPath);

        TxtPrivateStatus.Text = hasPriv ? "✅ موجود" : "❌ موجود نیست";
        TxtPrivateStatus.Foreground = hasPriv
            ? new SolidColorBrush(Color.FromRgb(16, 185, 129))
            : new SolidColorBrush(Color.FromRgb(239, 68, 68));

        TxtPublicStatus.Text = hasPub ? "✅ موجود" : "❌ موجود نیست";
        TxtPublicStatus.Foreground = hasPub
            ? new SolidColorBrush(Color.FromRgb(16, 185, 129))
            : new SolidColorBrush(Color.FromRgb(239, 68, 68));
    }

    private void SetStatus(string icon, string message, Color color)
    {
        TxtStatusIcon.Text = icon;
        TxtStatus.Text = message;
        TxtStatus.Foreground = new SolidColorBrush(color);
    }

    // ═══════════════════════════════════════════
    //  ساخت جفت کلید
    // ═══════════════════════════════════════════
    private void BtnGenerateKeys_Click(object sender, RoutedEventArgs e)
    {
        if (File.Exists(PrivateKeyPath))
        {
            var result = MessageBox.Show(
                "⚠️ کلیدها قبلاً ساخته شدن!\n\n" +
                "اگه کلید جدید بسازی:\n" +
                "• همه‌ی لایسنس‌های قبلی باطل می‌شن\n" +
                "• باید فایل public.key رو توی اپ Web آپدیت کنی\n\n" +
                "مطمئنی؟",
                "هشدار",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning,
                MessageBoxResult.No);

            if (result != MessageBoxResult.Yes) return;
        }

        try
        {
            using var rsa = RSA.Create(2048);
            var privateKeyXml = rsa.ToXmlString(true);
            var publicKeyXml = rsa.ToXmlString(false);

            File.WriteAllText(PrivateKeyPath, privateKeyXml, Encoding.UTF8);
            File.WriteAllText(PublicKeyPath, publicKeyXml, Encoding.UTF8);

            UpdateKeyStatus();

            MessageBox.Show(
                "✅ کلیدها با موفقیت ساخته شدن!\n\n" +
                $"📂 مسیر: {KeysDir}\n\n" +
                "⚠️ فایل private.key رو محرمانه نگه دار!\n" +
                "⚠️ محتوای public.key رو باید توی کد اپ Web بذاری.",
                "موفق",
                MessageBoxButton.OK,
                MessageBoxImage.Information);

            SetStatus("✅", "کلیدها ساخته شدن. حالا می‌تونی لایسنس بسازی.",
                Color.FromRgb(16, 185, 129));
        }
        catch (Exception ex)
        {
            MessageBox.Show($"❌ خطا: {ex.Message}", "خطا",
                MessageBoxButton.OK, MessageBoxImage.Error);
            SetStatus("❌", $"خطا: {ex.Message}",
                Color.FromRgb(239, 68, 68));
        }
    }

    // ═══════════════════════════════════════════
    //  کپی public.key
    // ═══════════════════════════════════════════
    private void BtnCopyPublicKey_Click(object sender, RoutedEventArgs e)
    {
        if (!File.Exists(PublicKeyPath))
        {
            MessageBox.Show("❌ فایل public.key پیدا نشد!", "خطا",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        try
        {
            var content = File.ReadAllText(PublicKeyPath, Encoding.UTF8);
            Clipboard.SetText(content);
            SetStatus("📋", "محتوای public.key کپی شد. توی کد اپ Web بذار.",
                Color.FromRgb(79, 70, 229));
        }
        catch (Exception ex)
        {
            MessageBox.Show($"❌ خطا: {ex.Message}", "خطا",
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    // ═══════════════════════════════════════════
    //  انتخاب مسیر خروجی
    // ═══════════════════════════════════════════
    private void BtnBrowse_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new SaveFileDialog
        {
            Title = "محل ذخیره‌ی فایل لایسنس",
            Filter = "License Files (*.lic)|*.lic|All Files (*.*)|*.*",
            DefaultExt = ".lic",
            FileName = "ariana.lic",
            InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.Desktop)
        };

        if (dialog.ShowDialog() == true)
        {
            TxtOutputPath.Text = dialog.FileName;
        }
    }

    // ═══════════════════════════════════════════
    //  ساخت لایسنس
    // ═══════════════════════════════════════════
    private void BtnCreateLicense_Click(object sender, RoutedEventArgs e)
    {
        // ─── اعتبارسنجی ───
        if (!File.Exists(PrivateKeyPath))
        {
            MessageBox.Show(
                "❌ فایل private.key پیدا نشد!\n\n" +
                "اول از تب «کلیدها» جفت کلید بساز.",
                "خطا",
                MessageBoxButton.OK,
                MessageBoxImage.Warning);
            return;
        }

        var customerName = TxtCustomerName.Text.Trim();
        if (string.IsNullOrWhiteSpace(customerName))
        {
            MessageBox.Show("نام مشتری الزامی است.", "خطا",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            TxtCustomerName.Focus();
            return;
        }

        var customerId = TxtCustomerId.Text.Trim();
        if (string.IsNullOrWhiteSpace(customerId))
        {
            MessageBox.Show("کد مشتری الزامی است.", "خطا",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            TxtCustomerId.Focus();
            return;
        }

        long[] authorizedOrgs;
        try
        {
            authorizedOrgs = TxtOrgs.Text
                .Split(new[] { ',', '،', ' ', ';' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(s => long.Parse(s.Trim()))
                .ToArray();

            if (authorizedOrgs.Length == 0)
            {
                MessageBox.Show("حداقل یک سازمان وارد کن.", "خطا",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                TxtOrgs.Focus();
                return;
            }
        }
        catch
        {
            MessageBox.Show("کدهای سازمان باید عدد باشن (مثل 1,2,5).", "خطا",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            TxtOrgs.Focus();
            return;
        }

        var expiresAt = TxtExpiresAt.Text.Trim();
        if (string.IsNullOrWhiteSpace(expiresAt)) expiresAt = "1405/12/29";

        var notes = TxtNotes.Text.Trim();

        var outputPath = TxtOutputPath.Text.Trim();
        if (string.IsNullOrWhiteSpace(outputPath))
        {
            MessageBox.Show("مسیر خروجی رو انتخاب کن.", "خطا",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        try
        {
            // ─── ساخت payload ───
            var payload = new LicensePayload
            {
                Version = 1,
                LicenseId = "LIC-" + DateTime.Now.ToString("yyyyMMdd-HHmmss"),
                CustomerName = customerName,
                CustomerId = customerId,
                IssuedAt = DateTime.Now.ToString("yyyy/MM/dd"),
                ExpiresAt = expiresAt,
                AuthorizedOrgs = authorizedOrgs,
                Features = new[] { "web", "api" },
                Notes = string.IsNullOrWhiteSpace(notes) ? null : notes
            };

            // ─── امضا ───
            var canonicalJson = BuildCanonicalJson(payload);
            var dataBytes = Encoding.UTF8.GetBytes(canonicalJson);

            using var rsa = RSA.Create();
            rsa.FromXmlString(File.ReadAllText(PrivateKeyPath, Encoding.UTF8));

            var sigBytes = rsa.SignData(
                dataBytes,
                HashAlgorithmName.SHA256,
                RSASignaturePadding.Pkcs1);
            var sigBase64 = Convert.ToBase64String(sigBytes);

            // ─── فایل نهایی ───
            var licenseFile = new LicenseFile
            {
                Payload = payload,
                Signature = sigBase64
            };

            var options = new JsonSerializerOptions
            {
                WriteIndented = true,
                Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
            };

            var finalJson = JsonSerializer.Serialize(licenseFile, options);
            File.WriteAllText(outputPath, finalJson, Encoding.UTF8);

            MessageBox.Show(
                "✅ لایسنس با موفقیت ساخته شد!\n\n" +
                $"👤 مشتری: {customerName} ({customerId})\n" +
                $"🏢 سازمان‌های مجاز: {string.Join(", ", authorizedOrgs)}\n" +
                $"📅 انقضا: {expiresAt}\n" +
                $"📂 مسیر: {outputPath}\n\n" +
                "این فایل رو کنار برنامه‌ی Web بذار و اسمش رو به ariana.lic تغییر بده.",
                "موفق",
                MessageBoxButton.OK,
                MessageBoxImage.Information);

            SetStatus("✅", $"لایسنس برای «{customerName}» ساخته شد.",
                Color.FromRgb(16, 185, 129));
        }
        catch (Exception ex)
        {
            MessageBox.Show($"❌ خطا: {ex.Message}", "خطا",
                MessageBoxButton.OK, MessageBoxImage.Error);
            SetStatus("❌", $"خطا: {ex.Message}",
                Color.FromRgb(239, 68, 68));
        }
    }

    // ═══════════════════════════════════════════
    //  Canonical JSON — باید عیناً با Web یکی باشه
    // ═══════════════════════════════════════════
    private static string BuildCanonicalJson(LicensePayload p)
    {
        var featuresJson = "[" + string.Join(",", p.Features.Select(f => $"\"{f}\"")) + "]";
        var orgsJson = "[" + string.Join(",", p.AuthorizedOrgs) + "]";
        var notesJson = string.IsNullOrEmpty(p.Notes)
            ? "null"
            : "\"" + p.Notes.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";

        return "{" +
               $"\"version\":{p.Version}," +
               $"\"licenseId\":\"{p.LicenseId}\"," +
               $"\"customerName\":\"{p.CustomerName}\"," +
               $"\"customerId\":\"{p.CustomerId}\"," +
               $"\"issuedAt\":\"{p.IssuedAt}\"," +
               $"\"expiresAt\":\"{p.ExpiresAt}\"," +
               $"\"authorizedOrgs\":{orgsJson}," +
               $"\"features\":{featuresJson}," +
               $"\"notes\":{notesJson}" +
               "}";
    }
}

// ═══════════════════════════════════════════
//  DTOs
// ═══════════════════════════════════════════
public class LicensePayload
{
    [JsonPropertyName("version")]
    public int Version { get; set; }

    [JsonPropertyName("licenseId")]
    public string LicenseId { get; set; } = "";

    [JsonPropertyName("customerName")]
    public string CustomerName { get; set; } = "";

    [JsonPropertyName("customerId")]
    public string CustomerId { get; set; } = "";

    [JsonPropertyName("issuedAt")]
    public string IssuedAt { get; set; } = "";

    [JsonPropertyName("expiresAt")]
    public string ExpiresAt { get; set; } = "";

    [JsonPropertyName("authorizedOrgs")]
    public long[] AuthorizedOrgs { get; set; } = Array.Empty<long>();

    [JsonPropertyName("features")]
    public string[] Features { get; set; } = Array.Empty<string>();

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }
}

public class LicenseFile
{
    [JsonPropertyName("payload")]
    public LicensePayload Payload { get; set; } = new();

    [JsonPropertyName("signature")]
    public string Signature { get; set; } = "";
}