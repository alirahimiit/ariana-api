namespace ArianaAPI.Application.DTOs.Common;

public class HesabTreeDto
{
    public long HesabId { get; set; }
    public int CodeCol { get; set; }
    public int CodeMoein { get; set; }
    public int CodeTafzil { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? Mahiat { get; set; }
    public int? Vaziat { get; set; }
    public bool HasTafzili { get; set; }
    public bool HasTafzili2 { get; set; }
    public bool IsStock { get; set; }

    public decimal SumBed { get; set; }
    public decimal SumBes { get; set; }
    public decimal MabMandeh { get; set; }

    /// <summary>col | moein | tafzil</summary>
    public string Level { get; set; } = "col";

    /// <summary>برای ساخت درخت</summary>
    public int LevelNumber => Level switch
    {
        "col" => 1,
        "moein" => 2,
        "tafzil" => 3,
        _ => 1
    };

    public string Path => $"{CodeCol}|{CodeMoein}|{CodeTafzil}";
}