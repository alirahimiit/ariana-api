arianaApi/
├── src/
│   ├── ArianaAPI.Application/
│   │   ├── Common/
│   │   │   └── ApiResponse.cs
│   │   ├── Dtos/
│   │   │   ├── Article/
│   │   │   │   └── ArticleDtos.cs
│   │   │   ├── Auth/
│   │   │   │   ├── LoginRequestDto.cs
│   │   │   │   ├── LoginResponseDto.cs
│   │   │   │   └── RefreshTokenRequestDto.cs
│   │   │   ├── Common/
│   │   │   │   ├── HesabDto.cs
│   │   │   │   ├── HesabTreeDto.cs
│   │   │   │   ├── KindSanadDto.cs
│   │   │   │   └── SharhDto.cs
│   │   │   ├── Dashboard/
│   │   │   │   └── DashboardDtos.cs
│   │   │   ├── Factor/
│   │   │   │   └── FactorDtos.cs
│   │   │   ├── Ledger/
│   │   │   │   └── LedgerDtos.cs
│   │   │   ├── License/
│   │   │   │   └── LicenseInfo.cs
│   │   │   ├── Lookup/
│   │   │   │   └── LookupDtos.cs
│   │   │   ├── Organizations/
│   │   │   │   ├── FiscalYearDto.cs
│   │   │   │   └── OrganizationDto.cs
│   │   │   ├── Sanad/
│   │   │   │   ├── SanadDetailDto.cs
│   │   │   │   ├── SanadItemDto.cs
│   │   │   │   └── SanadListDto.cs
│   │   │   ├── Tafzili/
│   │   │   │   └── TafziliDtos.cs
│   │   │   └── Taraz/
│   │   │       └── TarazDtos.cs
│   │   ├── Interfaces/
│   │   │   ├── IArticleRepository.cs
│   │   │   ├── IAuthService.cs
│   │   │   ├── IDashboardRepository.cs
│   │   │   ├── IFactorRepository.cs
│   │   │   ├── IFiscalYearRepository.cs
│   │   │   ├── IHesabRepository.cs
│   │   │   ├── IKindSanadRepository.cs
│   │   │   ├── ILedgerRepository.cs
│   │   │   ├── ILicenseService.cs
│   │   │   ├── ILookupRepository.cs
│   │   │   ├── IOrganizationRepository.cs
│   │   │   ├── IRefreshTokenStore.cs
│   │   │   ├── ISanadRepository.cs
│   │   │   ├── ISharhRepository.cs
│   │   │   ├── ITafziliRepository.cs
│   │   │   ├── ITarazRepository.cs
│   │   │   ├── ITenantDbNameProvider.cs
│   │   │   ├── ITokenService.cs
│   │   │   └── IUserRepository.cs
│   │   ├── Services/
│   │   │   └── AuthService.cs
│   │   └── ArianaAPI.Application.csproj
│   ├── ArianaAPI.Domain/
│   │   ├── Entities/
│   │   │   ├── DorehMali.cs
│   │   │   ├── FiscalYearContext.cs
│   │   │   ├── Hesab.cs
│   │   │   ├── KindSanad.cs
│   │   │   ├── ParentSanad.cs
│   │   │   ├── Sanad.cs
│   │   │   ├── Sazman.cs
│   │   │   ├── Sharh.cs
│   │   │   └── User.cs
│   │   └── ArianaAPI.Domain.csproj
│   ├── ArianaAPI.Infrastructure/
│   │   ├── Config/
│   │   │   ├── AppSettings.cs
│   │   │   ├── DatabaseSettings.cs
│   │   │   ├── JwtSettings.cs
│   │   │   └── ServerSettings.cs
│   │   ├── Data/
│   │   │   ├── ITenantConnectionFactory.cs
│   │   │   └── TenantConnectionFactory.cs
│   │   ├── Repositories/
│   │   │   ├── ArticleRepository.cs
│   │   │   ├── DashboardRepository.cs
│   │   │   ├── DorehMaliRepository.cs
│   │   │   ├── FactorRepository.cs
│   │   │   ├── HesabRepository.cs
│   │   │   ├── KindSanadRepository.cs
│   │   │   ├── LedgerRepository.cs
│   │   │   ├── LookupRepository.cs
│   │   │   ├── SanadRepository.cs
│   │   │   ├── SazmanRepository.cs
│   │   │   ├── SharhRepository.cs
│   │   │   ├── TafziliRepository.cs
│   │   │   ├── TarazRepository.cs
│   │   │   └── UserRepository.cs
│   │   ├── Services/
│   │   │   ├── InMemoryRefreshTokenStore.cs
│   │   │   ├── LicenseService.cs
│   │   │   ├── TenantDbNameProvider.cs
│   │   │   └── TokenService.cs
│   │   ├── ArianaAPI.Infrastructure.csproj
│   │   └── DependencyInjection.cs
│   └── ArianaAPI.Web/
│       ├── Controllers/
│       │   ├── ArticleController.cs
│       │   ├── AuthController.cs
│       │   ├── DashboardController.cs
│       │   ├── FactorController.cs
│       │   ├── HesabController.cs
│       │   ├── KindSanadController.cs
│       │   ├── LedgerController.cs
│       │   ├── LicenseController.cs
│       │   ├── LookupController.cs
│       │   ├── SanadController.cs
│       │   ├── SharhController.cs
│       │   ├── TafziliController.cs
│       │   └── TarazController.cs
│       ├── Extensions/
│       │   └── ClaimsPrincipalExtensions.cs
│       ├── Middleware/
│       │   ├── ApiKeyMiddleware.cs
│       │   └── ExceptionMiddleware.cs
│       ├── Properties/
│       │   └── launchSettings.json
│       ├── wwwroot/
│       │   ├── css/
│       │   │   └── style.css
│       │   ├── js/
│       │   │   ├── app.js
│       │   │   └── exporter.js
│       │   └── index.html
│       ├── appsettings.Development.json
│       ├── appsettings.json
│       ├── appsettings.Production.json
│       ├── ArianaAPI.Web.csproj
│       └── Program.cs
├── tests/
│   └── ArianaAPI.Tests/
│       ├── ArianaAPI.Tests.csproj
│       ├── GlobalUsings.cs
│       └── UnitTest1.cs
├── tools/
│   ├── ArianaKeyGen/
│   │   ├── App.xaml
│   │   ├── App.xaml.cs
│   │   ├── ArianaKeyGen.csproj
│   │   ├── AssemblyInfo.cs
│   │   ├── MainWindow.xaml
│   │   └── MainWindow.xaml.cs
│   └── generate-structure.ps1
├── .gitignore
├── ArianaAPI.sln
├── install.bat
├── README.md
├── set.env
├── structure.md
├── structure.txt
└── uninstall.bat
