namespace ArianaAPI.Infrastructure.Services.Moadian;

public interface IMoadianService
{
    // ═══ تنظیمات ═══
    MoadianOptions Options { get; }

    // ═══ ۱۱ متد اصلی ═══
    Task<MoadianServerInfoResponse> GetServerInformationAsync(CancellationToken ct = default);
    Task<MoadianTokenResponse> GetTokenAsync(CancellationToken ct = default);
    Task<MoadianFiscalInfoResponse> GetFiscalInformationAsync(string token, CancellationToken ct = default);
    Task<MoadianServiceStuffListResponse> GetServiceStuffListAsync(int page = 1, int size = 10, CancellationToken ct = default);
    Task<MoadianEconomicCodeInfoResponse> GetEconomicCodeInfoAsync(string economicCode, CancellationToken ct = default);

    Task<MoadianInquiryResponse> InquiryByUidAsync(string token, List<MoadianUidModel> uids, CancellationToken ct = default);
    Task<MoadianInquiryResponse> InquiryByReferenceNumberAsync(string token, string[] refNumbers, CancellationToken ct = default);
    Task<MoadianInquiryResponse> InquiryByTimeAsync(string token, string time, CancellationToken ct = default);
    Task<MoadianInquiryResponse> InquiryByTimeRangeAsync(string token, string startDate, string endDate, CancellationToken ct = default);

    Task<MoadianEnqueueResponse> EnqueueAsync(string token, string serverPublicKey, string encryptionKeyId,
        string packetType, string uid, MoadianInvoice invoice, CancellationToken ct = default);

    Task<List<MoadianEnqueueResponse>> EnqueueMultipleAsync(string token, string serverPublicKey, string encryptionKeyId,
        string packetType, List<MoadianComplexInvoice> invoices, CancellationToken ct = default);
}