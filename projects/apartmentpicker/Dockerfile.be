# Stage 1: Build backend
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG ENV_CODE
ARG BUILD_NUMBER
WORKDIR /src
COPY backend/ .
RUN dotnet restore ApartmentPicker/Web/Web.csproj
RUN dotnet publish ApartmentPicker/Web/Web.csproj -c Release -o /app/publish /p:NoWarn=CS8618 /p:NoWarn=CS8602 /p:NoWarn=CS8604

# Stage 2: Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
ARG ENV_CODE
ARG BUILD_NUMBER
WORKDIR /app
ENV ENV_CODE=$ENV_CODE
ENV BUILD_NUMBER=$BUILD_NUMBER
COPY --from=build /app/publish /app/backend
COPY --from=build /src/ApartmentPicker/Web/appsettings.json /app/
EXPOSE 8080

CMD ["dotnet", "/app/backend/Web.dll"]
