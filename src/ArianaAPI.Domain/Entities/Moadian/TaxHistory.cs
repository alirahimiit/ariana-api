namespace ArianaAPI.Domain.Entities.Moadian;

public class TaxHistory
{
    public long Id { get; set; }
    public long HeaderId { get; set; }
    public string? Uid { get; set; }
    public string? RefNumber { get; set; }
    public string? TaxId { get; set; }
    public DateTime CreateDate { get; set; }
}