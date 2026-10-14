namespace ArianaAPI.Application.DTOs.Factor;

public class FactorConvertResultDto
{
    public long NewFactorId { get; set; }
    public long NewNoFactor { get; set; }       // ← از int به long
    public long SourceFactorId { get; set; }
    public long SourceNoFactor { get; set; }    // ← از int به long
}