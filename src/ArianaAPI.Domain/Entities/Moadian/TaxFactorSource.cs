namespace ArianaAPI.Domain.Entities.Moadian;

/// <summary>
/// منبع فاکتور (FactorParent + Hesab) — برای انتخاب و ارسال به مودیان
/// پورت شده از FactorBl.cs
/// </summary>
public class TaxFactorSource
{
    public long Id { get; set; }
    public string? FldFacNo { get; set; }       // NoFactor
    public string? FldFacDate { get; set; }     // Date_In
    public string? FldSumKol { get; set; }      // Cost
    public long CustomerCode { get; set; }      // CodeTafzil
    public string? FldCustName { get; set; }    // Hesab.Name
    public int IsCash { get; set; }
}

/// <summary>
/// ردیف فاکتور — منبع برای tax_body
/// پورت شده از FactorRowBl.cs
/// </summary>
public class TaxFactorRowSource
{
    public long StuffId { get; set; }           // FactorDetail.ArticleID
    public long UnitId { get; set; }            // ArticleNew.ArticleUnitID
    public double FldQty { get; set; }          // ArticleCount
    public long FldPrice { get; set; }          // Cost × Count
    public long Discount { get; set; }
    public long FldVra { get; set; }            // نرخ VAT
    public long FldTaxAmount { get; set; }      // مبلغ VAT
}