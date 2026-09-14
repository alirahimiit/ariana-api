namespace ArianaAPI.Application.DTOs.Auth;

public class LoginRequestDto
{
    public long OrgId { get; set; }
    public long FyId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}