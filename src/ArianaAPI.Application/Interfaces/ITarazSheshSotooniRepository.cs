using ArianaAPI.Application.DTOs.Taraz;

namespace ArianaAPI.Application.Interfaces;

public interface ITarazSheshSotooniRepository
{
    Task<TarazSheshSotooniResultDto> GetTarazAsync(
        long orgId,
        long fyId,
        TarazSheshSotooniRequestDto request,
        CancellationToken ct = default);
}