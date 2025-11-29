FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["src/PropertyManager.Api/PropertyManager.Api.csproj", "src/PropertyManager.Api/"]
COPY ["src/PropertyManager.Application/PropertyManager.Application.csproj", "src/PropertyManager.Application/"]
COPY ["src/PropertyManager.Domain/PropertyManager.Domain.csproj", "src/PropertyManager.Domain/"]
COPY ["src/PropertyManager.Infrastructure/PropertyManager.Infrastructure.csproj", "src/PropertyManager.Infrastructure/"]
RUN dotnet restore "src/PropertyManager.Api/PropertyManager.Api.csproj"
COPY . .
WORKDIR "/src/src/PropertyManager.Api"
RUN dotnet publish "PropertyManager.Api.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "PropertyManager.Api.dll"]
