namespace ArianaAPI.Domain.Entities.Moadian;

public class TaxError
{
    public long Id { get; set; }
    public long HeaderId { get; set; }
    public string? Msg { get; set; }
}