using ArianaAPI.Application.DTOs.Permissions;

namespace ArianaAPI.Application.Interfaces;

/// <summary>Repository جداول UserGroup / Permision / Other — Tenant DB</summary>
public interface IPermissionRepository
{
    Task<UserPermissionsDto?> GetByUserGroupAsync(
        long orgId, long fyId, long userGroupCode, CancellationToken ct = default);

    Task<List<UserGroupDto>> GetAllUserGroupsAsync(
        long orgId, long fyId, CancellationToken ct = default);

    Task<UserGroupDto?> GetUserGroupAsync(
        long orgId, long fyId, long userGroupCode, CancellationToken ct = default);

    Task<List<OtherItemDto>> GetAllOperationsAsync(
        long orgId, long fyId, CancellationToken ct = default);

    Task SaveAsync(
        long orgId, long fyId, long userGroupCode,
        SavePermissionsDto dto, CancellationToken ct = default);

    Task<long> SaveUserGroupAsync(
        long orgId, long fyId, UserGroupDto dto, CancellationToken ct = default);
}