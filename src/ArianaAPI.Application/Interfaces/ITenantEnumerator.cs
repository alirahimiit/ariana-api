using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace ArianaAPI.Application.Interfaces
{
    public class TenantRef
    {
        public long OrgId { get; set; }
        public long FyId { get; set; }
    }

    public interface ITenantEnumerator
    {
        Task<List<TenantRef>> GetAllTenantsAsync(CancellationToken ct = default);
    }
}