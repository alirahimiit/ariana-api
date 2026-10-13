namespace ArianaAPI.Application.DTOs.Lookup;

public class StateDto
{
    public long Id { get; set; }
    public decimal? Code { get; set; }
    public string? Name { get; set; }
}

public class CityDto
{
    public long Id { get; set; }
    public decimal? Code { get; set; }
    public string? Name { get; set; }
    public long? StateId { get; set; }
}