# ArianaAPI

REST API for Ariana accounting system.

## Tech Stack
- .NET 8 Web API
- Dapper
- SQL Server 2008 R2
- JWT + API Key auth

## Structure
- `src/ArianaAPI.Domain` — Entities
- `src/ArianaAPI.Application` — DTOs, Interfaces
- `src/ArianaAPI.Infrastructure` — Repositories, Dapper
- `src/ArianaAPI.Web` — Controllers, UI

## Run
```bash
dotnet run --project src/ArianaAPI.Web