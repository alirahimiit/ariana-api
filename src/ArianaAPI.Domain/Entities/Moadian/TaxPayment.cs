namespace ArianaAPI.Domain.Entities.Moadian;

public class TaxPayment
{
    public long Id { get; set; }
    public long HeaderId { get; set; }
    public string? Iinn { get; set; }
    public string? Acn { get; set; }
    public string? Trmn { get; set; }
    public long? Pmt { get; set; }
    public string? Trn { get; set; }
    public string? Pcn { get; set; }
    public string? Pid { get; set; }
    public long? Pdt { get; set; }
    public DateTime? PdtDateformat { get; set; }
    public string? PdtPersian { get; set; }
    public long? Pv { get; set; }
}