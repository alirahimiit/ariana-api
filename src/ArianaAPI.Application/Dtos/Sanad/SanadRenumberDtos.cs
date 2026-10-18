using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Sanad;

/// <summary>
/// نتیجه پیش‌نمایش مرتب‌سازی (اسناد یا فاکتورها)
/// </summary>
public class RenumberPreviewResult
{
    public bool IsAllowed { get; set; }
    public string? BlockReason { get; set; }
    public int TotalCount { get; set; }
    public int ChangedCount { get; set; }
    public int? OldMinNo { get; set; }
    public int? OldMaxNo { get; set; }
    public int? NewMinNo { get; set; }
    public int? NewMaxNo { get; set; }
    public List<RenumberRow> Rows { get; set; } = new();
    public List<RenumberBlockItem> BlockItems { get; set; } = new();
}

public class RenumberBlockItem
{
    public long Id { get; set; }
    public int? No { get; set; }
    public int? Vazeit { get; set; }
    public string? Date { get; set; }
    public string? Sharh { get; set; }
}

public class RenumberRow
{
    public long Id { get; set; }
    public int? Kind { get; set; }              // FactorKind — فقط برای فاکتور
    public int? OldNo { get; set; }
    public int? NewNo { get; set; }
    public string? Date { get; set; }
    public string? Sharh { get; set; }
    public int ItemCount { get; set; }
    public int? Vazeit { get; set; }            // فقط برای اسناد

    // ⭐ computed — Dapper نمی‌نویسه، فقط JSON
    public bool Changed => OldNo != NewNo;
}

public class RenumberCommitResult
{
    public int ProcessedCount { get; set; }
    public int AffectedItemsCount { get; set; } // تعداد ردیف Sanad (فاکتور: 0)
    public List<RenumberRow> Rows { get; set; } = new();
}