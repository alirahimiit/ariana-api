using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;

namespace ArianaAPI.Infrastructure.Services
{
    public class TenantEnumerator : ITenantEnumerator
    {
        private readonly ITenantConnectionFactory _factory;

        public TenantEnumerator(ITenantConnectionFactory factory)
        {
            _factory = factory;
        }

        public async Task<List<TenantRef>> GetAllTenantsAsync(CancellationToken ct = default)
        {
            // همه سازمان‌ها و دوره‌های مالی فعال از Permanent DB
            const string sql = @"
                SELECT 
                    SazmanCode  AS OrgId,
                    DorehMaliID AS FyId
                FROM DorehMali
                WHERE SazmanCode IS NOT NULL";

            await using var conn = _factory.CreatePermanentConnection();
            var rows = await conn.QueryAsync<TenantRef>(
                new CommandDefinition(sql, cancellationToken: ct));

            return rows.ToList();
        }
    }
}