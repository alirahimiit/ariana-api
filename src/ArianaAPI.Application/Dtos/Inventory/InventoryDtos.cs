using System;
using System.Collections.Generic;

namespace ArianaAPI.Application.DTOs.Inventory
{
    // ═══════════════════════════════════════════════════
    //  Stages (مراحل)
    // ═══════════════════════════════════════════════════
    public class InventoryStageDto
    {
        public long Id { get; set; }
        public long StockTypeId { get; set; }
        public int StageNo { get; set; }
        public string StageName { get; set; } = string.Empty;
        public string StartDate { get; set; } = string.Empty;
        public string? EndDate { get; set; }
        public bool IsActive { get; set; }
        public bool IsClosed { get; set; }
    }

    public class InventoryStageWriteDto
    {
        public long StockTypeId { get; set; }
        public int StageNo { get; set; }
        public string StageName { get; set; } = string.Empty;
        public string StartDate { get; set; } = string.Empty;
        public bool IsActive { get; set; }
    }

    // ═══════════════════════════════════════════════════
    //  Tags (تگ‌ها)
    // ═══════════════════════════════════════════════════
    public class InventoryTagListDto
    {
        public long Id { get; set; }
        public string TagNo { get; set; } = string.Empty;
        public long StockTypeId { get; set; }
        public string StockName { get; set; } = string.Empty;
        public int StageNo { get; set; }
        public string StageName { get; set; } = string.Empty;
        public string TagDate { get; set; } = string.Empty;
        public int TagStatus { get; set; }
        public string StatusName { get; set; } = string.Empty;
        public string? LocationCode { get; set; }
        public int TotalItems { get; set; }
        public int CountedItems { get; set; }
        public int ProgressPercent { get; set; }
        public double TotalDifference { get; set; }
        public string? CreateUserName { get; set; }
        public string? ConfirmUserName { get; set; }
        public string? ConfirmDate { get; set; }
        public string? SanadStatus { get; set; }
        public string? SanadFullInfo { get; set; }
    }

    public class InventoryTagRequestDto
    {
        public long? StockTypeId { get; set; }
        public int? StageNo { get; set; }
        public int? TagStatus { get; set; }
        public string? TagNo { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 50;
    }

    public class InventoryTagListResultDto
    {
        public List<InventoryTagListDto> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }

    public class InventoryTagDetailDto
    {
        public long Id { get; set; }
        public string TagNo { get; set; } = string.Empty;
        public long StockTypeId { get; set; }
        public string StockName { get; set; } = string.Empty;
        public int StageNo { get; set; }
        public string TagDate { get; set; } = string.Empty;
        public int TagStatus { get; set; }
        public string? LocationCode { get; set; }
        public string? Notes { get; set; }
        public List<InventoryTagItemDto> Items { get; set; } = new();
    }

    public class InventoryTagItemDto
    {
        public long Id { get; set; }
        public long ArticleId { get; set; }
        public string ArticleCode { get; set; } = string.Empty;
        public string ArticleName { get; set; } = string.Empty;
        public string UnitName { get; set; } = string.Empty;
        public double SystemQty { get; set; }
        public double? CountedQty { get; set; }
        public double? ScrapQty { get; set; }
        public double? DiffQty { get; set; }
        public string? Notes { get; set; }
    }

    public class InventoryCreateTagDto
    {
        public long StockTypeId { get; set; }
        public int StageNo { get; set; }
        public string? TagNo { get; set; } // اگر null باشد، خودکار تولید می‌شود
        public string TagDate { get; set; } = string.Empty;
        public string? LocationCode { get; set; }
        public string? Notes { get; set; }
        public List<long> ArticleIds { get; set; } = new();
    }

    // ═══════════════════════════════════════════════════
    //  Counting (شمارش)
    // ═══════════════════════════════════════════════════
    public class InventoryCountRequestDto
    {
        public long TagDetailId { get; set; }
        public double CountedQty { get; set; }
        public double ScrapQty { get; set; }
    }

    // ═══════════════════════════════════════════════════
    //  Sanad & Lookups
    // ═══════════════════════════════════════════════════
    public class InventorySanadResultDto
    {
        public bool Success { get; set; }
        public string? Error { get; set; }
        public long TagId { get; set; }
        public int SanadsCreated { get; set; }
        public string? Message { get; set; }
    }

    public class InventoryLookupsDto
    {
        public List<InventoryStockLookupDto> StockTypes { get; set; } = new();
        public List<InventoryStageLookupDto> Stages { get; set; } = new();
        public List<InventoryGroupLookupDto> ArticleGroups { get; set; } = new();
        public string TodayDate { get; set; } = string.Empty;
    }

    public class InventoryStockLookupDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    public class InventoryStageLookupDto
    {
        public int StageNo { get; set; }
        public string StageName { get; set; } = string.Empty;
    }

    public class InventoryGroupLookupDto
    {
        public long Id { get; set; }
        public long? StockTypeId { get; set; }
        public string Name { get; set; } = string.Empty;

    }

    public class InventoryDiffReportDto
    {
        public long TagHeaderId { get; set; }
        public string TagNo { get; set; } = string.Empty;
        public string StockName { get; set; } = string.Empty;
        public string ArticleCode { get; set; } = string.Empty;
        public string ArticleName { get; set; } = string.Empty;
        public string UnitName { get; set; } = string.Empty;
        public double SystemQty { get; set; }
        public double? CountedQty { get; set; }
        public double? DiffQty { get; set; }
        public double? ScrapQty { get; set; }
        public double? AbsDiffQty { get; set; }
        public string? Notes { get; set; }
    }

    public class InventoryHistoryDto
    {
        public long TagHeaderId { get; set; }
        public string TagNo { get; set; } = string.Empty;
        public string StockName { get; set; } = string.Empty;
        public string OperationType { get; set; } = string.Empty;
        public string? UserName { get; set; }
        public string? OperationDate { get; set; }
        public string? OperationTime { get; set; }
        public string? Description { get; set; }
    }

}